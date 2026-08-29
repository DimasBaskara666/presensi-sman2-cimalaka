import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildAttendanceQrUrl,
  digestAttendanceQrToken,
  generateAttendanceQrToken,
  isAttendanceQrToken,
} from "../lib/attendance/qr-token";
import {
  safeStudentQrError,
  successStudentQrResult,
} from "../lib/attendance/student-qr-model";

const qrMigrationUrl = new URL(
  "../supabase/migrations/20260825221000_student_qr_attendance.sql",
  import.meta.url,
);
const sharedSessionMigrationUrl = new URL(
  "../supabase/migrations/20260826100000_shared_attendance_qr_session.sql",
  import.meta.url,
);

test("QR tokens are opaque, random, fixed-size, and hashed for Student submission", () => {
  const first = generateAttendanceQrToken();
  const second = generateAttendanceQrToken();
  assert.match(first, /^qra_[A-Za-z0-9_-]{43}$/);
  assert.match(second, /^qra_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.equal(isAttendanceQrToken(first), true);
  assert.equal(isAttendanceQrToken("student=S001&time=06:30"), false);

  const digest = digestAttendanceQrToken(first);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, digestAttendanceQrToken(first));
});

test("QR URL contains only the opaque credential in the scan route", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://attendance.school.example";
  try {
    const token = generateAttendanceQrToken();
    const url = new URL(buildAttendanceQrUrl(token));
    assert.equal(url.origin, "https://attendance.school.example");
    assert.equal(url.pathname, "/student/scan");
    assert.equal(url.searchParams.get("token"), token);
    assert.deepEqual([...url.searchParams.keys()], ["token"]);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test("shared session is one database-locked QR with an exact five-minute lifetime", async () => {
  const sql = await readFile(sharedSessionMigrationUrl, "utf8");
  assert.match(sql, /pg_advisory_xact_lock\([\s\S]*shared-school-attendance-qr-session/);
  assert.match(sql, /where q\.token_type = 'attendance'[\s\S]*and q\.is_active[\s\S]*for update/);
  assert.match(sql, /p_issued_at \+ interval '5 minutes'/);
  assert.match(sql, /check \(qr_lifetime_seconds = 300\)/);
  assert.match(sql, /v_now timestamptz := clock_timestamp\(\)/);
  assert.match(sql, /attendance_session_id/);
  assert.match(sql, /display_token/);
  assert.doesNotMatch(sql, /teacher_id.*qr|one.*qr.*per.*teacher/i);
});

test("Admin and Teacher share start, refresh, rotation, and stop functions", async () => {
  const sql = await readFile(sharedSessionMigrationUrl, "utf8");
  for (const functionName of [
    "start_attendance_qr_session",
    "get_attendance_qr_session",
    "stop_attendance_qr_session",
  ]) {
    const body = sql.match(new RegExp(
      `create function public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`,
    ))?.[0] ?? "";
    assert.match(body, /current_user_role\(\)\) is distinct from 'admin'/);
    assert.match(body, /current_user_role\(\)\) is distinct from 'teacher'/);
    assert.match(sql, new RegExp(`grant execute on function public\\.${functionName}\\(\\) to authenticated`));
  }
  assert.match(sql, /update public\.qr_tokens[\s\S]*is_active = false/);
  assert.match(sql, /private\.issue_shared_attendance_qr/);
  assert.match(sql, /v_current\.attendance_session_id/);
});

test("old QR is database-rejected after expiry, rotation, or stop", async () => {
  const qrSql = await readFile(qrMigrationUrl, "utf8");
  const sharedSql = await readFile(sharedSessionMigrationUrl, "utf8");
  const submit = qrSql.match(
    /create function public\.submit_student_qr_attendance[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
  assert.match(submit, /v_now timestamptz := clock_timestamp\(\)/);
  assert.match(submit, /q\.token_hash = p_token_hash/);
  assert.match(submit, /v_token\.expires_at <= v_now/);
  assert.match(submit, /not v_token\.is_active/);
  assert.match(sharedSql, /set[\s\S]*is_active = false[\s\S]*deactivated_at/);
  assert.match(sharedSql, /create function public\.stop_attendance_qr_session/);
});

test("Student QR keeps identity server-derived and delegates to Attendance Core", async () => {
  const sql = await readFile(qrMigrationUrl, "utf8");
  const submit = sql.match(
    /create function public\.submit_student_qr_attendance[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
  assert.match(submit, /current_user_role\(\)\) is distinct from 'student'/);
  assert.match(submit, /v_student_id := private\.current_person_id\(\)/);
  assert.match(submit, /p\.auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(submit, /private\.apply_attendance_check_in\(/);
  assert.match(submit, /private\.apply_attendance_check_out\(/);
  assert.match(submit, /'completed'::text/);
  assert.doesNotMatch(submit, /p_student_id|p_event_at|p_attendance_date|p_status|p_actor_id/);
});

test("shared display actions and routes authorize both staff roles without exposing secrets", async () => {
  const actions = await readFile(
    new URL("../app/(protected)/admin/attendance-qr/actions.ts", import.meta.url),
    "utf8",
  );
  const serverBoundary = await readFile(
    new URL("../lib/attendance/shared-qr-session.ts", import.meta.url),
    "utf8",
  );
  const adminPage = await readFile(
    new URL("../app/(protected)/admin/attendance-qr/page.tsx", import.meta.url),
    "utf8",
  );
  const teacherPage = await readFile(
    new URL("../app/(protected)/teacher/attendance-qr/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(actions, /requireCurrentPerson\(\{ allowedRoles: \["admin", "teacher"\] \}\)/);
  assert.equal((actions.match(/allowedRoles: \["admin", "teacher"\]/g) ?? []).length, 3);
  assert.match(adminPage, /allowedRoles: \["admin"\]/);
  assert.match(teacherPage, /allowedRoles: \["teacher"\]/);
  assert.match(serverBoundary, /^import "server-only";/);
  assert.match(serverBoundary, /\.rpc\("start_attendance_qr_session"|functionName/);
  assert.match(serverBoundary, /\.rpc\("stop_attendance_qr_session"\)/);
  assert.doesNotMatch(actions + serverBoundary, /SUPABASE_SERVICE_ROLE_KEY|supabase\/admin|console\./);
  assert.doesNotMatch(actions, /token_value|tokenHash|p_token_hash/);
});

test("shared display refresh is automatic but database validity remains authoritative", async () => {
  const manager = await readFile(
    new URL("../app/(protected)/admin/attendance-qr/qr-manager.tsx", import.meta.url),
    "utf8",
  );
  assert.match(manager, /refreshAttendanceQrSessionAction/);
  assert.match(manager, /window\.setTimeout/);
  assert.match(manager, /Berganti otomatis/);
  assert.match(manager, /PostgreSQL menentukan QR aktif/);
});

test("QR grants keep session credentials and tables isolated", async () => {
  const qrSql = await readFile(qrMigrationUrl, "utf8");
  const sharedSql = await readFile(sharedSessionMigrationUrl, "utf8");
  const studentAction = await readFile(
    new URL("../app/(protected)/student/scan/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(qrSql, /revoke insert, update, delete on table public\.qr_tokens from anon, authenticated/);
  assert.match(qrSql, /revoke all on table public\.qr_tokens from service_role/);
  assert.match(sharedSql, /revoke select \(token_hash, attendance_session_id, display_token\)/);
  assert.doesNotMatch(sharedSql, /grant (insert|update|delete|all) on table public\.qr_tokens to authenticated/i);
  assert.match(studentAction, /requireCurrentPerson\(\{ allowedRoles: \["student"\] \}\)/);
  assert.doesNotMatch(studentAction, /studentId|attendanceDate|attendanceTime|p_event_at|p_method/);
});

test("safe QR results distinguish expiry, revocation, stopped state, and success", () => {
  assert.match(safeStudentQrError({ message: "qr_expired" }), /kedaluwarsa/i);
  assert.match(safeStudentQrError({ message: "qr_revoked" }), /tidak valid/i);
  assert.match(safeStudentQrError({ message: "attendance_checkout_too_early" }), /check-out/i);
  assert.deepEqual(successStudentQrResult({
    action: "check_in",
    occurredAt: "2026-08-25T06:30:00+07:00",
    status: "on_time",
  }), {
    ok: true,
    action: "check_in",
    occurredAt: "2026-08-25T06:30:00+07:00",
    status: "on_time",
    message: "Berhasil presensi masuk.",
  });
});
