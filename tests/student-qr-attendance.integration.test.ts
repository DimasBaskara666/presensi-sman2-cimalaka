import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { digestAttendanceQrToken } from "../lib/attendance/qr-token";
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

const hasAdminPassword = Boolean(process.env.DEV_ADMIN_NEW_PASSWORD || process.env.DEV_ADMIN_PASSWORD);
const isConfigured = hasAdminPassword && requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the shared QR integration test.`);
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

type SharedSessionRow = {
  session_active: boolean;
  session_id: string | null;
  token_id: string | null;
  token_value: string | null;
  created_at: string | null;
  expires_at: string | null;
  server_now: string;
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

async function sessionCall(
  actor: SupabaseClient,
  functionName: "start_attendance_qr_session" | "get_attendance_qr_session",
): Promise<SharedSessionRow> {
  const result = await actor.rpc(functionName);
  assert.ok(!result.error && Array.isArray(result.data) && result.data.length === 1, `${functionName} failed.`);
  return result.data[0] as SharedSessionRow;
}

function assertActive(row: SharedSessionRow): asserts row is SharedSessionRow & {
  session_id: string;
  token_id: string;
  token_value: string;
  created_at: string;
  expires_at: string;
} {
  assert.equal(row.session_active, true);
  assert.equal(typeof row.session_id, "string");
  assert.equal(typeof row.token_id, "string");
  assert.match(row.token_value ?? "", /^qra_[A-Za-z0-9_-]{43}$/);
  assert.equal(typeof row.created_at, "string");
  assert.equal(typeof row.expires_at, "string");
}

test("shared QR session supports both staff roles, rotation, stop, restart, and Student validation", { skip: !isConfigured }, async (context) => {
  const today = getSchoolDate();
  const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  if (day === 0 || day === 6) {
    context.skip("Normal Student QR attendance is intentionally unavailable on weekends.");
    return;
  }

  const service = client(required("SUPABASE_SERVICE_ROLE_KEY"));
  const admin = await signIn(required("DEV_ADMIN_LOGIN_ID"), [
    process.env.DEV_ADMIN_NEW_PASSWORD ?? "",
    process.env.DEV_ADMIN_PASSWORD ?? "",
  ]);
  const teacher = await signIn(required("DEV_TEACHER_LOGIN_ID"), [required("DEV_TEACHER_RESET_PASSWORD")]);
  const student = await signIn(required("DEV_STUDENT_LOGIN_ID"), [required("DEV_STUDENT_PASSWORD")]);
  const anonymous = client(required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const tokenIds: string[] = [];
  const studentLoginId = normalizeLoginId(required("DEV_STUDENT_LOGIN_ID"));

  const studentPerson = await admin
    .from("people")
    .select("id, login_id, role, auth_user_id")
    .eq("login_id", studentLoginId)
    .single();
  assert.ok(!studentPerson.error && studentPerson.data.role === "student");
  assert.equal(typeof studentPerson.data.auth_user_id, "string");

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
    .eq("student_id", studentPerson.data.id)
    .eq("attendance_date", today);
  assert.ok(!initialAttendance.error);
  assert.deepEqual(initialAttendance.data, [], "Development Student must start today unmarked.");
  const initialTokens = await admin.from("qr_tokens").select("id").order("id");
  assert.ok(!initialTokens.error);
  const initialActive = await admin
    .from("qr_tokens")
    .select("id")
    .eq("token_type", "attendance")
    .eq("is_active", true);
  assert.ok(!initialActive.error);
  assert.deepEqual(initialActive.data, [], "The shared QR integration test requires no active session.");

  context.after(async () => {
    await admin.rpc("stop_attendance_qr_session");
    const restored = await admin.rpc("update_attendance_schedule", scheduleParameters(originalSchedule));
    assert.ok(!restored.error && restored.data === true, "Attendance schedule restoration failed.");

    if (tokenIds.length > 0) {
      const attendanceRows = await admin
        .from("attendance_daily")
        .select("id")
        .eq("student_id", studentPerson.data.id)
        .eq("attendance_date", today);
      assert.ok(!attendanceRows.error);
      const cleanup = await service.rpc("cleanup_synthetic_student_qr", {
        p_student_login_id: studentLoginId,
        p_attendance_date: today,
        p_token_ids: tokenIds,
        p_expected_attendance_count: attendanceRows.data.length,
        p_expected_token_count: tokenIds.length,
      });
      assert.ok(!cleanup.error, `QR cleanup failed: ${cleanup.error?.message ?? "unknown"}`);
      assert.deepEqual(cleanup.data, [{
        attendance_deleted: attendanceRows.data.length,
        tokens_deleted: tokenIds.length,
      }]);
    }

    const finalTokens = await admin.from("qr_tokens").select("id").order("id");
    assert.ok(!finalTokens.error);
    assert.deepEqual(finalTokens.data, initialTokens.data, "Synthetic shared QR credentials remain after cleanup.");
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
  const scheduleUpdate = await admin.rpc("update_attendance_schedule", scheduleParameters(testSchedule));
  assert.ok(!scheduleUpdate.error && scheduleUpdate.data === true);

  const studentStart = await student.rpc("start_attendance_qr_session");
  const studentGet = await student.rpc("get_attendance_qr_session");
  const studentStop = await student.rpc("stop_attendance_qr_session");
  const anonymousStart = await anonymous.rpc("start_attendance_qr_session");
  assert.ok(studentStart.error && studentGet.error && studentStop.error && anonymousStart.error);

  // Teacher starts the first shared session; Admin sees exactly the same QR.
  const teacherStarted = await sessionCall(teacher, "start_attendance_qr_session");
  assertActive(teacherStarted);
  tokenIds.push(teacherStarted.token_id);
  assert.equal(
    new Date(teacherStarted.expires_at).getTime() - new Date(teacherStarted.created_at).getTime(),
    300_000,
  );
  const adminSharedView = await sessionCall(admin, "get_attendance_qr_session");
  assertActive(adminSharedView);
  assert.equal(adminSharedView.session_id, teacherStarted.session_id);
  assert.equal(adminSharedView.token_id, teacherStarted.token_id);
  assert.equal(adminSharedView.token_value, teacherStarted.token_value);
  const activeCount = await admin
    .from("qr_tokens")
    .select("id")
    .eq("token_type", "attendance")
    .eq("is_active", true);
  assert.ok(!activeCount.error);
  assert.equal(activeCount.data.length, 1);

  const teacherStopped = await teacher.rpc("stop_attendance_qr_session");
  assert.ok(!teacherStopped.error && teacherStopped.data === true, "Teacher could not stop the shared session.");
  const scanWhileStopped = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(teacherStarted.token_value),
  });
  assert.ok(scanWhileStopped.error, "Student scan must fail while the session is stopped.");

  // Admin starts a new session; Teacher sees the same active credential.
  const adminStarted = await sessionCall(admin, "start_attendance_qr_session");
  assertActive(adminStarted);
  tokenIds.push(adminStarted.token_id);
  assert.notEqual(adminStarted.session_id, teacherStarted.session_id);
  assert.notEqual(adminStarted.token_value, teacherStarted.token_value);
  const teacherSharedView = await sessionCall(teacher, "get_attendance_qr_session");
  assertActive(teacherSharedView);
  assert.equal(teacherSharedView.token_id, adminStarted.token_id);
  assert.equal(teacherSharedView.token_value, adminStarted.token_value);

  const checkIn = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(adminStarted.token_value),
  });
  assert.ok(!checkIn.error, "Student could not scan the current active QR.");
  assert.equal(checkIn.data?.[0]?.action, "check_in");

  // Force only the test clock boundary, then let the normal staff read rotate.
  const expired = await service.rpc("expire_synthetic_attendance_qr", {
    p_token_id: adminStarted.token_id,
  });
  assert.ok(!expired.error && expired.data === true);
  const rotated = await sessionCall(teacher, "get_attendance_qr_session");
  assertActive(rotated);
  tokenIds.push(rotated.token_id);
  assert.equal(rotated.session_id, adminStarted.session_id, "Rotation must keep the shared session.");
  assert.notEqual(rotated.token_id, adminStarted.token_id);
  assert.notEqual(rotated.token_value, adminStarted.token_value);
  assert.equal(new Date(rotated.expires_at).getTime() - new Date(rotated.created_at).getTime(), 300_000);

  const previousAfterRotation = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(adminStarted.token_value),
  });
  assert.ok(previousAfterRotation.error, "Previous QR must fail after database rotation.");
  const currentAfterRotation = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(rotated.token_value),
  });
  assert.ok(!currentAfterRotation.error);
  assert.equal(currentAfterRotation.data?.[0]?.action, "check_out");

  const adminStopped = await admin.rpc("stop_attendance_qr_session");
  assert.ok(!adminStopped.error && adminStopped.data === true, "Admin could not stop the shared session.");
  const stoppedCurrent = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(rotated.token_value),
  });
  assert.ok(stoppedCurrent.error, "Stopped current QR must be rejected.");

  // Starting later creates a fresh session and a valid new shared QR.
  const restarted = await sessionCall(teacher, "start_attendance_qr_session");
  assertActive(restarted);
  tokenIds.push(restarted.token_id);
  assert.notEqual(restarted.session_id, adminStarted.session_id);
  assert.notEqual(restarted.token_value, rotated.token_value);
  const adminRestartView = await sessionCall(admin, "get_attendance_qr_session");
  assertActive(adminRestartView);
  assert.equal(adminRestartView.token_id, restarted.token_id);
  const restartScan = await student.rpc("submit_student_qr_attendance", {
    p_token_hash: digestAttendanceQrToken(restarted.token_value),
  });
  assert.ok(!restartScan.error, "The current QR from the restarted session must be valid.");
  assert.equal(restartScan.data?.[0]?.action, "completed");
  const finalTeacherStop = await teacher.rpc("stop_attendance_qr_session");
  assert.ok(!finalTeacherStop.error && finalTeacherStop.data === true);

  const hiddenCredential = await admin
    .from("qr_tokens")
    .select("token_hash, display_token, attendance_session_id")
    .eq("id", restarted.token_id);
  assert.ok(hiddenCredential.error, "Shared QR credentials must not be directly selectable.");
  const serviceQrRead = await service.from("qr_tokens").select("id");
  assert.ok(serviceQrRead.error, "Service role must retain no broad QR table access.");
  const attendanceRows = await admin
    .from("attendance_daily")
    .select("id, student_id, attendance_date, check_in_method, check_out_method")
    .eq("student_id", studentPerson.data.id)
    .eq("attendance_date", today);
  assert.ok(!attendanceRows.error);
  assert.equal(attendanceRows.data.length, 1);
  assert.equal(attendanceRows.data[0].student_id, studentPerson.data.id);
  assert.equal(attendanceRows.data[0].check_in_method, "qr");
  assert.equal(attendanceRows.data[0].check_out_method, "qr");
});
