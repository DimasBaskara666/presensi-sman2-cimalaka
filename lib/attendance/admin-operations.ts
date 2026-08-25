import "server-only";
import {
  mapAttendanceHistoryRow,
  type AttendanceHistoryDatabaseRow,
  type AttendanceHistoryRow,
} from "./history-model";
import {
  jakartaTimeInputValue,
  lateToleranceMinutes,
  type AttendanceCorrectionSearchFilter,
} from "./admin-operations-model";
import { createClient } from "@/lib/supabase/server";

const ATTENDANCE_COLUMNS = "id, student_id, attendance_date, student_login_id_snapshot, student_full_name_snapshot, student_class_name_snapshot, check_in_at, check_out_at, check_in_status, check_in_method, check_out_method, absence_category, absence_note";

export type AdminAttendanceSettings = {
  timezone: string;
  officialStartTime: string;
  onTimeCutoff: string;
  lateToleranceMinutes: number;
  lateAttendanceAllowed: boolean;
  mondayThursdayCheckoutMinimum: string;
  fridayCheckoutMinimum: string;
};

export type AttendanceCorrectionRecord = AttendanceHistoryRow & {
  checkInTimeInput: string;
  checkOutTimeInput: string;
  absenceCategory: string | null;
  absenceNote: string | null;
};

export type AttendanceCorrectionSearchView = {
  rows: AttendanceCorrectionRecord[];
  classes: string[];
  matchedCount: number;
  truncated: boolean;
};

export class AdminAttendanceOperationsError extends Error {
  constructor() {
    super("admin_attendance_operations_failed");
    this.name = "AdminAttendanceOperationsError";
  }
}

function toCorrectionRecord(row: AttendanceHistoryDatabaseRow): AttendanceCorrectionRecord {
  return {
    ...mapAttendanceHistoryRow(row),
    checkInTimeInput: jakartaTimeInputValue(row.check_in_at),
    checkOutTimeInput: jakartaTimeInputValue(row.check_out_at),
    absenceCategory: row.absence_category,
    absenceNote: row.absence_note,
  };
}

export async function loadAdminAttendanceSettings(): Promise<AdminAttendanceSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_settings")
    .select("timezone, official_start_time, on_time_cutoff, late_attendance_allowed, monday_checkout_minimum, tuesday_checkout_minimum, wednesday_checkout_minimum, thursday_checkout_minimum, friday_checkout_minimum")
    .eq("id", 1)
    .single();
  if (error || !data) throw new AdminAttendanceOperationsError();
  return {
    timezone: data.timezone,
    officialStartTime: data.official_start_time,
    onTimeCutoff: data.on_time_cutoff,
    lateToleranceMinutes: lateToleranceMinutes(data.official_start_time, data.on_time_cutoff),
    lateAttendanceAllowed: data.late_attendance_allowed,
    mondayThursdayCheckoutMinimum: data.monday_checkout_minimum,
    fridayCheckoutMinimum: data.friday_checkout_minimum,
  };
}

export async function loadAttendanceCorrectionSearch(
  filter: AttendanceCorrectionSearchFilter,
): Promise<AttendanceCorrectionSearchView> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_daily")
    .select(ATTENDANCE_COLUMNS)
    .eq("attendance_date", filter.date)
    .order("student_class_name_snapshot")
    .order("student_login_id_snapshot")
    .limit(1000);
  if (error || !data) throw new AdminAttendanceOperationsError();
  const rawRows = data as AttendanceHistoryDatabaseRow[];
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  const classes = [...new Set(rawRows.map((row) => row.student_class_name_snapshot))]
    .sort(collator.compare);
  const normalizedQuery = filter.studentQuery.toLocaleLowerCase("id-ID");
  const matched = rawRows.filter((row) => {
    const matchesClass = !filter.className || row.student_class_name_snapshot === filter.className;
    const matchesStudent = !normalizedQuery ||
      row.student_login_id_snapshot.toLocaleLowerCase("id-ID").includes(normalizedQuery) ||
      row.student_full_name_snapshot.toLocaleLowerCase("id-ID").includes(normalizedQuery);
    return matchesClass && matchesStudent;
  });
  return {
    rows: matched.slice(0, 100).map(toCorrectionRecord),
    classes,
    matchedCount: matched.length,
    truncated: matched.length > 100,
  };
}

export async function loadAttendanceCorrectionRecord(
  recordId: string,
): Promise<AttendanceCorrectionRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_daily")
    .select(ATTENDANCE_COLUMNS)
    .eq("id", recordId)
    .maybeSingle();
  if (error) throw new AdminAttendanceOperationsError();
  return data ? toCorrectionRecord(data as AttendanceHistoryDatabaseRow) : null;
}
