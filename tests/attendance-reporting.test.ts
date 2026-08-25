import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ATTENDANCE_HISTORY_MAX_RANGE_DAYS,
  ATTENDANCE_HISTORY_PAGE_SIZE,
  ATTENDANCE_HISTORY_PDF_MAX_ROWS,
  canViewAttendanceHistory,
  mapAttendanceHistoryRow,
  normalizeAttendanceHistoryFilterForRole,
  parseAttendanceHistoryFilter,
  parseAttendanceHistoryPage,
  type AttendanceHistoryDatabaseRow,
  type AttendanceHistoryRow,
} from "../lib/attendance/history-model";
import { generateAttendanceHistoryPdf } from "../lib/attendance/history-pdf";
import type { AppRole } from "../lib/auth/types";

const today = "2026-08-26";

function databaseRow(overrides: Partial<AttendanceHistoryDatabaseRow> = {}): AttendanceHistoryDatabaseRow {
  return {
    id: "attendance-1",
    student_id: "student-1",
    attendance_date: "2026-08-25",
    student_login_id_snapshot: "ZST001",
    student_full_name_snapshot: "Synthetic Report Student",
    student_class_name_snapshot: "XII-A",
    check_in_at: "2026-08-24T23:40:00.000Z",
    check_out_at: "2026-08-25T08:05:00.000Z",
    check_in_status: "late",
    check_in_method: "qr",
    check_out_method: "manual",
    absence_category: null,
    absence_note: null,
    ...overrides,
  };
}

function pdfText(buffer: Buffer): string {
  const source = buffer.toString("latin1");
  return [...source.matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("");
}

test("history filters default to today and validate date order and maximum range", () => {
  assert.deepEqual(parseAttendanceHistoryFilter({}, today), {
    ok: true,
    filter: { startDate: today, endDate: today, className: null },
    error: null,
  });
  assert.equal(parseAttendanceHistoryFilter({ start: "2026-02-30", end: today }, today).ok, false);
  assert.equal(parseAttendanceHistoryFilter({ start: today, end: "2026-08-25" }, today).ok, false);
  assert.equal(parseAttendanceHistoryFilter({ start: "2026-07-27", end: today }, today).ok, true);
  const tooLong = parseAttendanceHistoryFilter({ start: "2026-07-26", end: today }, today);
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.error ?? "", new RegExp(String(ATTENDANCE_HISTORY_MAX_RANGE_DAYS)));
});

test("class filters are trimmed and removed from Student scope", () => {
  const parsed = parseAttendanceHistoryFilter({ className: "  XII-A  " }, today);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.filter.className, "XII-A");
  assert.equal(normalizeAttendanceHistoryFilterForRole(parsed.filter, "teacher").className, "XII-A");
  assert.equal(normalizeAttendanceHistoryFilterForRole(parsed.filter, "admin").className, "XII-A");
  assert.equal(normalizeAttendanceHistoryFilterForRole(parsed.filter, "student").className, null);
  assert.equal(parseAttendanceHistoryFilter({ className: "A".repeat(101) }, today).ok, false);
});

test("pagination is bounded and role authorization is explicit", () => {
  assert.equal(ATTENDANCE_HISTORY_PAGE_SIZE, 40);
  assert.equal(ATTENDANCE_HISTORY_PDF_MAX_ROWS, 5000);
  assert.equal(parseAttendanceHistoryPage("2"), 2);
  assert.equal(parseAttendanceHistoryPage("0"), 1);
  assert.equal(parseAttendanceHistoryPage("not-a-page"), 1);
  assert.equal(canViewAttendanceHistory("admin"), true);
  assert.equal(canViewAttendanceHistory("teacher"), true);
  assert.equal(canViewAttendanceHistory("student"), true);
  assert.equal(canViewAttendanceHistory("anonymous" as AppRole), false);
});

test("report mapping uses historical snapshots and maps status, reason, and method", () => {
  const presence = mapAttendanceHistoryRow(databaseRow());
  assert.equal(presence.studentLoginId, "ZST001");
  assert.equal(presence.studentName, "Synthetic Report Student");
  assert.equal(presence.className, "XII-A");
  assert.equal(presence.status, "Terlambat");
  assert.equal(presence.absenceReason, "-");
  assert.equal(presence.method, "Masuk QR / Pulang Manual");

  const absence = mapAttendanceHistoryRow(databaseRow({
    check_in_at: null,
    check_out_at: null,
    check_in_status: null,
    check_in_method: null,
    check_out_method: null,
    absence_category: "sick",
    absence_note: "Surat dokter",
  }));
  assert.equal(absence.status, "Sakit");
  assert.equal(absence.absenceReason, "Sakit: Surat dokter");
  assert.equal(absence.method, "Manual");
});

test("history query is snapshot-based, server-filtered, paginated, and Student-isolated", async () => {
  const querySource = await readFile(new URL("../lib/attendance/history-query.ts", import.meta.url), "utf8");
  assert.match(querySource, /student_login_id_snapshot/);
  assert.match(querySource, /student_full_name_snapshot/);
  assert.match(querySource, /student_class_name_snapshot/);
  assert.match(querySource, /gte\("attendance_date", normalized\.startDate\)/);
  assert.match(querySource, /lte\("attendance_date", normalized\.endDate\)/);
  assert.match(querySource, /eq\("student_class_name_snapshot", normalized\.className\)/);
  assert.match(querySource, /viewer\.role === "student"[\s\S]*eq\("student_id", viewer\.id\)/);
  assert.match(querySource, /viewer\.role === "teacher"[\s\S]*rpc\("get_teacher_attendance_roster"\)/);
  assert.match(querySource, /\.range\(offset, offset \+ ATTENDANCE_HISTORY_PAGE_SIZE - 1\)/);
  assert.doesNotMatch(querySource, /auth_user_id|claim_code_digest|SUPABASE_SERVICE_ROLE_KEY/);
});

test("page and PDF route enforce server authorization without service credentials", async () => {
  const pageSource = await readFile(new URL("../app/(protected)/attendance/history/page.tsx", import.meta.url), "utf8");
  const routeSource = await readFile(new URL("../app/(protected)/attendance/history/pdf/route.ts", import.meta.url), "utf8");
  assert.match(pageSource, /requireCurrentPerson\(\{ allowedRoles: \["admin", "teacher", "student"\] \}\)/);
  assert.match(routeSource, /const person = await getCurrentPerson\(\)/);
  assert.match(routeSource, /if \(!person\).*401/);
  assert.match(routeSource, /Content-Disposition/);
  assert.match(routeSource, /application\/pdf/);
  assert.doesNotMatch(pageSource + routeSource, /SUPABASE_SERVICE_ROLE_KEY|supabase\/admin/);
});

test("server PDF contains mapped report fields and handles empty results", async () => {
  const mapped = mapAttendanceHistoryRow(databaseRow());
  const input = {
    filter: { startDate: "2026-08-25", endDate: "2026-08-25", className: "XII-A" },
    generatedAt: new Date("2026-08-26T03:00:00.000Z"),
    viewerRole: "teacher" as const,
  };
  const pdf = await generateAttendanceHistoryPdf({ ...input, rows: [mapped] });
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(pdf.length > 3000);
  const text = pdfText(pdf);
  for (const expected of [
    "SMAN 2 Cimalaka",
    "Synthetic Report Student",
    "ZST001",
    "XII-A",
    "Terlambat",
    "Masuk QR / Pulang Manual",
  ]) {
    assert.ok(text.includes(expected), `Generated PDF did not contain ${expected}.`);
  }

  const empty = await generateAttendanceHistoryPdf({ ...input, rows: [] as AttendanceHistoryRow[] });
  assert.equal(empty.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.match(pdfText(empty), /Tidak ada data presensi/);
});
