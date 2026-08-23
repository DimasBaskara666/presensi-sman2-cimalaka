import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toSyntheticEmail } from "../lib/auth/synthetic-email";

const requiredEnvironment = [
  "TEST_SUPABASE_URL",
  "TEST_SUPABASE_PUBLISHABLE_KEY",
  "TEST_SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_EMAIL_DOMAIN",
  "TEST_ADMIN_LOGIN_ID",
  "TEST_ADMIN_PASSWORD",
  "TEST_TEACHER_LOGIN_ID",
  "TEST_TEACHER_PASSWORD",
  "TEST_STUDENT_ONE_LOGIN_ID",
  "TEST_STUDENT_ONE_PASSWORD",
  "TEST_STUDENT_TWO_LOGIN_ID",
  "TEST_STUDENT_TWO_PASSWORD",
] as const;

const isConfigured = requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Supabase integration tests.`);
  return value;
}

function newClient(key: string): SupabaseClient {
  return createClient(required("TEST_SUPABASE_URL"), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(loginId: string, password: string) {
  const client = newClient(required("TEST_SUPABASE_PUBLISHABLE_KEY"));
  const email = toSyntheticEmail(loginId, required("AUTH_EMAIL_DOMAIN"));
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.equal(error, null);
  assert.ok(data.user);
  return { client, authUserId: data.user.id };
}

async function ownPerson(client: SupabaseClient, authUserId: string) {
  const { data, error } = await client
    .from("people")
    .select("id, role, auth_user_id")
    .eq("auth_user_id", authUserId)
    .single();
  assert.equal(error, null);
  assert.ok(data);
  return data as { id: string; role: "admin" | "teacher" | "student"; auth_user_id: string };
}

test(
  "real Supabase Auth and RLS role matrix",
  { skip: !isConfigured },
  async (context) => {
    const publishableKey = required("TEST_SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = required("TEST_SUPABASE_SERVICE_ROLE_KEY");

    const anonymous = newClient(publishableKey);
    const anonymousRead = await anonymous.from("people").select("id").limit(1);
    assert.ok(anonymousRead.error, "Anonymous users must not receive people table access.");

    const invalidClient = newClient(publishableKey);
    const invalidLogin = await invalidClient.auth.signInWithPassword({
      email: toSyntheticEmail(required("TEST_STUDENT_ONE_LOGIN_ID"), required("AUTH_EMAIL_DOMAIN")),
      password: "deliberately-wrong-integration-test-password",
    });
    assert.ok(invalidLogin.error, "Invalid passwords must be rejected by Supabase Auth.");

    const adminSession = await signIn(required("TEST_ADMIN_LOGIN_ID"), required("TEST_ADMIN_PASSWORD"));
    const teacherSession = await signIn(required("TEST_TEACHER_LOGIN_ID"), required("TEST_TEACHER_PASSWORD"));
    const studentOneSession = await signIn(
      required("TEST_STUDENT_ONE_LOGIN_ID"),
      required("TEST_STUDENT_ONE_PASSWORD"),
    );
    const studentTwoSession = await signIn(
      required("TEST_STUDENT_TWO_LOGIN_ID"),
      required("TEST_STUDENT_TWO_PASSWORD"),
    );

    const adminPerson = await ownPerson(adminSession.client, adminSession.authUserId);
    const teacherPerson = await ownPerson(teacherSession.client, teacherSession.authUserId);
    const studentOnePerson = await ownPerson(studentOneSession.client, studentOneSession.authUserId);
    const studentTwoPerson = await ownPerson(studentTwoSession.client, studentTwoSession.authUserId);

    assert.equal(adminPerson.role, "admin");
    assert.equal(teacherPerson.role, "teacher");
    assert.equal(studentOnePerson.role, "student");
    assert.equal(studentTwoPerson.role, "student");

    const settings = await adminSession.client
      .from("attendance_settings")
      .select("id, qr_lifetime_seconds")
      .eq("id", 1)
      .single();
    assert.equal(settings.error, null);
    assert.ok(settings.data);

    const teacherUpdate = await teacherSession.client
      .from("attendance_settings")
      .update({ qr_lifetime_seconds: settings.data.qr_lifetime_seconds })
      .eq("id", 1)
      .select("id");
    assert.equal(teacherUpdate.error, null);
    assert.deepEqual(teacherUpdate.data, []);

    const adminUpdate = await adminSession.client
      .from("attendance_settings")
      .update({ qr_lifetime_seconds: settings.data.qr_lifetime_seconds })
      .eq("id", 1)
      .select("id");
    assert.equal(adminUpdate.error, null);
    assert.equal(adminUpdate.data?.length, 1);

    const service = newClient(serviceRoleKey);
    const fixtureDate = "2099-01-01";
    const fixture = await service.from("attendance_daily").upsert(
      {
        student_id: studentTwoPerson.id,
        attendance_date: fixtureDate,
        check_in_at: "2099-01-01T00:00:00.000Z",
        check_in_status: "on_time",
        check_in_method: "manual",
        check_in_recorded_by: teacherPerson.id,
      },
      { onConflict: "student_id,attendance_date" },
    );
    assert.equal(fixture.error, null);

    context.after(async () => {
      await service
        .from("attendance_daily")
        .delete()
        .eq("student_id", studentTwoPerson.id)
        .eq("attendance_date", fixtureDate);
      await Promise.all([
        adminSession.client.auth.signOut(),
        teacherSession.client.auth.signOut(),
        studentOneSession.client.auth.signOut(),
        studentTwoSession.client.auth.signOut(),
      ]);
    });

    const crossStudentRead = await studentOneSession.client
      .from("attendance_daily")
      .select("id")
      .eq("student_id", studentTwoPerson.id)
      .eq("attendance_date", fixtureDate);
    assert.equal(crossStudentRead.error, null);
    assert.deepEqual(crossStudentRead.data, []);

    const teacherRead = await teacherSession.client
      .from("attendance_daily")
      .select("id")
      .eq("student_id", studentTwoPerson.id)
      .eq("attendance_date", fixtureDate);
    assert.equal(teacherRead.error, null);
    assert.equal(teacherRead.data?.length, 1);

    const adminRead = await adminSession.client
      .from("attendance_daily")
      .select("id")
      .eq("student_id", studentTwoPerson.id)
      .eq("attendance_date", fixtureDate);
    assert.equal(adminRead.error, null);
    assert.equal(adminRead.data?.length, 1);
  },
);
