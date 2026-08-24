import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeLoginId } from "../lib/auth/login-id";

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
const isConfigured =
  hasAdminPassword && requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Attendance Core integration test.`);
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

function jakartaNow(): { date: string; time: string; isoDay: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  return { date, time: `${part("hour")}:${part("minute")}:${part("second")}`, isoDay: isoDay(date) };
}

function localTimestamp(date: string, time: string): string {
  return `${date}T${time}+07:00`;
}

function previousTestWeek(today: string): {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
} {
  let monday = addDays(today, -14);
  while (isoDay(monday) !== 1) monday = addDays(monday, -1);
  return {
    monday,
    tuesday: addDays(monday, 1),
    wednesday: addDays(monday, 2),
    thursday: addDays(monday, 3),
    friday: addDays(monday, 4),
    saturday: addDays(monday, 5),
  };
}

test("Attendance Core enforces schedule, role, RLS, snapshots, and correction audit", { skip: !isConfigured }, async (context) => {
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

  const devStudentLoginId = normalizeLoginId(required("DEV_STUDENT_LOGIN_ID"));
  const people = await admin
    .from("people")
    .select("id, login_id, full_name, class_name, role, auth_user_id")
    .in("login_id", [
      normalizeLoginId(required("DEV_ADMIN_LOGIN_ID")),
      normalizeLoginId(required("DEV_TEACHER_LOGIN_ID")),
      devStudentLoginId,
    ]);
  assert.ok(!people.error, "Development people fixtures could not be loaded.");
  const developmentStudent = people.data.find((person) => person.login_id === devStudentLoginId);
  assert.ok(developmentStudent && developmentStudent.role === "student");
  assert.equal(typeof developmentStudent.auth_user_id, "string");

  const settings = await admin
    .from("attendance_settings")
    .select("timezone, official_start_time, on_time_cutoff, monday_checkout_minimum, tuesday_checkout_minimum, wednesday_checkout_minimum, thursday_checkout_minimum, friday_checkout_minimum")
    .eq("id", 1)
    .single();
  assert.ok(!settings.error, "Attendance settings could not be loaded.");
  assert.deepEqual(settings.data, {
    timezone: "Asia/Jakarta",
    official_start_time: "06:30:00",
    on_time_cutoff: "06:45:00",
    monday_checkout_minimum: "15:00:00",
    tuesday_checkout_minimum: "15:00:00",
    wednesday_checkout_minimum: "15:00:00",
    thursday_checkout_minimum: "15:00:00",
    friday_checkout_minimum: "13:00:00",
  });
  const directSettingsUpdate = await admin
    .from("attendance_settings")
    .update({ official_start_time: "06:30:00" })
    .eq("id", 1);
  assert.ok(directSettingsUpdate.error, "Admin settings updates must use the validated function.");

  const current = jakartaNow();
  const week = previousTestWeek(current.date);
  const cleanupDates = [...new Set([
    week.monday,
    week.tuesday,
    week.wednesday,
    week.thursday,
    week.friday,
    week.saturday,
    current.date,
  ])];
  const preexisting = await admin
    .from("attendance_daily")
    .select("id")
    .eq("student_id", developmentStudent.id)
    .in("attendance_date", cleanupDates);
  assert.ok(!preexisting.error);
  assert.deepEqual(preexisting.data, [], "Integration dates must not overlap existing attendance.");

  const privacyPrefix = `ZSTAC${Date.now().toString(36).toUpperCase()}`;
  const privacyLoginId = `${privacyPrefix}01`;
  const privacyImport = await service.rpc("import_student_roster", {
    p_students: [{
      login_id: privacyLoginId,
      full_name: "Synthetic Integration Student Attendance Privacy",
      class_name: "SYN-ATT-PRIVACY",
      nis: privacyLoginId,
      nisn: null,
    }],
  });
  assert.ok(!privacyImport.error, "Temporary cross-Student fixture could not be imported.");
  assert.deepEqual(privacyImport.data, [{ inserted_count: 1, updated_count: 0, unchanged_count: 0 }]);
  const privacyPerson = await admin
    .from("people")
    .select("id")
    .eq("login_id", privacyLoginId)
    .single();
  assert.ok(!privacyPerson.error, "Temporary cross-Student fixture could not be read.");

  context.after(async () => {
    for (const fixture of [
      { loginId: devStudentLoginId, studentId: developmentStudent.id },
      { loginId: privacyLoginId, studentId: privacyPerson.data.id },
    ]) {
      const rows = await admin
        .from("attendance_daily")
        .select("id")
        .eq("student_id", fixture.studentId)
        .in("attendance_date", cleanupDates);
      assert.ok(!rows.error, "Attendance cleanup count could not be read.");
      const cleanup = await service.rpc("cleanup_synthetic_attendance_core", {
        p_student_login_id: fixture.loginId,
        p_attendance_dates: cleanupDates,
        p_expected_count: rows.data.length,
      });
      assert.ok(!cleanup.error, "Synthetic Attendance Core records could not be cleaned.");
      assert.equal(cleanup.data, rows.data.length);
    }
    const privacyCleanup = await service.rpc("cleanup_synthetic_student_import", {
      p_prefix: privacyPrefix,
      p_expected_count: 1,
    });
    assert.ok(!privacyCleanup.error, "Temporary cross-Student person cleanup failed.");
    assert.equal(privacyCleanup.data, 1);
    await Promise.all([admin.auth.signOut(), teacher.auth.signOut(), student.auth.signOut()]);
  });

  const correct = (input: {
    studentId: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    absence: "sick" | "permission" | "absent" | "dispensation" | null;
    note: string | null;
    reason: string;
  }) => admin.rpc("correct_attendance", {
    p_student_id: input.studentId,
    p_attendance_date: input.date,
    p_check_in_at: input.checkIn,
    p_check_out_at: input.checkOut,
    p_absence_category: input.absence,
    p_absence_note: input.note,
    p_reason: input.reason,
  });

  const beforeEntry = await correct({
    studentId: developmentStudent.id,
    date: week.monday,
    checkIn: localTimestamp(week.monday, "06:29:59.999"),
    checkOut: null,
    absence: null,
    note: null,
    reason: "Synthetic early boundary rejection",
  });
  assert.ok(beforeEntry.error, "A check-in before 06:30 must be rejected.");

  const monday = await correct({
    studentId: developmentStudent.id,
    date: week.monday,
    checkIn: localTimestamp(week.monday, "06:45:00.000"),
    checkOut: localTimestamp(week.monday, "15:00:00.000"),
    absence: null,
    note: null,
    reason: "Synthetic exact Monday boundary",
  });
  assert.ok(!monday.error, "The exact Monday boundary correction failed.");

  const tuesdayLate = await correct({
    studentId: developmentStudent.id,
    date: week.tuesday,
    checkIn: localTimestamp(week.tuesday, "06:45:00.001"),
    checkOut: null,
    absence: null,
    note: null,
    reason: "Synthetic first late instant",
  });
  assert.ok(!tuesdayLate.error, "The first late instant correction failed.");

  const wednesdayAbsence = await correct({
    studentId: developmentStudent.id,
    date: week.wednesday,
    checkIn: null,
    checkOut: null,
    absence: "sick",
    note: "Synthetic illness",
    reason: "Synthetic absence creation",
  });
  assert.ok(!wednesdayAbsence.error, "The synthetic absence correction failed.");

  const thursdayEarlyCheckout = await correct({
    studentId: developmentStudent.id,
    date: week.thursday,
    checkIn: localTimestamp(week.thursday, "06:30:00.000"),
    checkOut: localTimestamp(week.thursday, "14:59:59.999"),
    absence: null,
    note: null,
    reason: "Synthetic early checkout rejection",
  });
  assert.ok(thursdayEarlyCheckout.error, "Checkout before 15:00 must be rejected.");

  const friday = await correct({
    studentId: developmentStudent.id,
    date: week.friday,
    checkIn: localTimestamp(week.friday, "06:30:00.000"),
    checkOut: localTimestamp(week.friday, "13:00:00.000"),
    absence: null,
    note: null,
    reason: "Synthetic exact Friday boundary",
  });
  assert.ok(!friday.error, "The exact Friday boundary correction failed.");

  const weekend = await correct({
    studentId: developmentStudent.id,
    date: week.saturday,
    checkIn: null,
    checkOut: null,
    absence: "absent",
    note: null,
    reason: "Synthetic weekend rejection",
  });
  assert.ok(weekend.error, "Weekend attendance must be rejected.");

  const privacyAttendance = await correct({
    studentId: privacyPerson.data.id,
    date: week.wednesday,
    checkIn: null,
    checkOut: null,
    absence: "permission",
    note: "Synthetic privacy fixture",
    reason: "Synthetic cross-Student RLS fixture",
  });
  assert.ok(!privacyAttendance.error, "Cross-Student RLS fixture attendance could not be created.");

  const boundaryRows = await admin
    .from("attendance_daily")
    .select("id, student_id, attendance_date, check_in_at, check_out_at, check_in_status, check_in_method, absence_category, student_login_id_snapshot, student_full_name_snapshot, student_class_name_snapshot")
    .in("student_id", [developmentStudent.id, privacyPerson.data.id])
    .in("attendance_date", cleanupDates)
    .order("attendance_date");
  assert.ok(!boundaryRows.error, "Boundary records could not be read.");
  assert.equal(boundaryRows.data.length, 5);
  const mondayRow = boundaryRows.data.find(
    (row) => row.student_id === developmentStudent.id && row.attendance_date === week.monday,
  );
  const tuesdayRow = boundaryRows.data.find(
    (row) => row.student_id === developmentStudent.id && row.attendance_date === week.tuesday,
  );
  assert.equal(mondayRow?.check_in_status, "on_time");
  assert.equal(mondayRow?.check_in_method, "manual");
  assert.ok(mondayRow?.check_out_at);
  assert.equal(tuesdayRow?.check_in_status, "late");
  assert.equal(mondayRow?.student_login_id_snapshot, developmentStudent.login_id);
  assert.equal(mondayRow?.student_full_name_snapshot, developmentStudent.full_name);
  assert.equal(mondayRow?.student_class_name_snapshot, developmentStudent.class_name);
  assert.equal(
    boundaryRows.data.some(
      (row) => row.student_id === developmentStudent.id && row.attendance_date === week.thursday,
    ),
    false,
    "Rejected checkout must leave the date unmarked.",
  );

  const correctedTuesday = await correct({
    studentId: developmentStudent.id,
    date: week.tuesday,
    checkIn: localTimestamp(week.tuesday, "06:45:00.000"),
    checkOut: null,
    absence: null,
    note: null,
    reason: "Synthetic correction to exact cutoff",
  });
  assert.ok(!correctedTuesday.error, "Existing attendance correction failed.");
  const correctedTuesdayRow = await admin
    .from("attendance_daily")
    .select("check_in_status, student_login_id_snapshot, student_full_name_snapshot, student_class_name_snapshot")
    .eq("student_id", developmentStudent.id)
    .eq("attendance_date", week.tuesday)
    .single();
  assert.ok(!correctedTuesdayRow.error);
  assert.equal(correctedTuesdayRow.data.check_in_status, "on_time");
  assert.equal(correctedTuesdayRow.data.student_login_id_snapshot, developmentStudent.login_id);

  const adminCorrections = await admin
    .from("attendance_corrections")
    .select("attendance_id, corrected_by, reason, before_data, after_data")
    .in("attendance_id", boundaryRows.data.map((row) => row.id));
  assert.ok(!adminCorrections.error, "Admin correction audit could not be read.");
  assert.equal(adminCorrections.data.length, 6);
  assert.ok(adminCorrections.data.every((row) => row.corrected_by !== null && row.reason.length > 0));
  assert.ok(adminCorrections.data.some((row) => Object.keys(row.before_data).length > 0));

  const teacherCorrections = await teacher.from("attendance_corrections").select("id");
  assert.ok(!teacherCorrections.error);
  assert.deepEqual(teacherCorrections.data, []);
  const teacherCorrectionAttempt = await teacher.rpc("correct_attendance", {
    p_student_id: developmentStudent.id,
    p_attendance_date: week.monday,
    p_check_in_at: localTimestamp(week.monday, "06:45:00.000"),
    p_check_out_at: localTimestamp(week.monday, "15:00:00.000"),
    p_absence_category: null,
    p_absence_note: null,
    p_reason: "Teacher must not correct",
  });
  assert.ok(teacherCorrectionAttempt.error);

  const studentManualAttempt = await student.rpc("record_manual_absence", {
    p_student_id: developmentStudent.id,
    p_category: "absent",
    p_note: null,
  });
  assert.ok(studentManualAttempt.error, "Student must not call staff attendance functions.");
  const anonymousRead = await anonymous.from("attendance_daily").select("id");
  assert.ok(anonymousRead.error, "Anonymous attendance reads must be denied.");
  const serviceRead = await service.from("attendance_daily").select("id");
  assert.ok(serviceRead.error, "Service role must retain no broad direct attendance-table grant.");
  const serviceCorrectionRead = await service.from("attendance_corrections").select("id");
  assert.ok(serviceCorrectionRead.error, "Service role must not bypass the correction audit API.");
  const teacherDirectInsert = await teacher.from("attendance_daily").insert({
    student_id: developmentStudent.id,
    attendance_date: week.thursday,
  });
  assert.ok(teacherDirectInsert.error, "Authenticated direct attendance inserts must be denied.");

  const studentPrivacyRead = await student
    .from("attendance_daily")
    .select("id")
    .eq("student_id", privacyPerson.data.id);
  assert.ok(!studentPrivacyRead.error);
  assert.deepEqual(studentPrivacyRead.data, []);
  const teacherPrivacyRead = await teacher
    .from("attendance_daily")
    .select("id")
    .eq("student_id", privacyPerson.data.id);
  assert.ok(!teacherPrivacyRead.error);
  assert.equal(teacherPrivacyRead.data.length, 1);

  if (current.isoDay <= 5) {
    const recordedAtStart = Date.now();
    const todayAbsence = await teacher.rpc("record_manual_absence", {
      p_student_id: developmentStudent.id,
      p_category: "permission",
      p_note: "Synthetic operational attendance",
    });
    assert.ok(!todayAbsence.error, "Teacher today-only absence failed on a weekday.");
    const todayRow = await teacher
      .from("attendance_daily")
      .select("id, absence_category, absence_recorded_at")
      .eq("student_id", developmentStudent.id)
      .eq("attendance_date", current.date)
      .single();
    assert.ok(!todayRow.error);
    assert.equal(todayRow.data.absence_category, "permission");
    assert.ok(new Date(todayRow.data.absence_recorded_at).getTime() >= recordedAtStart - 5000);

    if (current.time >= "06:30:00") {
      const checkIn = await teacher.rpc("record_manual_check_in", {
        p_student_id: developmentStudent.id,
      });
      assert.ok(!checkIn.error, "Teacher database-clock check-in failed after entry time.");
      const checkedIn = await teacher
        .from("attendance_daily")
        .select("id, check_in_at, check_in_status, check_in_method, check_in_recorded_by, absence_category")
        .eq("student_id", developmentStudent.id)
        .eq("attendance_date", current.date)
        .single();
      assert.ok(!checkedIn.error);
      assert.equal(checkedIn.data.absence_category, null);
      assert.equal(checkedIn.data.check_in_method, "manual");
      assert.ok(checkedIn.data.check_in_at);
      const firstTimestamp = checkedIn.data.check_in_at;
      const duplicate = await teacher.rpc("record_manual_check_in", {
        p_student_id: developmentStudent.id,
      });
      assert.ok(!duplicate.error);
      assert.equal(duplicate.data, checkedIn.data.id);
      const afterDuplicate = await teacher
        .from("attendance_daily")
        .select("check_in_at")
        .eq("id", checkedIn.data.id)
        .single();
      assert.equal(afterDuplicate.data?.check_in_at, firstTimestamp);

      const minimum = current.isoDay === 5 ? "13:00:00" : "15:00:00";
      const checkOut = await teacher.rpc("record_manual_check_out", {
        p_student_id: developmentStudent.id,
      });
      if (current.time >= minimum) {
        assert.ok(!checkOut.error, "Teacher checkout failed after the weekday minimum.");
      } else {
        assert.ok(checkOut.error, "Teacher checkout must fail before the weekday minimum.");
      }
    } else {
      const checkIn = await teacher.rpc("record_manual_check_in", {
        p_student_id: developmentStudent.id,
      });
      assert.ok(checkIn.error, "Teacher check-in must fail before 06:30.");
    }
  } else {
    const weekendAbsence = await teacher.rpc("record_manual_absence", {
      p_student_id: developmentStudent.id,
      p_category: "absent",
      p_note: null,
    });
    assert.ok(weekendAbsence.error, "Teacher weekend attendance must be rejected.");
  }

  const visibleToStudent = await student
    .from("attendance_daily")
    .select("student_id")
    .eq("student_id", developmentStudent.id);
  assert.ok(!visibleToStudent.error);
  assert.ok(visibleToStudent.data.length >= 4);
  assert.ok(visibleToStudent.data.every((row) => row.student_id === developmentStudent.id));
});
