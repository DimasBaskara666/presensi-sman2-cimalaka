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

const migrationUrl = new URL(
  "../supabase/migrations/20260825221000_student_qr_attendance.sql",
  import.meta.url,
);

test("QR tokens are opaque, random, fixed-size, and hashed before storage", () => {
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
  assert.equal(digest.includes(first), false);
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

test("safe QR results distinguish expiry, revocation, schedule, and success", () => {
  assert.match(safeStudentQrError({ message: "qr_expired" }), /kedaluwarsa/i);
  assert.match(safeStudentQrError({ message: "qr_revoked" }), /tidak valid/i);
  assert.match(safeStudentQrError({ message: "qr_invalid" }), /tidak valid/i);
  assert.match(safeStudentQrError({ message: "attendance_checkout_too_early" }), /check-out/i);
  assert.match(safeStudentQrError({ message: "attendance_account_inactive" }), /tidak aktif/i);

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
  assert.equal(successStudentQrResult({ action: "check_in", occurredAt: null, status: "on_time" }), null);
});

test("Student QR transaction owns authorization, token state, identity, and time", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const submit = sql.match(
    /create function public\.submit_student_qr_attendance[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";

  assert.match(submit, /current_user_role\(\)\) is distinct from 'student'/);
  assert.match(submit, /v_student_id := private\.current_person_id\(\)/);
  assert.match(submit, /p\.auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(submit, /v_now timestamptz := clock_timestamp\(\)/);
  assert.match(submit, /q\.token_hash = p_token_hash/);
  assert.match(submit, /q\.token_type = 'attendance'/);
  assert.match(submit, /v_token\.expires_at <= v_now/);
  assert.match(submit, /not v_token\.is_active/);
  assert.match(submit, /for share/);
  assert.doesNotMatch(submit, /p_student_id|p_event_at|p_attendance_date|p_status|p_method|p_actor_id/);
});

test("QR delegates to Attendance Core with method qr and safe repeated-state handling", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const submit = sql.match(
    /create function public\.submit_student_qr_attendance[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
  assert.match(submit, /private\.apply_attendance_check_in\(/);
  assert.match(submit, /private\.apply_attendance_check_out\(/);
  assert.equal((submit.match(/'qr'/g) ?? []).length, 2);
  assert.match(submit, /for update/);
  assert.match(submit, /'completed'::text/);
  assert.doesNotMatch(submit, /v_status :=|on_time_cutoff|checkout_minimum|official_start_time/);
});

test("QR grants and application actions keep tables and secrets isolated", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const studentAction = await readFile(
    new URL("../app/(protected)/student/scan/actions.ts", import.meta.url),
    "utf8",
  );
  const adminAction = await readFile(
    new URL("../app/(protected)/admin/attendance-qr/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(sql, /grant execute on function public\.submit_student_qr_attendance\(text\)[\s\S]*to authenticated/);
  assert.match(sql, /revoke insert, update, delete on table public\.qr_tokens from anon, authenticated/);
  assert.match(sql, /revoke all on table public\.qr_tokens from service_role/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all) on table public\.qr_tokens to authenticated/i);
  assert.match(studentAction, /requireCurrentPerson\(\{ allowedRoles: \["student"\] \}\)/);
  assert.match(adminAction, /requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/);
  assert.doesNotMatch(studentAction, /SUPABASE_SERVICE_ROLE_KEY|supabase\/admin|console\./);
  assert.doesNotMatch(adminAction, /SUPABASE_SERVICE_ROLE_KEY|supabase\/admin|console\./);
  assert.doesNotMatch(studentAction, /studentId|attendanceDate|attendanceTime|p_event_at|p_method/);
  assert.doesNotMatch(adminAction, /tokenHash.*return|token\s*:/i);
});
