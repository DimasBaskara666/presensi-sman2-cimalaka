import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeLoginId } from "../lib/auth/login-id";
import {
  deriveAttendanceStatus,
  getSchoolDate,
} from "../lib/attendance/teacher-attendance-model";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true);

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_EMAIL_DOMAIN",
  "DEV_TEACHER_LOGIN_ID",
  "DEV_TEACHER_RESET_PASSWORD",
  "DEV_STUDENT_LOGIN_ID",
  "DEV_STUDENT_PASSWORD",
] as const;

const isConfigured = requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Teacher attendance integration test.`);
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

async function signIn(loginId: string, password: string): Promise<SupabaseClient> {
  const authenticated = client(required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const { error } = await authenticated.auth.signInWithPassword({
    email: syntheticEmail(loginId),
    password,
  });
  if (error) throw new Error("A required development role could not sign in.");
  return authenticated;
}

function isoDay(date: string): number {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function jakartaTime(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}:${part("second")}`;
}

test("Teacher UI transactions are today-only, role-protected, visible, and idempotent", { skip: !isConfigured }, async (context) => {
  const today = getSchoolDate();
  if (isoDay(today) > 5) {
    context.skip("Normal Teacher attendance is intentionally unavailable on weekends.");
    return;
  }

  const service = client(required("SUPABASE_SERVICE_ROLE_KEY"));
  const teacher = await signIn(
    required("DEV_TEACHER_LOGIN_ID"),
    required("DEV_TEACHER_RESET_PASSWORD"),
  );
  const student = await signIn(
    required("DEV_STUDENT_LOGIN_ID"),
    required("DEV_STUDENT_PASSWORD"),
  );

  const prefix = `ZSTTA${Date.now().toString(36).toUpperCase()}`;
  const loginId = `${prefix}01`;
  const className = "SYN-TEACHER-ATTENDANCE";
  const imported = await service.rpc("import_student_roster", {
    p_students: [{
      login_id: loginId,
      full_name: "Synthetic Integration Student Attendance Teacher UI",
      class_name: className,
      nis: loginId,
      nisn: null,
    }],
  });
  assert.ok(!imported.error, "Temporary Teacher attendance Student could not be imported.");
  assert.deepEqual(imported.data, [{ inserted_count: 1, updated_count: 0, unchanged_count: 0 }]);

  const hiddenDirectRoster = await teacher
    .from("people")
    .select("id")
    .eq("login_id", loginId)
    .eq("role", "student");
  assert.ok(!hiddenDirectRoster.error);
  assert.deepEqual(hiddenDirectRoster.data, [], "Direct people-table roster reads must remain hidden.");
  const roster = await teacher.rpc("get_teacher_attendance_roster");
  assert.ok(!roster.error, "Teacher could not load the controlled active Student roster.");
  const rosterStudent = roster.data.find((row: { login_id: string }) => row.login_id === loginId);
  assert.ok(rosterStudent, "Controlled Teacher roster did not include the synthetic Student.");
  assert.equal(rosterStudent.class_name, className);

  const studentRosterAttempt = await student.rpc("get_teacher_attendance_roster");
  assert.ok(studentRosterAttempt.error, "Student must not use the Teacher roster function.");

  context.after(async () => {
    const rows = await teacher
      .from("attendance_daily")
      .select("id")
      .eq("student_id", rosterStudent.id)
      .eq("attendance_date", today);
    assert.ok(!rows.error, "Teacher attendance cleanup count could not be read.");
    const attendanceCleanup = await service.rpc("cleanup_synthetic_attendance_core", {
      p_student_login_id: loginId,
      p_attendance_dates: [today],
      p_expected_count: rows.data.length,
    });
    assert.ok(!attendanceCleanup.error, "Temporary Teacher attendance row cleanup failed.");
    assert.equal(attendanceCleanup.data, rows.data.length);
    const studentCleanup = await service.rpc("cleanup_synthetic_student_import", {
      p_prefix: prefix,
      p_expected_count: 1,
    });
    assert.ok(!studentCleanup.error, "Temporary Teacher attendance Student cleanup failed.");
    assert.equal(studentCleanup.data, 1);
    await Promise.all([teacher.auth.signOut(), student.auth.signOut()]);
  });

  const initialAttendance = await teacher
    .from("attendance_daily")
    .select("id")
    .eq("student_id", rosterStudent.id)
    .eq("attendance_date", today);
  assert.ok(!initialAttendance.error);
  assert.deepEqual(initialAttendance.data, []);

  const studentAttempt = await student.rpc("record_manual_absence", {
    p_student_id: rosterStudent.id,
    p_category: "permission",
    p_note: "Student must not record Teacher attendance",
  });
  assert.ok(studentAttempt.error, "Student must not use Teacher attendance transactions.");
  const teacherDirectInsert = await teacher.from("attendance_daily").insert({
    student_id: rosterStudent.id,
    attendance_date: today,
  });
  assert.ok(teacherDirectInsert.error, "Teacher must not write directly to attendance_daily.");

  const recordedAtStart = Date.now();
  const first = await teacher.rpc("record_manual_absence", {
    p_student_id: rosterStudent.id,
    p_category: "permission",
    p_note: "Synthetic Teacher UI attendance",
  });
  assert.ok(!first.error, "Teacher could not record today's attendance.");
  const repeated = await teacher.rpc("record_manual_absence", {
    p_student_id: rosterStudent.id,
    p_category: "permission",
    p_note: "Synthetic Teacher UI attendance",
  });
  assert.ok(!repeated.error, "Repeated Teacher attendance action failed.");
  assert.equal(repeated.data, first.data, "Repeated action must return the same daily record.");

  const afterAbsence = await teacher
    .from("attendance_daily")
    .select("id, student_id, attendance_date, check_in_at, check_in_status, check_in_method, absence_category, absence_note, absence_recorded_at")
    .eq("student_id", rosterStudent.id)
    .eq("attendance_date", today);
  assert.ok(!afterAbsence.error);
  assert.equal(afterAbsence.data.length, 1, "Repeated action must not create a duplicate daily row.");
  assert.equal(afterAbsence.data[0].absence_note, "Synthetic Teacher UI attendance");
  assert.ok(new Date(afterAbsence.data[0].absence_recorded_at).getTime() >= recordedAtStart - 5000);
  assert.equal(deriveAttendanceStatus(afterAbsence.data[0]), "permission");

  const studentCrossRead = await student
    .from("attendance_daily")
    .select("id")
    .eq("student_id", rosterStudent.id);
  assert.ok(!studentCrossRead.error);
  assert.deepEqual(studentCrossRead.data, [], "Student must not see another Student's attendance.");

  if (jakartaTime() >= "06:30:00") {
    const checkIn = await teacher.rpc("record_manual_check_in", {
      p_student_id: rosterStudent.id,
    });
    assert.ok(!checkIn.error, "Teacher could not replace today's absence with presence.");
    const repeatedCheckIn = await teacher.rpc("record_manual_check_in", {
      p_student_id: rosterStudent.id,
    });
    assert.ok(!repeatedCheckIn.error);
    assert.equal(repeatedCheckIn.data, checkIn.data);

    const presentRow = await teacher
      .from("attendance_daily")
      .select("id, check_in_at, check_in_status, check_in_method, absence_category")
      .eq("student_id", rosterStudent.id)
      .eq("attendance_date", today)
      .single();
    assert.ok(!presentRow.error);
    assert.equal(presentRow.data.check_in_method, "manual");
    assert.equal(presentRow.data.absence_category, null);
    assert.ok(["on_time", "late"].includes(deriveAttendanceStatus(presentRow.data)));
  }
});
