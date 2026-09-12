import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hasCapability } from "../lib/auth/permissions";
import {
  deriveAttendanceStatus,
  getSchoolDate,
  summarizeTeacherAttendance,
} from "../lib/attendance/teacher-attendance-model";

const readSource = (relativePath: string) => readFile(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8",
);

test("Teacher route is server-protected and loads only today's class attendance", async () => {
  const [page, data] = await Promise.all([
    readSource("app/(protected)/teacher/page.tsx"),
    readSource("lib/attendance/teacher-attendance.ts"),
  ]);
  assert.match(page, /requireCurrentPerson\(\{ allowedRoles: \["teacher"\] \}\)/);
  assert.doesNotMatch(page, /allowedRoles: \[[^\]]*admin/);
  assert.match(page, /name="class"/);
  assert.match(data, /\.rpc\("get_teacher_attendance_roster"\)/);
  assert.match(data, /\.eq\("attendance_date", today\)/);
  assert.match(data, /student\.class_name\?\.trim\(\) === selectedClass/);
  assert.equal(hasCapability("teacher", "access_teacher_operations"), true);
  assert.equal(hasCapability("admin", "access_teacher_operations"), false);
  assert.equal(hasCapability("student", "access_teacher_operations"), false);
});

test("Teacher roster reader is narrow, role-checked, and does not weaken people RLS", async () => {
  const [migration, importMigration] = await Promise.all([
    readSource("supabase/migrations/20260825210000_teacher_attendance_roster.sql"),
    readSource("supabase/migrations/20260825000000_student_import.sql"),
  ]);
  assert.match(importMigration, /create policy people_select_own_or_admin/);
  assert.match(migration, /create function public\.get_teacher_attendance_roster\(\)/);
  assert.match(migration, /current_user_role\(\)\) is distinct from 'teacher'/);
  assert.match(migration, /select p\.id, p\.login_id, p\.full_name, p\.class_name/);
  assert.match(migration, /p\.role = 'student'[\s\S]*p\.is_active/);
  assert.doesNotMatch(migration, /auth_user_id|claim_code|nisn|must_change_password/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, service_role/);
  assert.doesNotMatch(migration, /drop policy|alter policy|disable row level security/i);
});

test("Teacher actions verify role and use only controlled Attendance Core transactions", async () => {
  const actions = await readSource("app/(protected)/teacher/actions.ts");
  const guards = actions.match(/requireCurrentPerson\(\{ allowedRoles: \["teacher"\] \}\)/g) ?? [];
  assert.equal(guards.length, 2);
  assert.match(actions, /^"use server";/);
  assert.match(actions, /rpc\("record_manual_check_in"/);
  assert.match(actions, /rpc\("record_manual_absence"/);
  assert.match(actions, /rpc\("record_manual_check_out"/);
  assert.doesNotMatch(actions, /\.from\("attendance_daily"\)/);
  assert.doesNotMatch(actions, /correct_attendance/);
  assert.doesNotMatch(actions, /p_attendance_date|p_check_in_at|p_check_out_at/);
  assert.doesNotMatch(actions, /attendanceDate|attendance_date|eventAt|timestamp/i);
});

test("attendance display maps every approved status and summarizes it correctly", () => {
  assert.equal(deriveAttendanceStatus(null), "unmarked");
  assert.equal(deriveAttendanceStatus({
    check_in_at: "2026-08-25T06:45:00+07:00",
    check_in_status: "on_time",
    absence_category: null,
  }), "on_time");
  assert.equal(deriveAttendanceStatus({
    check_in_at: "2026-08-25T06:45:00.001+07:00",
    check_in_status: "late",
    absence_category: null,
  }), "late");
  for (const absence of ["sick", "permission", "absent", "dispensation"] as const) {
    assert.equal(deriveAttendanceStatus({
      check_in_at: null,
      check_in_status: null,
      absence_category: absence,
    }), absence);
  }

  assert.deepEqual(summarizeTeacherAttendance([
    { status: "on_time" },
    { status: "late" },
    { status: "sick" },
    { status: "permission" },
    { status: "absent" },
    { status: "dispensation" },
    { status: "unmarked" },
  ]), {
    total: 7,
    present: 1,
    late: 1,
    sick: 1,
    permission: 1,
    absent: 1,
    dispensation: 1,
    unmarked: 1,
  });
});

test("school date is deterministic in Asia/Jakarta and not browser-provided", () => {
  assert.equal(getSchoolDate(new Date("2026-08-24T16:59:59.999Z")), "2026-08-24");
  assert.equal(getSchoolDate(new Date("2026-08-24T17:00:00.000Z")), "2026-08-25");
});

test("mobile Teacher cards expose large status actions, selected state, notes, and feedback", async () => {
  const [board, page, css] = await Promise.all([
    readSource("app/(protected)/teacher/attendance-board.tsx"),
    readSource("app/(protected)/teacher/page.tsx"),
    readSource("app/globals.css"),
  ]);
  for (const label of ["Hadir", "Sakit", "Izin", "Alfa", "Disp."]) {
    assert.match(board, new RegExp(`label: "${label.replace(".", "\\.")}"`));
  }
  assert.match(board, /aria-pressed=\{selected\}/);
  assert.match(board, /disabled=\{pending/);
  assert.match(board, /maxLength=\{200\}/);
  assert.match(board, /Menyimpan…/);
  assert.match(board, /Catat pulang/);
  assert.match(page, /attendance-summary/);
  for (const key of ["total", "present", "late", "sick", "permission", "absent", "dispensation", "unmarked"]) {
    assert.match(page, new RegExp(`key: "${key}"`));
  }
  assert.match(css, /\.attendance-summary[\s\S]*overflow-x: auto/);
  assert.match(css, /\.attendance-mark-button[\s\S]*min-height: 2\.75rem/);
  assert.match(css, /\.attendance-actions[\s\S]*grid-template-columns: repeat\(3/);
});

test("database uniqueness and idempotent RPC remain the duplicate boundary", async () => {
  const [foundation, migration, actions] = await Promise.all([
    readSource("supabase/migrations/20260820000000_foundation.sql"),
    readSource("supabase/migrations/20260825200000_attendance_core.sql"),
    readSource("app/(protected)/teacher/actions.ts"),
  ]);
  assert.match(foundation, /attendance_daily_student_date_unique unique \(student_id, attendance_date\)/);
  assert.match(migration, /on conflict \(student_id, attendance_date\) do nothing/);
  assert.match(migration, /if v_existing\.check_in_at is not null then return v_existing\.id/);
  assert.match(actions, /record_manual_check_in/);
  assert.doesNotMatch(actions, /insert\s+into\s+public\.attendance_daily/i);
});
