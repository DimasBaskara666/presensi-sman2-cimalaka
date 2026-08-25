export const ATTENDANCE_CORRECTION_ABSENCE_CATEGORIES = [
  "sick",
  "permission",
  "absent",
  "dispensation",
] as const;

export type AttendanceCorrectionAbsenceCategory =
  (typeof ATTENDANCE_CORRECTION_ABSENCE_CATEGORIES)[number];

export type AttendanceSettingsMutation = {
  officialStartTime: string;
  onTimeCutoff: string;
  mondayThursdayCheckoutMinimum: string;
  fridayCheckoutMinimum: string;
  lateToleranceMinutes: number;
};

export type AttendanceSettingsMutationResult =
  | { ok: true; value: AttendanceSettingsMutation; error: null }
  | { ok: false; value: null; error: string };

export type AttendanceCorrectionSearchFilter = {
  date: string;
  className: string;
  studentQuery: string;
};

export type AttendanceCorrectionSearchResult =
  | { ok: true; filter: AttendanceCorrectionSearchFilter; error: null }
  | { ok: false; filter: AttendanceCorrectionSearchFilter; error: string };

export type AttendanceCorrectionMutation = {
  recordId: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  absenceCategory: AttendanceCorrectionAbsenceCategory | null;
  absenceNote: string | null;
  reason: string;
};

export type AttendanceCorrectionMutationResult =
  | { ok: true; value: AttendanceCorrectionMutation; error: null }
  | { ok: false; value: null; error: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAttendanceRecordId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseTime(value: unknown): { normalized: string; seconds: number } | null {
  if (typeof value !== "string") return null;
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");
  return {
    normalized: `${match[1]}:${match[2]}:${String(seconds).padStart(2, "0")}`,
    seconds: hours * 3600 + minutes * 60 + seconds,
  };
}

function timeFromSeconds(value: number): string | null {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 86_400) return null;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function timeInputValue(value: string): string {
  const parsed = parseTime(value);
  return parsed ? parsed.normalized.slice(0, 5) : "";
}

export function lateToleranceMinutes(startTime: string, cutoffTime: string): number {
  const start = parseTime(startTime);
  const cutoff = parseTime(cutoffTime);
  if (!start || !cutoff || cutoff.seconds < start.seconds) return 0;
  return Math.round((cutoff.seconds - start.seconds) / 60);
}

export function parseAttendanceSettingsMutation(input: {
  officialStartTime?: unknown;
  lateToleranceMinutes?: unknown;
  mondayThursdayCheckoutMinimum?: unknown;
  fridayCheckoutMinimum?: unknown;
}): AttendanceSettingsMutationResult {
  const start = parseTime(input.officialStartTime);
  const weekdayCheckout = parseTime(input.mondayThursdayCheckoutMinimum);
  const fridayCheckout = parseTime(input.fridayCheckoutMinimum);
  const toleranceText = typeof input.lateToleranceMinutes === "string"
    ? input.lateToleranceMinutes.trim()
    : "";
  if (!start || !weekdayCheckout || !fridayCheckout || !/^\d{1,4}$/.test(toleranceText)) {
    return { ok: false, value: null, error: "invalid_settings" };
  }
  const tolerance = Number(toleranceText);
  const cutoff = timeFromSeconds(start.seconds + tolerance * 60);
  if (
    !Number.isSafeInteger(tolerance) ||
    tolerance < 0 ||
    !cutoff ||
    weekdayCheckout.seconds <= start.seconds + tolerance * 60 ||
    fridayCheckout.seconds <= start.seconds + tolerance * 60
  ) {
    return { ok: false, value: null, error: "invalid_settings" };
  }
  return {
    ok: true,
    value: {
      officialStartTime: start.normalized,
      onTimeCutoff: cutoff,
      mondayThursdayCheckoutMinimum: weekdayCheckout.normalized,
      fridayCheckoutMinimum: fridayCheckout.normalized,
      lateToleranceMinutes: tolerance,
    },
    error: null,
  };
}

export function parseAttendanceCorrectionSearch(
  input: { date?: unknown; className?: unknown; studentQuery?: unknown },
  schoolToday: string,
): AttendanceCorrectionSearchResult {
  const date = typeof input.date === "string" && input.date.trim()
    ? input.date.trim()
    : schoolToday;
  const className = typeof input.className === "string" ? input.className.trim() : "";
  const studentQuery = typeof input.studentQuery === "string" ? input.studentQuery.trim() : "";
  const fallback = { date: schoolToday, className: "", studentQuery: "" };
  if (!isRealDate(date)) {
    return { ok: false, filter: fallback, error: "Tanggal tidak valid." };
  }
  if (
    className.length > 100 ||
    studentQuery.length > 100 ||
    hasControlCharacters(className) ||
    hasControlCharacters(studentQuery)
  ) {
    return { ok: false, filter: fallback, error: "Filter pencarian tidak valid." };
  }
  return { ok: true, filter: { date, className, studentQuery }, error: null };
}

function jakartaTimestamp(date: string, time: string): string | null {
  if (!isRealDate(date)) return null;
  const parsedTime = parseTime(time);
  if (!parsedTime) return null;
  const parsed = new Date(`${date}T${parsedTime.normalized}+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseAttendanceCorrectionMutation(input: {
  recordId?: unknown;
  attendanceDate?: unknown;
  mode?: unknown;
  checkInTime?: unknown;
  checkOutTime?: unknown;
  absenceCategory?: unknown;
  absenceNote?: unknown;
  reason?: unknown;
}): AttendanceCorrectionMutationResult {
  const recordId = typeof input.recordId === "string" ? input.recordId.trim() : "";
  const attendanceDate = typeof input.attendanceDate === "string" ? input.attendanceDate.trim() : "";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const note = typeof input.absenceNote === "string" ? input.absenceNote.trim() : "";
  if (
    !isAttendanceRecordId(recordId) ||
    !isRealDate(attendanceDate) ||
    !reason ||
    reason.length > 500 ||
    note.length > 500 ||
    hasControlCharacters(reason) ||
    hasControlCharacters(note)
  ) {
    return { ok: false, value: null, error: "invalid_correction" };
  }

  if (input.mode === "presence") {
    const checkInAt = jakartaTimestamp(attendanceDate, String(input.checkInTime ?? ""));
    const rawCheckOut = typeof input.checkOutTime === "string" ? input.checkOutTime.trim() : "";
    const checkOutAt = rawCheckOut ? jakartaTimestamp(attendanceDate, rawCheckOut) : null;
    if (!checkInAt || (rawCheckOut && !checkOutAt)) {
      return { ok: false, value: null, error: "invalid_correction" };
    }
    return {
      ok: true,
      value: {
        recordId,
        checkInAt,
        checkOutAt,
        absenceCategory: null,
        absenceNote: null,
        reason,
      },
      error: null,
    };
  }

  if (
    input.mode === "absence" &&
    typeof input.absenceCategory === "string" &&
    ATTENDANCE_CORRECTION_ABSENCE_CATEGORIES.includes(
      input.absenceCategory as AttendanceCorrectionAbsenceCategory,
    )
  ) {
    return {
      ok: true,
      value: {
        recordId,
        checkInAt: null,
        checkOutAt: null,
        absenceCategory: input.absenceCategory as AttendanceCorrectionAbsenceCategory,
        absenceNote: note || null,
        reason,
      },
      error: null,
    };
  }

  return { ok: false, value: null, error: "invalid_correction" };
}

export function jakartaTimeInputValue(timestamp: string | null): string {
  if (!timestamp) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}:${part("second")}`;
}
