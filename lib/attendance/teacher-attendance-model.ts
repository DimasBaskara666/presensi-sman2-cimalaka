export const SCHOOL_TIME_ZONE = "Asia/Jakarta";

export const TEACHER_ATTENDANCE_MARKS = [
  "present",
  "sick",
  "permission",
  "absent",
  "dispensation",
] as const;

export type TeacherAttendanceMark = (typeof TEACHER_ATTENDANCE_MARKS)[number];

export type AttendanceDisplayStatus =
  | "unmarked"
  | "on_time"
  | "late"
  | "sick"
  | "permission"
  | "absent"
  | "dispensation";

export type AttendanceRecordLike = {
  check_in_at: string | null;
  check_in_status: string | null;
  absence_category: string | null;
};

export type TeacherAttendanceSummary = {
  total: number;
  present: number;
  late: number;
  sick: number;
  permission: number;
  absent: number;
  dispensation: number;
  unmarked: number;
};

export function isTeacherAttendanceMark(value: unknown): value is TeacherAttendanceMark {
  return typeof value === "string" && TEACHER_ATTENDANCE_MARKS.includes(
    value as TeacherAttendanceMark,
  );
}

export function getSchoolDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function deriveAttendanceStatus(
  record: AttendanceRecordLike | null | undefined,
): AttendanceDisplayStatus {
  if (!record) return "unmarked";
  if (record.check_in_at && record.check_in_status === "on_time") return "on_time";
  if (record.check_in_at && record.check_in_status === "late") return "late";
  if (
    record.absence_category === "sick" ||
    record.absence_category === "permission" ||
    record.absence_category === "absent" ||
    record.absence_category === "dispensation"
  ) {
    return record.absence_category;
  }
  return "unmarked";
}

export function summarizeTeacherAttendance(
  students: ReadonlyArray<{ status: AttendanceDisplayStatus }>,
): TeacherAttendanceSummary {
  const summary: TeacherAttendanceSummary = {
    total: students.length,
    present: 0,
    late: 0,
    sick: 0,
    permission: 0,
    absent: 0,
    dispensation: 0,
    unmarked: 0,
  };
  for (const student of students) {
    if (student.status === "on_time") summary.present += 1;
    else summary[student.status] += 1;
  }
  return summary;
}

