import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/auth/types";
import {
  ATTENDANCE_HISTORY_PAGE_SIZE,
  ATTENDANCE_HISTORY_PDF_MAX_ROWS,
  mapAttendanceHistoryRow,
  normalizeAttendanceHistoryFilterForRole,
  type AttendanceHistoryDatabaseRow,
  type AttendanceHistoryFilter,
  type AttendanceHistoryRow,
} from "./history-model";

const HISTORY_COLUMNS = "id, student_id, attendance_date, student_login_id_snapshot, student_full_name_snapshot, student_class_name_snapshot, check_in_at, check_out_at, check_in_status, check_in_method, check_out_method, absence_category, absence_note";

type HistoryViewer = { id: string; role: AppRole };
type AttendanceClassRow = { class_name: string | null };

export type AttendanceHistoryPage = {
  rows: AttendanceHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export class AttendanceHistoryDataError extends Error {
  constructor() {
    super("attendance_history_data_failed");
    this.name = "AttendanceHistoryDataError";
  }
}

export class AttendanceReportTooLargeError extends Error {
  constructor(public readonly total: number) {
    super("attendance_report_too_large");
    this.name = "AttendanceReportTooLargeError";
  }
}

function assertViewer(viewer: HistoryViewer): void {
  if (viewer.role !== "admin" && viewer.role !== "teacher" && viewer.role !== "student") {
    throw new AttendanceHistoryDataError();
  }
}

function orderedAttendanceQuery(
  client: SupabaseClient,
  viewer: HistoryViewer,
  filter: AttendanceHistoryFilter,
  options: { count?: "exact"; head?: boolean } = {},
) {
  const normalized = normalizeAttendanceHistoryFilterForRole(filter, viewer.role);
  let selected = client
    .from("attendance_daily")
    .select(HISTORY_COLUMNS, options)
    .gte("attendance_date", normalized.startDate)
    .lte("attendance_date", normalized.endDate);
  if (normalized.className) {
    selected = selected.eq("student_class_name_snapshot", normalized.className);
  }
  if (viewer.role === "student") {
    selected = selected.eq("student_id", viewer.id);
  }
  return selected
    .order("attendance_date", { ascending: false })
    .order("student_class_name_snapshot", { ascending: true })
    .order("student_login_id_snapshot", { ascending: true });
}

export async function loadAttendanceHistoryPage(
  client: SupabaseClient,
  viewer: HistoryViewer,
  filter: AttendanceHistoryFilter,
  page: number,
): Promise<AttendanceHistoryPage> {
  assertViewer(viewer);
  let resolvedPage = page;
  let offset = (resolvedPage - 1) * ATTENDANCE_HISTORY_PAGE_SIZE;
  let result = await orderedAttendanceQuery(client, viewer, filter, { count: "exact" })
    .range(offset, offset + ATTENDANCE_HISTORY_PAGE_SIZE - 1);
  if (result.error || !result.data || result.count === null) {
    throw new AttendanceHistoryDataError();
  }
  const totalPages = Math.max(1, Math.ceil(result.count / ATTENDANCE_HISTORY_PAGE_SIZE));
  if (resolvedPage > totalPages) {
    resolvedPage = totalPages;
    offset = (resolvedPage - 1) * ATTENDANCE_HISTORY_PAGE_SIZE;
    result = await orderedAttendanceQuery(client, viewer, filter, { count: "exact" })
      .range(offset, offset + ATTENDANCE_HISTORY_PAGE_SIZE - 1);
    if (result.error || !result.data || result.count === null) {
      throw new AttendanceHistoryDataError();
    }
  }
  return {
    rows: (result.data as AttendanceHistoryDatabaseRow[]).map(mapAttendanceHistoryRow),
    total: result.count,
    page: resolvedPage,
    pageSize: ATTENDANCE_HISTORY_PAGE_SIZE,
    totalPages,
  };
}

export async function loadAttendanceReportRows(
  client: SupabaseClient,
  viewer: HistoryViewer,
  filter: AttendanceHistoryFilter,
): Promise<AttendanceHistoryRow[]> {
  assertViewer(viewer);
  const countResult = await orderedAttendanceQuery(client, viewer, filter, {
    count: "exact",
    head: true,
  });
  if (countResult.error || countResult.count === null) throw new AttendanceHistoryDataError();
  if (countResult.count > ATTENDANCE_HISTORY_PDF_MAX_ROWS) {
    throw new AttendanceReportTooLargeError(countResult.count);
  }

  const rows: AttendanceHistoryDatabaseRow[] = [];
  const batchSize = 1000;
  for (let offset = 0; offset < countResult.count; offset += batchSize) {
    const result = await orderedAttendanceQuery(client, viewer, filter)
      .range(offset, Math.min(offset + batchSize - 1, countResult.count - 1));
    if (result.error || !result.data) throw new AttendanceHistoryDataError();
    rows.push(...result.data as AttendanceHistoryDatabaseRow[]);
  }
  return rows.map(mapAttendanceHistoryRow);
}

export async function loadAttendanceHistoryClasses(
  client: SupabaseClient,
  viewer: HistoryViewer,
): Promise<string[]> {
  assertViewer(viewer);
  if (viewer.role === "student") return [];
  const { data, error } = viewer.role === "teacher"
    ? await client.rpc("get_teacher_attendance_roster")
    : await client
      .from("people")
      .select("class_name")
      .eq("role", "student")
      .eq("is_active", true)
      .not("class_name", "is", null)
      .limit(1000);
  if (error || !data) throw new AttendanceHistoryDataError();
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  return [...new Set(
    (data as AttendanceClassRow[])
      .map((row) => typeof row.class_name === "string" ? row.class_name.trim() : "")
      .filter(Boolean),
  )].sort(collator.compare);
}
