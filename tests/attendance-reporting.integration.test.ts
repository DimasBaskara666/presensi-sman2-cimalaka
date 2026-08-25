import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeLoginId } from "../lib/auth/login-id";
import {
  loadAttendanceHistoryClasses,
  loadAttendanceHistoryPage,
  loadAttendanceReportRows,
} from "../lib/attendance/history-query";
import { generateAttendanceHistoryPdf } from "../lib/attendance/history-pdf";
import type { AttendanceHistoryFilter } from "../lib/attendance/history-model";
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
  if (!value) throw new Error(`${name} is required for the Attendance reporting integration test.`);
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

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isoDay(date: string): number {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function previousMonday(today: string): string {
  let date = addDays(today, -14);
  while (isoDay(date) !== 1) date = addDays(date, -1);
  return date;
}

async function findUnusedSchoolWeek(
  admin: SupabaseClient,
  studentId: string,
  today: string,
): Promise<[string, string]> {
  let monday = previousMonday(today);
  for (let attempt = 0; attempt < 52; attempt += 1) {
    const tuesday = addDays(monday, 1);
    const existing = await admin
      .from("attendance_daily")
      .select("id")
      .eq("student_id", studentId)
      .in("attendance_date", [monday, tuesday]);
    assert.ok(!existing.error);
    if (existing.data.length === 0) return [monday, tuesday];
    monday = addDays(monday, -7);
  }
  throw new Error("No unused historical school week was available for the reporting fixture.");
}

function localTimestamp(date: string, time: string): string {
  return `${date}T${time}+07:00`;
}

function pdfText(buffer: Buffer): string {
  const source = buffer.toString("latin1");
  return [...source.matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("");
}

async function authUserCount(service: SupabaseClient): Promise<number> {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ok(!error, "Supabase Auth users could not be counted.");
  return data.users.length;
}

test("Attendance history and PDF are filtered, snapshot-based, role-isolated, and cleanable", { skip: !isConfigured }, async (context) => {
  const service = client(required("SUPABASE_SERVICE_ROLE_KEY"));
  const admin = await signIn(required("DEV_ADMIN_LOGIN_ID"), [
    process.env.DEV_ADMIN_NEW_PASSWORD ?? "",
    process.env.DEV_ADMIN_PASSWORD ?? "",
  ]);
  const teacher = await signIn(required("DEV_TEACHER_LOGIN_ID"), [required("DEV_TEACHER_RESET_PASSWORD")]);
  const student = await signIn(required("DEV_STUDENT_LOGIN_ID"), [required("DEV_STUDENT_PASSWORD")]);
  const anonymous = client(required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const initialAuthCount = await authUserCount(service);
  const today = getSchoolDate();

  const people = await admin
    .from("people")
    .select("id, login_id, role, auth_user_id")
    .in("login_id", [
      normalizeLoginId(required("DEV_ADMIN_LOGIN_ID")),
      normalizeLoginId(required("DEV_TEACHER_LOGIN_ID")),
      normalizeLoginId(required("DEV_STUDENT_LOGIN_ID")),
    ]);
  assert.ok(!people.error);
  const adminPerson = people.data.find((person) => person.role === "admin");
  const teacherPerson = people.data.find((person) => person.role === "teacher");
  const developmentStudent = people.data.find((person) => person.role === "student");
  assert.ok(adminPerson && teacherPerson && developmentStudent);

  const initialAttendance = await admin.from("attendance_daily").select("id").order("id");
  assert.ok(!initialAttendance.error);
  const [monday, tuesday] = await findUnusedSchoolWeek(admin, developmentStudent.id, today);
  const dates = [monday, tuesday];

  const prefix = `ZSTRP${Date.now().toString(36).toUpperCase()}`;
  const reportStudentLoginId = `${prefix}01`;
  const imported = await service.rpc("import_student_roster", {
    p_students: [{
      login_id: reportStudentLoginId,
      full_name: "Synthetic Integration Student Attendance Reporting",
      class_name: "SYN-REPORT",
      nis: reportStudentLoginId,
      nisn: null,
    }],
  });
  assert.ok(!imported.error, "Synthetic reporting Student could not be imported.");
  const reportStudent = await admin
    .from("people")
    .select("id, login_id")
    .eq("login_id", reportStudentLoginId)
    .single();
  assert.ok(!reportStudent.error);

  context.after(async () => {
    for (const fixture of [
      { loginId: developmentStudent.login_id, id: developmentStudent.id },
      { loginId: reportStudentLoginId, id: reportStudent.data.id },
    ]) {
      const rows = await admin
        .from("attendance_daily")
        .select("id")
        .eq("student_id", fixture.id)
        .in("attendance_date", dates);
      assert.ok(!rows.error);
      const cleaned = await service.rpc("cleanup_synthetic_attendance_core", {
        p_student_login_id: fixture.loginId,
        p_attendance_dates: dates,
        p_expected_count: rows.data.length,
      });
      assert.ok(!cleaned.error, `Reporting attendance cleanup failed: ${cleaned.error?.message ?? "unknown"}`);
      assert.equal(cleaned.data, rows.data.length);
    }
    const studentCleanup = await service.rpc("cleanup_synthetic_student_import", {
      p_prefix: prefix,
      p_expected_count: 1,
    });
    assert.ok(!studentCleanup.error);
    assert.equal(studentCleanup.data, 1);
    const finalAttendance = await admin.from("attendance_daily").select("id").order("id");
    assert.ok(!finalAttendance.error);
    assert.deepEqual(finalAttendance.data, initialAttendance.data);
    assert.equal(await authUserCount(service), initialAuthCount);
    await Promise.all([admin.auth.signOut(), teacher.auth.signOut(), student.auth.signOut()]);
  });

  const developmentPresence = await admin.rpc("correct_attendance", {
    p_student_id: developmentStudent.id,
    p_attendance_date: monday,
    p_check_in_at: localTimestamp(monday, "06:40:00"),
    p_check_out_at: localTimestamp(monday, "15:05:00"),
    p_absence_category: null,
    p_absence_note: null,
    p_reason: "Synthetic reporting presence fixture",
  });
  assert.ok(!developmentPresence.error);
  const reportAbsence = await admin.rpc("correct_attendance", {
    p_student_id: reportStudent.data.id,
    p_attendance_date: tuesday,
    p_check_in_at: null,
    p_check_out_at: null,
    p_absence_category: "sick",
    p_absence_note: "Synthetic reporting illness",
    p_reason: "Synthetic reporting absence fixture",
  });
  assert.ok(!reportAbsence.error);

  const allFilter: AttendanceHistoryFilter = { startDate: monday, endDate: tuesday, className: null };
  const adminHistory = await loadAttendanceHistoryPage(
    admin,
    { id: adminPerson.id, role: "admin" },
    allFilter,
    1,
  );
  assert.ok(adminHistory.total >= 2);
  const adminReportRows = await loadAttendanceReportRows(
    admin,
    { id: adminPerson.id, role: "admin" },
    allFilter,
  );
  const fixtureRows = adminReportRows.filter((row) =>
    row.studentLoginId === developmentStudent.login_id || row.studentLoginId === reportStudentLoginId
  );
  assert.deepEqual(new Set(fixtureRows.map((row) => row.studentLoginId)), new Set([
    developmentStudent.login_id,
    reportStudentLoginId,
  ]));
  assert.ok(fixtureRows.every((row) => row.studentName.startsWith("Synthetic")));

  const teacherHistory = await loadAttendanceHistoryPage(
    teacher,
    { id: teacherPerson.id, role: "teacher" },
    allFilter,
    1,
  );
  assert.ok(teacherHistory.total >= 2);
  const teacherReportRows = await loadAttendanceReportRows(
    teacher,
    { id: teacherPerson.id, role: "teacher" },
    allFilter,
  );
  assert.ok(teacherReportRows.some((row) => row.studentLoginId === developmentStudent.login_id));
  assert.ok(teacherReportRows.some((row) => row.studentLoginId === reportStudentLoginId));
  const teacherClasses = await loadAttendanceHistoryClasses(
    teacher,
    { id: teacherPerson.id, role: "teacher" },
  );
  assert.ok(teacherClasses.includes("SYN-REPORT"));
  const adminClasses = await loadAttendanceHistoryClasses(
    admin,
    { id: adminPerson.id, role: "admin" },
  );
  assert.ok(adminClasses.includes("SYN-REPORT"));
  const teacherClassHistory = await loadAttendanceHistoryPage(
    teacher,
    { id: teacherPerson.id, role: "teacher" },
    { ...allFilter, className: "SYN-REPORT" },
    1,
  );
  assert.equal(teacherClassHistory.total, 1);
  assert.equal(teacherClassHistory.rows[0].studentLoginId, reportStudentLoginId);
  assert.equal(teacherClassHistory.rows[0].status, "Sakit");
  assert.equal(teacherClassHistory.rows[0].absenceReason, "Sakit: Synthetic reporting illness");

  const studentHistory = await loadAttendanceHistoryPage(
    student,
    { id: developmentStudent.id, role: "student" },
    { ...allFilter, className: "SYN-REPORT" },
    1,
  );
  assert.equal(studentHistory.total, 1, "Student class manipulation must not expose another Student.");
  assert.equal(studentHistory.rows[0].studentLoginId, developmentStudent.login_id);
  const studentCrossRead = await student
    .from("attendance_daily")
    .select("id")
    .eq("student_id", reportStudent.data.id);
  assert.ok(!studentCrossRead.error);
  assert.deepEqual(studentCrossRead.data, []);

  await assert.rejects(
    loadAttendanceHistoryPage(anonymous, { id: adminPerson.id, role: "admin" }, allFilter, 1),
  );

  const reportRows = teacherReportRows;
  assert.ok(reportRows.length >= 2);
  const pdf = await generateAttendanceHistoryPdf({
    rows: reportRows,
    filter: allFilter,
    generatedAt: new Date("2026-08-26T03:00:00.000Z"),
    viewerRole: "teacher",
  });
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(pdf.length > 4000);
  const extracted = pdfText(pdf);
  for (const expected of [
    developmentStudent.login_id,
    reportStudentLoginId,
    "Synthetic Integration Student Attendance Reporting",
    "SYN-REPORT",
    "Synthetic reporting illness",
    "Sakit",
    "Manual",
  ]) {
    assert.ok(extracted.includes(expected), `Live PDF did not contain ${expected}.`);
  }
});
