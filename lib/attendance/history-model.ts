/**
 * Presensi SMAN 2 Cimalaka
 * © 2026 Dimas Bratakusumah
 * Institut Teknologi Nasional Bandung
 */

import type { AppRole } from "@/lib/auth/types";

export const ATTENDANCE_HISTORY_PAGE_SIZE = 40;
export const ATTENDANCE_HISTORY_MAX_RANGE_DAYS = 31;
export const ATTENDANCE_HISTORY_PDF_MAX_ROWS = 5000;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type AttendanceHistoryFilter = {
  startDate: string;
  endDate: string;
  className: string | null;
};

export type AttendanceHistoryFilterResult =
  | { ok: true; filter: AttendanceHistoryFilter; error: null }
  | { ok: false; filter: AttendanceHistoryFilter; error: string };

export type AttendanceHistoryDatabaseRow = {
  id: string;
  student_id: string;
  attendance_date: string;
  student_login_id_snapshot: string;
  student_full_name_snapshot: string;
  student_class_name_snapshot: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_status: string | null;
  check_in_method: string | null;
  check_out_method: string | null;
  absence_category: string | null;
  absence_note: string | null;
};

export type AttendanceHistoryRow = {
  id: string;
  studentId: string;
  date: string;
  studentLoginId: string;
  studentName: string;
  className: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  absenceReason: string;
  method: string;
};

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function inclusiveDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function parseAttendanceHistoryFilter(
  input: { start?: unknown; end?: unknown; className?: unknown },
  schoolToday: string,
): AttendanceHistoryFilterResult {
  const startDate = typeof input.start === "string" && input.start.trim()
    ? input.start.trim()
    : schoolToday;
  const endDate = typeof input.end === "string" && input.end.trim()
    ? input.end.trim()
    : schoolToday;
  const rawClass = typeof input.className === "string" ? input.className.trim() : "";
  const fallback = { startDate: schoolToday, endDate: schoolToday, className: null };

  if (!isRealIsoDate(startDate) || !isRealIsoDate(endDate)) {
    return { ok: false, filter: fallback, error: "Format tanggal tidak valid." };
  }
  if (startDate > endDate) {
    return { ok: false, filter: fallback, error: "Tanggal mulai tidak boleh setelah tanggal akhir." };
  }
  if (inclusiveDays(startDate, endDate) > ATTENDANCE_HISTORY_MAX_RANGE_DAYS) {
    return {
      ok: false,
      filter: fallback,
      error: `Rentang laporan maksimal ${ATTENDANCE_HISTORY_MAX_RANGE_DAYS} hari.`,
    };
  }
  if (rawClass.length > 100 || hasControlCharacters(rawClass)) {
    return { ok: false, filter: fallback, error: "Filter kelas tidak valid." };
  }
  return {
    ok: true,
    filter: { startDate, endDate, className: rawClass || null },
    error: null,
  };
}

export function normalizeAttendanceHistoryFilterForRole(
  filter: AttendanceHistoryFilter,
  role: AppRole,
): AttendanceHistoryFilter {
  return role === "student" ? { ...filter, className: null } : filter;
}

export function parseAttendanceHistoryPage(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 10_000 ? parsed : 1;
}

function absenceLabel(value: string | null): string | null {
  if (value === "sick") return "Sakit";
  if (value === "permission") return "Izin";
  if (value === "absent") return "Alfa";
  if (value === "dispensation") return "Dispensasi";
  return null;
}

function attendanceMethodLabel(value: string | null): string | null {
  if (value === "qr") return "QR";
  if (value === "manual") return "Manual";
  return null;
}

export function mapAttendanceHistoryRow(row: AttendanceHistoryDatabaseRow): AttendanceHistoryRow {
  const absence = absenceLabel(row.absence_category);
  const status = row.check_in_status === "on_time"
    ? "Tepat Waktu"
    : row.check_in_status === "late"
      ? "Terlambat"
      : absence ?? "Tidak diketahui";
  const checkInMethod = attendanceMethodLabel(row.check_in_method);
  const checkOutMethod = attendanceMethodLabel(row.check_out_method);
  const method = absence
    ? "Manual"
    : checkInMethod && checkOutMethod && checkInMethod !== checkOutMethod
      ? `Masuk ${checkInMethod} / Pulang ${checkOutMethod}`
      : checkInMethod ?? checkOutMethod ?? "-";
  const note = row.absence_note?.trim() ?? "";

  return {
    id: row.id,
    studentId: row.student_id,
    date: row.attendance_date,
    studentLoginId: row.student_login_id_snapshot,
    studentName: row.student_full_name_snapshot,
    className: row.student_class_name_snapshot,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    status,
    absenceReason: absence ? `${absence}${note ? `: ${note}` : ""}` : "-",
    method,
  };
}

export function formatAttendanceHistoryDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatAttendanceHistoryTime(value: string | null): string {
  if (!value) return "-";
  return `${new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value))} WIB`;
}

export function canViewAttendanceHistory(role: AppRole): boolean {
  return role === "admin" || role === "teacher" || role === "student";
}
