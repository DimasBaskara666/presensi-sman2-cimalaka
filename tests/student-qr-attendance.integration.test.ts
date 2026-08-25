import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  digestAttendanceQrToken,
  generateAttendanceQrToken,
} from "../lib/attendance/qr-token";
import { normalizeLoginId } from "../lib/auth/login-id";
import { getSchoolDate } from "../lib/attendance/teacher-attendance-model";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true);

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_EMAIL_DOMAIN",
  "DEV_ADMIN_LOGIN_ID",
  "DEV_TEACHER_LOGIN_ID",
  "DEV_TEACHER_RESET_PASSWORD",
  "DEV_STUDENT_LOGIN_ID",
  "DEV_STUDENT_PASSWORD",
] as const;

const hasAdminPassword = Boolean(
  process.env.DEV_ADMIN_NEW_PASSWORD || process.env.DEV_ADMIN_PASSWORD,
);
const isConfigured = hasAdminPassword
  && requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Student QR integration test.`);
  return value;
}

function client(key: string): SupabaseClient {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function syntheticEmail(loginId: string): string {
  return `${normalizeLoginId(loginId).toLowerCase()}@${required("AUTH_EMAIL_DOMAIN").trim().toLowerCase()}`;
}

async function signIn(loginId: string, passwords: string[]): Promise<SupabaseClient> {
  for (const password of [...new Set(passwords.filter(Boolean))]) {
    const authenticated = client(required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
    const { error } = await authenticated.auth.signInWithPassword({
      email: syntheticEmail(loginId),
      password,
    });
    if (!error) return authenticated;
  }
  throw new Error("A required development role could not sign in.");
}

type AttendanceSchedule = {
  timezone: string;
  official_start_time: string;
  on_time_cutoff: string;
  late_attendance_allowed: boolean;
  monday_checkout_minimum: string;
  tuesday_checkout_minimum: string;
  wednesday_checkout_minimum: string;
  thursday_checkout_minimum: string;
  friday_checkout_minimum: string;
};

function scheduleParameters(schedule: AttendanceSchedule) {
  return {
    p_timezone: schedule.timezone,
    p_official_start_time: schedule.official_start_time,
    p_on_time_cutoff: schedule.on_time_cutoff,
    p_late_attendance_allowed: schedule.late_attendance_allowed,
    p_monday_checkout_minimum: schedule.monday_checkout_minimum,
    p_tuesday_checkout_minimum: schedule.tuesday_checkout_minimum,
    p_wednesday_checkout_minimum: schedule.wednesday_checkout_minimum,
    p_thursday_checkout_minimum: schedule.thursday_checkout_minimum,
    p_friday_checkout_minimum: schedule.friday_checkout_minimum,
  };
}

async function authUserCount(service: SupabaseClient): Promise<number> {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ok(!error, "Supabase Auth users could not be counted.");
  return data.users.length;
}

test("Student QR is atomic, Core-driven, role-protected, idempotent, and cleanable", { skip: !isConfigured }, async (context) => {
  const today = getSchoolDate();
  const isoDay = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  if (isoDay === 0 || isoDay === 6) {
    context.skip("Normal Student QR attendance is intentionally unavailable on weekends.");
    return;
  }

  const service = client(required("SUPABASE_SERVICE_ROLE_KEY"));
  const admin = await signIn(required("DEV_ADMIN_LOGIN_ID"), [
    process.env.DEV_ADMIN_NEW_PASSWORD ?? "",
    process.env.DEV_ADMIN_PASSWORD ?? "",
  ]);
  const teacher = await signIn(required("DEV_TEACHER_LOGIN_ID"), [
    required("DEV_TEACHER_RESET_PASSWORD"),
  ]);
  const student = await signIn(required("DEV_STUDENT_LOGIN_ID"), [
    required("DEV_STUDENT_PASSWORD"),
  ]);
  const anonymous = client(required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const tokenIds: string[] = [];
  const studentLoginId = normalizeLoginId(required("DEV_STUDENT_LOGIN_ID"));
  const initialAuthCount = await authUserCount(service);

  const people = await admin
    .from("people")
    .select("id, login_id, role, auth_user_id")
    .in("login_id", [
      normalizeLoginId(required("DEV_ADMIN_LOGIN_ID")),
      normalizeLoginId(required("DEV_TEACHER_LOGIN_ID")),
      studentLoginId,
    ]);
  assert.ok(!people.error, "Development people could not be loaded.");
  const developmentStudent = people.data.find((person) => person.login_id === studentLoginId);
  assert.ok(developmentStudent && developmentStudent.role === "student");
  assert.equal(typeof developmentStudent.auth_user_id, "string");

  const claimedStudentCountBefore = await admin
    .from("people")
    .select("id", { count: "exact", head: true })
    .eq("role", "student")
    .not("auth_user_id", "is", null);
  assert.ok(!claimedStudentCountBefore.error);
  assert.equal(typeof claimedStudentCountBefore.count, "number");

  const scheduleResult = await admin
    .from("attendance_settings")
    .select("timezone, official_start_time, on_time_cutoff, late_attendance_allowed, monday_checkout_minimum, tuesday_checkout_minimum, wednesday_checkout_minimum, thursday_checkout_minimum, friday_checkout_minimum")
    .eq("id", 1)
    .single();
  assert.ok(!scheduleResult.error, "Attendance schedule could not be loaded.");
  const originalSchedule = scheduleResult.data as AttendanceSchedule;

  const initialAttendance = await admin
    .from("attendance_daily")
    .select("id")
    .eq("student_id", developmentStudent.id)
    .eq("attendance_date", today);
  assert.ok(!initialAttendance.error);
  assert.deepEqual(initialAttendance.data, [], "Development Student must start today unmarked.");
  const initialQr = await admin.from("qr_tokens").select("id");
  assert.ok(!initialQr.error);
  assert.deepEqual(initialQr.data, [], "QR integration test requires an empty QR token table.");

  context.after(async () => {
    if (tokenIds.length > 0) {
      const attendanceRows = await admin
        .from("attendance_daily")
        .select("id")
        .eq("student_id", developmentStudent.id)
        .eq("attendance_date", today);
      assert.ok(!attendanceRows.error, "QR cleanup attendance count could not be read.");
      const cleanup = await service.rpc("cleanup_synthetic_student_qr", {
        p_student_login_id: studentLoginId,
        p_attendance_date: today,
        p_token_ids: tokenIds,
        p_expected_attendance_count: attendanceRows.data.length,
        p_expected_token_count: tokenIds.length,
      });
      assert.ok(!cleanup.error, `QR test cleanup failed: ${cleanup.error?.message ?? "unknown"}`);
      assert.deepEqual(cleanup.data, [{
        attendance_deleted: attendanceRows.data.length,
        tokens_deleted: tokenIds.length,
      }]);
    }

    const restored = await admin.rpc(
      "update_attendance_schedule",
      scheduleParameters(originalSchedule),
    );
    assert.ok(!restored.error && restored.data === true, "Attendance schedule restoration failed.");

    const finalAttendance = await admin.from("attendance_daily").select("id");
    const finalQr = await admin.from("qr_tokens").select("id");
    assert.ok(!finalAttendance.error && !finalQr.error);
    assert.equal(finalAttendance.data.length, 0, "Temporary attendance rows remain after cleanup.");
    assert.equal(finalQr.data.length, 0, "Temporary QR rows remain after cleanup.");
    assert.equal(await authUserCount(service), initialAuthCount, "Auth user count changed during QR testing.");
    const claimedStudentCountAfter = await admin
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .not("auth_user_id", "is", null);
    assert.ok(!claimedStudentCountAfter.error);
    assert.equal(claimedStudentCountAfter.count, claimedStudentCountBefore.count);
    await Promise.all([admin.auth.signOut(), teacher.auth.signOut(), student.auth.signOut()]);
  });

  const testSchedule: AttendanceSchedule = {
    ...originalSchedule,
    official_start_time: "00:00:00",
    on_time_cutoff: "00:00:01",
    late_attendance_allowed: true,
    monday_checkout_minimum: "00:00:02",
    tuesday_checkout_minimum: "00:00:02",
    wednesday_checkout_minimum: "00:00:02",
    thursday_checkout_minimum: "00:00:02",
    friday_checkout_minimum: "00:00:02",
  };
  const scheduleUpdate = await admin.rpc(
    "update_attendance_schedule",
    scheduleParameters(testSchedule),
  );
  assert.ok(!scheduleUpdate.error && scheduleUpdate.data === true, "Controlled live-test schedule could not be applied.");

  const rotate = async () => {
    const token = generateAttendanceQrToken();
    const result = await admin.rpc("rotate_attendance_qr", {
      p_token_hash: digestAttendanceQrToken(token),
    });
    assert.ok(!result.error && result.data?.[0]?.id, "Admin could not generate an active QR.");
    tokenIds.push(result.data[0].id);
    return { token, id: result.data[0].id as string };
  };

  const active = await rotate();
  const hiddenHash = await admin.from("qr_tokens").select("token_hash").eq("id", active.id);
  assert.ok(hiddenHash.error, "The QR database hash must not be selectable by browser roles.");
  const studentQrMetadata = await student.from("qr_tokens").select("id");
  assert.ok(!studentQrMetadata.error);
  assert.deepEqual(studentQrMetadata.data, [], "Students must not see QR token metadata.");

  const anonymousAttempt = await anonymous.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(active.token),
  });
  assert.ok(anonymousAttempt.error, "Anonymous QR attendance must fail.");
  const teacherAttempt = await teacher.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(active.token),
  });
  assert.ok(teacherAttempt.error, "Teacher must not use the Student QR transaction.");
  const adminAttempt = await admin.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(active.token),
  });
  assert.ok(adminAttempt.error, "Admin must not use the Student QR transaction as a Student.");
  const teacherRotationAttempt = await teacher.rpc("rotate_attendance_qr", {
    p_token_hash: digestAttendanceQrToken(generateAttendanceQrToken()),
  });
  assert.ok(teacherRotationAttempt.error, "Teacher must not rotate Admin QR credentials.");
  const invalidAttempt = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(generateAttendanceQrToken()),
  });
  assert.ok(invalidAttempt.error && invalidAttempt.error.message.includes("qr_invalid"));

  const databaseStart = Date.now();
  const checkIn = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(active.token),
  });
  assert.ok(!checkIn.error, "Authenticated development Student QR check-in failed.");
  assert.equal(checkIn.data?.[0]?.action, "check_in");

  const afterCheckIn = await admin
    .from("attendance_daily")
    .select("id, student_id, attendance_date, check_in_at, check_in_status, check_in_method, check_in_recorded_by, check_in_qr_token_id, check_out_at")
    .eq("student_id", developmentStudent.id)
    .eq("attendance_date", today);
  assert.ok(!afterCheckIn.error);
  assert.equal(afterCheckIn.data.length, 1, "QR check-in must create exactly one daily row.");
  const firstRow = afterCheckIn.data[0];
  assert.equal(firstRow.check_in_method, "qr");
  assert.equal(firstRow.check_in_recorded_by, developmentStudent.id);
  assert.equal(firstRow.check_in_qr_token_id, active.id);
  assert.equal(firstRow.check_in_status, "late");
  assert.equal(firstRow.check_out_at, null);
  assert.ok(new Date(firstRow.check_in_at).getTime() >= databaseStart - 5000);
  assert.ok(new Date(firstRow.check_in_at).getTime() <= Date.now() + 5000);

  const repeated = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(active.token),
  });
  assert.ok(!repeated.error, "Repeated QR scan failed after the checkout minimum.");
  assert.equal(repeated.data?.[0]?.action, "check_out");
  const afterRepeated = await admin
    .from("attendance_daily")
    .select("id, check_in_at, check_out_at, check_out_method, check_out_recorded_by, check_out_qr_token_id")
    .eq("student_id", developmentStudent.id)
    .eq("attendance_date", today);
  assert.ok(!afterRepeated.error);
  assert.equal(afterRepeated.data.length, 1, "Repeated scan must not duplicate the daily row.");
  assert.equal(afterRepeated.data[0].id, firstRow.id);
  assert.equal(afterRepeated.data[0].check_in_at, firstRow.check_in_at);
  assert.ok(afterRepeated.data[0].check_out_at);
  assert.equal(afterRepeated.data[0].check_out_method, "qr");
  assert.equal(afterRepeated.data[0].check_out_recorded_by, developmentStudent.id);
  assert.equal(afterRepeated.data[0].check_out_qr_token_id, active.id);

  const completed = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(active.token),
  });
  assert.ok(!completed.error);
  assert.equal(completed.data?.[0]?.action, "completed");
  const afterCompleted = await admin
    .from("attendance_daily")
    .select("id")
    .eq("student_id", developmentStudent.id)
    .eq("attendance_date", today);
  assert.ok(!afterCompleted.error);
  assert.deepEqual(afterCompleted.data, [{ id: firstRow.id }]);

  const expiring = await rotate();
  const revokedOld = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(active.token),
  });
  assert.ok(revokedOld.error && revokedOld.error.message.includes("qr_revoked"));

  const expired = await service.rpc("expire_synthetic_attendance_qr", {
    p_token_id: expiring.id,
  });
  assert.ok(!expired.error && expired.data === true, "Synthetic QR could not be expired safely.");
  const expiredAttempt = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(expiring.token),
  });
  assert.ok(expiredAttempt.error && expiredAttempt.error.message.includes("qr_expired"));

  const revoking = await rotate();
  const revoked = await admin.rpc("revoke_active_attendance_qr");
  assert.ok(!revoked.error && revoked.data === 1, "Admin could not revoke the active QR.");
  const revokedAttempt = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(revoking.token),
  });
  assert.ok(revokedAttempt.error && revokedAttempt.error.message.includes("qr_revoked"));

  const studentDirectWrite = await student.from("attendance_daily").insert({
    student_id: developmentStudent.id,
    attendance_date: today,
  });
  assert.ok(studentDirectWrite.error, "Student direct attendance-table writes must fail.");
  const studentTokenWrite = await student.from("qr_tokens").insert({
    token_hash: digestAttendanceQrToken(generateAttendanceQrToken()),
    token_type: "attendance",
    created_by: developmentStudent.id,
    expires_at: new Date(Date.now() + 300_000).toISOString(),
  });
  assert.ok(studentTokenWrite.error, "Student direct QR-token writes must fail.");
  const serviceQrRead = await service.from("qr_tokens").select("id");
  assert.ok(serviceQrRead.error, "Service role must retain no broad QR-table access.");
});
