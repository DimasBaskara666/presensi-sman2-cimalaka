import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeLoginId } from "../lib/auth/login-id";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true);

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_EMAIL_DOMAIN",
  "NEXT_PUBLIC_APP_URL",
  "DEV_ADMIN_LOGIN_ID",
  "DEV_TEACHER_LOGIN_ID",
  "DEV_TEACHER_RESET_PASSWORD",
  "DEV_STUDENT_LOGIN_ID",
  "DEV_STUDENT_PASSWORD",
] as const;

const hasAdminPassword = Boolean(process.env.DEV_ADMIN_NEW_PASSWORD || process.env.DEV_ADMIN_PASSWORD);
const isConfigured = hasAdminPassword && requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Admin attendance operations integration test.`);
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

async function browserSession(loginId: string, passwords: string[]) {
  for (const password of [...new Set(passwords.filter(Boolean))]) {
    const cookieJar = new Map<string, string>();
    const supabase = createServerClient(
      required("NEXT_PUBLIC_SUPABASE_URL"),
      required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      {
        cookies: {
          getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
          setAll: (cookies) => cookies.forEach(({ name, value }) => cookieJar.set(name, value)),
        },
      },
    );
    const result = await supabase.auth.signInWithPassword({ email: syntheticEmail(loginId), password });
    if (!result.error) {
      return {
        cookieHeader: [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; "),
        supabase,
      };
    }
  }
  throw new Error("A required browser session could not sign in.");
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isoDay(date: string): number {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function schoolDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function localTimestamp(date: string, time: string): string {
  return `${date}T${time}+07:00`;
}

async function unusedHistoricalMonday(admin: SupabaseClient, studentId: string): Promise<string> {
  let candidate = addDays(schoolDate(), -14);
  while (isoDay(candidate) !== 1) candidate = addDays(candidate, -1);
  for (let attempt = 0; attempt < 104; attempt += 1) {
    const existing = await admin
      .from("attendance_daily")
      .select("id")
      .eq("student_id", studentId)
      .eq("attendance_date", candidate);
    assert.ok(!existing.error, "A fixture date could not be checked.");
    if (existing.data.length === 0) return candidate;
    candidate = addDays(candidate, -7);
  }
  throw new Error("No unused historical Monday was available for the live test.");
}

test("Admin attendance settings and historical corrections use validated RPCs and preserve RLS", { skip: !isConfigured }, async (context) => {
  const service = client(required("SUPABASE_SERVICE_ROLE_KEY"));
  const admin = await signIn(required("DEV_ADMIN_LOGIN_ID"), [
    process.env.DEV_ADMIN_NEW_PASSWORD ?? "",
    process.env.DEV_ADMIN_PASSWORD ?? "",
  ]);
  const teacher = await signIn(required("DEV_TEACHER_LOGIN_ID"), [required("DEV_TEACHER_RESET_PASSWORD")]);
  const student = await signIn(required("DEV_STUDENT_LOGIN_ID"), [required("DEV_STUDENT_PASSWORD")]);
  const anonymous = client(required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));

  const studentLoginId = normalizeLoginId(required("DEV_STUDENT_LOGIN_ID"));
  const person = await admin
    .from("people")
    .select("id, login_id, full_name, class_name, role")
    .eq("login_id", studentLoginId)
    .single();
  assert.ok(!person.error && person.data.role === "student", "The development Student could not be loaded.");

  const original = await admin
    .from("attendance_settings")
    .select("timezone, official_start_time, on_time_cutoff, late_attendance_allowed, monday_checkout_minimum, tuesday_checkout_minimum, wednesday_checkout_minimum, thursday_checkout_minimum, friday_checkout_minimum")
    .eq("id", 1)
    .single();
  assert.ok(!original.error, "Current attendance settings could not be loaded.");
  const fixtureDate = await unusedHistoricalMonday(admin, person.data.id);

  context.after(async () => {
    const restore = await admin.rpc("update_attendance_schedule", {
      p_timezone: original.data.timezone,
      p_official_start_time: original.data.official_start_time,
      p_on_time_cutoff: original.data.on_time_cutoff,
      p_late_attendance_allowed: original.data.late_attendance_allowed,
      p_monday_checkout_minimum: original.data.monday_checkout_minimum,
      p_tuesday_checkout_minimum: original.data.tuesday_checkout_minimum,
      p_wednesday_checkout_minimum: original.data.wednesday_checkout_minimum,
      p_thursday_checkout_minimum: original.data.thursday_checkout_minimum,
      p_friday_checkout_minimum: original.data.friday_checkout_minimum,
    });
    assert.ok(!restore.error && restore.data === true, "Attendance settings could not be restored.");

    const fixtureRows = await admin
      .from("attendance_daily")
      .select("id")
      .eq("student_id", person.data.id)
      .eq("attendance_date", fixtureDate);
    assert.ok(!fixtureRows.error);
    const cleanup = await service.rpc("cleanup_synthetic_attendance_core", {
      p_student_login_id: studentLoginId,
      p_attendance_dates: [fixtureDate],
      p_expected_count: fixtureRows.data.length,
    });
    assert.ok(!cleanup.error, "Synthetic attendance and correction audit cleanup failed.");
    assert.equal(cleanup.data, fixtureRows.data.length);

    const restored = await admin
      .from("attendance_settings")
      .select("timezone, official_start_time, on_time_cutoff, late_attendance_allowed, monday_checkout_minimum, tuesday_checkout_minimum, wednesday_checkout_minimum, thursday_checkout_minimum, friday_checkout_minimum")
      .eq("id", 1)
      .single();
    assert.ok(!restored.error);
    assert.deepEqual(restored.data, original.data);
    await Promise.all([admin.auth.signOut(), teacher.auth.signOut(), student.auth.signOut()]);
  });

  const directSettingsUpdate = await admin
    .from("attendance_settings")
    .update({ official_start_time: "06:31:00" })
    .eq("id", 1);
  assert.ok(directSettingsUpdate.error, "Admin must not update attendance settings directly.");

  const teacherSettings = await teacher.rpc("update_attendance_schedule", {
    p_timezone: "Asia/Jakarta",
    p_official_start_time: "06:31:00",
    p_on_time_cutoff: "06:46:00",
    p_late_attendance_allowed: true,
    p_monday_checkout_minimum: "15:01:00",
    p_tuesday_checkout_minimum: "15:01:00",
    p_wednesday_checkout_minimum: "15:01:00",
    p_thursday_checkout_minimum: "15:01:00",
    p_friday_checkout_minimum: "13:01:00",
  });
  assert.ok(teacherSettings.error, "Teacher must not update attendance settings.");

  const updated = await admin.rpc("update_attendance_schedule", {
    p_timezone: original.data.timezone,
    p_official_start_time: "06:31:00",
    p_on_time_cutoff: "06:46:00",
    p_late_attendance_allowed: original.data.late_attendance_allowed,
    p_monday_checkout_minimum: "15:01:00",
    p_tuesday_checkout_minimum: "15:01:00",
    p_wednesday_checkout_minimum: "15:01:00",
    p_thursday_checkout_minimum: "15:01:00",
    p_friday_checkout_minimum: "13:01:00",
  });
  assert.ok(!updated.error && updated.data === true, "Admin validated settings update failed.");
  const changed = await admin
    .from("attendance_settings")
    .select("official_start_time, on_time_cutoff, monday_checkout_minimum, thursday_checkout_minimum, friday_checkout_minimum")
    .eq("id", 1)
    .single();
  assert.deepEqual(changed.data, {
    official_start_time: "06:31:00",
    on_time_cutoff: "06:46:00",
    monday_checkout_minimum: "15:01:00",
    thursday_checkout_minimum: "15:01:00",
    friday_checkout_minimum: "13:01:00",
  });

  const created = await admin.rpc("correct_attendance", {
    p_student_id: person.data.id,
    p_attendance_date: fixtureDate,
    p_check_in_at: localTimestamp(fixtureDate, "06:31:00"),
    p_check_out_at: localTimestamp(fixtureDate, "15:01:00"),
    p_absence_category: null,
    p_absence_note: null,
    p_reason: "Synthetic Admin operations fixture",
  });
  assert.ok(!created.error && typeof created.data === "string", "Synthetic correction fixture could not be created.");
  const attendanceId = created.data as string;

  const beforeCorrection = await admin
    .from("attendance_daily")
    .select("id, student_id, attendance_date, student_login_id_snapshot, student_full_name_snapshot, student_class_name_snapshot, check_in_at, check_out_at, absence_category")
    .eq("id", attendanceId)
    .single();
  assert.ok(!beforeCorrection.error);
  assert.equal(beforeCorrection.data.student_login_id_snapshot, person.data.login_id);
  assert.equal(beforeCorrection.data.student_full_name_snapshot, person.data.full_name);
  assert.equal(beforeCorrection.data.student_class_name_snapshot, person.data.class_name);

  const corrected = await admin.rpc("correct_attendance", {
    p_student_id: person.data.id,
    p_attendance_date: fixtureDate,
    p_check_in_at: null,
    p_check_out_at: null,
    p_absence_category: "sick",
    p_absence_note: "Synthetic medical note",
    p_reason: "Synthetic verified historical correction",
  });
  assert.ok(!corrected.error);
  assert.equal(corrected.data, attendanceId);

  const afterCorrection = await admin
    .from("attendance_daily")
    .select("id, student_id, attendance_date, student_login_id_snapshot, student_full_name_snapshot, student_class_name_snapshot, check_in_at, check_out_at, absence_category, absence_note")
    .eq("id", attendanceId)
    .single();
  assert.ok(!afterCorrection.error);
  assert.equal(afterCorrection.data.student_id, beforeCorrection.data.student_id);
  assert.equal(afterCorrection.data.attendance_date, beforeCorrection.data.attendance_date);
  assert.equal(afterCorrection.data.student_login_id_snapshot, beforeCorrection.data.student_login_id_snapshot);
  assert.equal(afterCorrection.data.student_full_name_snapshot, beforeCorrection.data.student_full_name_snapshot);
  assert.equal(afterCorrection.data.student_class_name_snapshot, beforeCorrection.data.student_class_name_snapshot);
  assert.equal(afterCorrection.data.check_in_at, null);
  assert.equal(afterCorrection.data.check_out_at, null);
  assert.equal(afterCorrection.data.absence_category, "sick");
  assert.equal(afterCorrection.data.absence_note, "Synthetic medical note");

  const audits = await admin
    .from("attendance_corrections")
    .select("attendance_id, reason, before_data, after_data")
    .eq("attendance_id", attendanceId);
  assert.ok(!audits.error);
  assert.equal(audits.data.length, 2);
  const audit = audits.data.find((row) => row.reason === "Synthetic verified historical correction");
  assert.ok(audit, "The historical correction audit was not found.");
  assert.equal((audit.before_data as Record<string, unknown>).check_in_at, beforeCorrection.data.check_in_at);
  assert.equal((audit.after_data as Record<string, unknown>).absence_category, "sick");

  const teacherCorrection = await teacher.rpc("correct_attendance", {
    p_student_id: person.data.id,
    p_attendance_date: fixtureDate,
    p_check_in_at: null,
    p_check_out_at: null,
    p_absence_category: "permission",
    p_absence_note: null,
    p_reason: "Teacher must not correct history",
  });
  assert.ok(teacherCorrection.error, "Teacher must not correct historical attendance.");
  const studentCorrection = await student.rpc("correct_attendance", {
    p_student_id: person.data.id,
    p_attendance_date: fixtureDate,
    p_check_in_at: null,
    p_check_out_at: null,
    p_absence_category: "permission",
    p_absence_note: null,
    p_reason: "Student must not correct history",
  });
  assert.ok(studentCorrection.error, "Student must not correct historical attendance.");
  const teacherAudits = await teacher.from("attendance_corrections").select("id").eq("attendance_id", attendanceId);
  assert.ok(!teacherAudits.error);
  assert.deepEqual(teacherAudits.data, []);
  const anonymousSettings = await anonymous.from("attendance_settings").select("id");
  assert.ok(anonymousSettings.error, "Anonymous must not read attendance settings.");
  const directAttendanceUpdate = await admin
    .from("attendance_daily")
    .update({ absence_note: "Direct write must fail" })
    .eq("id", attendanceId);
  assert.ok(directAttendanceUpdate.error, "Admin corrections must use correct_attendance, not direct writes.");

  const adminBrowser = await browserSession(required("DEV_ADMIN_LOGIN_ID"), [
    process.env.DEV_ADMIN_NEW_PASSWORD ?? "",
    process.env.DEV_ADMIN_PASSWORD ?? "",
  ]);
  const teacherBrowser = await browserSession(required("DEV_TEACHER_LOGIN_ID"), [required("DEV_TEACHER_RESET_PASSWORD")]);
  const studentBrowser = await browserSession(required("DEV_STUDENT_LOGIN_ID"), [required("DEV_STUDENT_PASSWORD")]);
  const appUrl = required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const adminSettingsPage = await fetch(`${appUrl}/admin/attendance-settings`, {
    headers: { cookie: adminBrowser.cookieHeader },
    redirect: "manual",
  });
  assert.equal(adminSettingsPage.status, 200);
  const settingsHtml = await adminSettingsPage.text();
  assert.ok(settingsHtml.includes("Pengaturan Presensi"));
  assert.ok(settingsHtml.includes("update_attendance_schedule") === false);

  const correctionPage = await fetch(`${appUrl}/admin/attendance-corrections?date=${fixtureDate}&record=${attendanceId}`, {
    headers: { cookie: adminBrowser.cookieHeader },
    redirect: "manual",
  });
  assert.equal(correctionPage.status, 200);
  const correctionHtml = await correctionPage.text();
  assert.ok(correctionHtml.includes(person.data.login_id));
  assert.ok(correctionHtml.includes("Synthetic medical note"));
  assert.ok(!correctionHtml.includes(person.data.id));

  for (const deniedSession of [teacherBrowser, studentBrowser]) {
    const denied = await fetch(`${appUrl}/admin/attendance-settings`, {
      headers: { cookie: deniedSession.cookieHeader },
      redirect: "manual",
    });
    assert.ok([303, 307, 308].includes(denied.status));
    assert.match(denied.headers.get("location") ?? "", /\/forbidden$/);
  }
  const anonymousPage = await fetch(`${appUrl}/admin/attendance-corrections`, { redirect: "manual" });
  assert.ok([303, 307, 308].includes(anonymousPage.status));
  assert.match(anonymousPage.headers.get("location") ?? "", /\/login$/);

  await Promise.all([
    adminBrowser.supabase.auth.signOut(),
    teacherBrowser.supabase.auth.signOut(),
    studentBrowser.supabase.auth.signOut(),
  ]);
});
