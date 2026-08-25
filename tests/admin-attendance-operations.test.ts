import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isAttendanceRecordId,
  parseAttendanceCorrectionMutation,
  parseAttendanceCorrectionSearch,
  parseAttendanceSettingsMutation,
} from "../lib/attendance/admin-operations-model";

const today = "2026-08-26";
const recordId = "11111111-1111-4111-8111-111111111111";

test("Admin attendance settings derive the exact cutoff and validate schedule order", () => {
  const result = parseAttendanceSettingsMutation({
    officialStartTime: "06:30",
    lateToleranceMinutes: "15",
    mondayThursdayCheckoutMinimum: "15:00",
    fridayCheckoutMinimum: "13:00",
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      officialStartTime: "06:30:00",
      onTimeCutoff: "06:45:00",
      mondayThursdayCheckoutMinimum: "15:00:00",
      fridayCheckoutMinimum: "13:00:00",
      lateToleranceMinutes: 15,
    },
    error: null,
  });
  assert.equal(parseAttendanceSettingsMutation({
    officialStartTime: "06:30",
    lateToleranceMinutes: "fifteen",
    mondayThursdayCheckoutMinimum: "15:00",
    fridayCheckoutMinimum: "13:00",
  }).ok, false);
  assert.equal(parseAttendanceSettingsMutation({
    officialStartTime: "06:30",
    lateToleranceMinutes: "15",
    mondayThursdayCheckoutMinimum: "06:45",
    fridayCheckoutMinimum: "13:00",
  }).ok, false);
});

test("correction search defaults safely and validates date and text filters", () => {
  assert.deepEqual(parseAttendanceCorrectionSearch({}, today), {
    ok: true,
    filter: { date: today, className: "", studentQuery: "" },
    error: null,
  });
  assert.equal(parseAttendanceCorrectionSearch({
    date: "2026-08-25",
    className: "  XII-A ",
    studentQuery: "  ZST001 ",
  }, today).filter.className, "XII-A");
  assert.equal(parseAttendanceCorrectionSearch({ date: "2026-02-30" }, today).ok, false);
  assert.equal(parseAttendanceCorrectionSearch({ studentQuery: "A".repeat(101) }, today).ok, false);
});

test("presence correction creates Asia/Jakarta timestamps and excludes absence data", () => {
  const result = parseAttendanceCorrectionMutation({
    recordId,
    attendanceDate: "2026-08-24",
    mode: "presence",
    checkInTime: "06:30:00",
    checkOutTime: "15:00:00",
    absenceCategory: "sick",
    absenceNote: "must be discarded",
    reason: "Correct scanner failure",
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      recordId,
      checkInAt: "2026-08-23T23:30:00.000Z",
      checkOutAt: "2026-08-24T08:00:00.000Z",
      absenceCategory: null,
      absenceNote: null,
      reason: "Correct scanner failure",
    },
    error: null,
  });
});

test("absence correction excludes timestamps and requires a valid reason and category", () => {
  const result = parseAttendanceCorrectionMutation({
    recordId,
    attendanceDate: "2026-08-24",
    mode: "absence",
    checkInTime: "06:30",
    absenceCategory: "permission",
    absenceNote: "School letter",
    reason: "Correct supporting document",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.checkInAt, null);
    assert.equal(result.value.checkOutAt, null);
    assert.equal(result.value.absenceCategory, "permission");
    assert.equal(result.value.absenceNote, "School letter");
  }
  assert.equal(parseAttendanceCorrectionMutation({
    recordId,
    attendanceDate: "2026-08-24",
    mode: "absence",
    absenceCategory: "absent",
    reason: " ",
  }).ok, false);
  assert.equal(parseAttendanceCorrectionMutation({
    recordId,
    attendanceDate: "2026-08-24",
    mode: "absence",
    absenceCategory: "holiday",
    reason: "Invalid category",
  }).ok, false);
  assert.equal(isAttendanceRecordId("not-a-uuid"), false);
});

test("settings and correction actions are Admin-only RPC boundaries without direct writes", async () => {
  const settingsAction = await readFile(
    new URL("../app/(protected)/admin/attendance-settings/actions.ts", import.meta.url),
    "utf8",
  );
  const correctionAction = await readFile(
    new URL("../app/(protected)/admin/attendance-corrections/actions.ts", import.meta.url),
    "utf8",
  );
  for (const source of [settingsAction, correctionAction]) {
    assert.match(source, /^"use server";/);
    assert.match(source, /requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|createAdminClient/);
    assert.doesNotMatch(source, /\.update\(|\.insert\(|\.upsert\(|\.delete\(/);
  }
  assert.match(settingsAction, /\.rpc\("update_attendance_schedule"/);
  assert.match(settingsAction, /\.select\("timezone, late_attendance_allowed"\)/);
  assert.match(correctionAction, /\.select\("id, student_id, attendance_date"\)/);
  assert.match(correctionAction, /attendanceDate: existing\.data\.attendance_date/);
  assert.match(correctionAction, /p_student_id: existing\.data\.student_id/);
  assert.match(correctionAction, /\.rpc\("correct_attendance"/);
});

test("Admin pages enforce role checks and expose no identity mutation fields", async () => {
  const settingsPage = await readFile(
    new URL("../app/(protected)/admin/attendance-settings/page.tsx", import.meta.url),
    "utf8",
  );
  const correctionPage = await readFile(
    new URL("../app/(protected)/admin/attendance-corrections/page.tsx", import.meta.url),
    "utf8",
  );
  for (const source of [settingsPage, correctionPage]) {
    assert.match(source, /requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/);
  }
  assert.doesNotMatch(correctionPage, /name="student_id"|name="attendance_date"|name="student_.*snapshot"/);
  assert.match(correctionPage, /name="reason"[^>]*required/);
  assert.match(correctionPage, /Data sebelum dan sesudah koreksi dicatat otomatis/);
});
