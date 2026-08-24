import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  deriveAttendanceStatus,
  getSchoolDate,
  summarizeTeacherAttendance,
  type AttendanceDisplayStatus,
  type TeacherAttendanceSummary,
} from "./teacher-attendance-model";

type RosterRow = {
  id: string;
  login_id: string;
  full_name: string;
  class_name: string | null;
};

type AttendanceRow = {
  student_id: string;
  check_in_at: string | null;
  check_in_status: string | null;
  check_out_at: string | null;
  absence_category: string | null;
  absence_note: string | null;
};

export type TeacherAttendanceStudent = {
  id: string;
  loginId: string;
  fullName: string;
  className: string;
  status: AttendanceDisplayStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  absenceNote: string | null;
};

export type TeacherAttendanceView = {
  today: string;
  classes: string[];
  selectedClass: string | null;
  classNotFound: boolean;
  students: TeacherAttendanceStudent[];
  summary: TeacherAttendanceSummary;
};

export class TeacherAttendanceDataError extends Error {
  constructor() {
    super("teacher_attendance_data_failed");
    this.name = "TeacherAttendanceDataError";
  }
}

export async function loadTeacherAttendanceToday(
  requestedClass: string | undefined,
): Promise<TeacherAttendanceView> {
  const supabase = await createClient();
  const today = getSchoolDate();
  const { data: rosterData, error: rosterError } = await supabase
    .rpc("get_teacher_attendance_roster");
  if (rosterError || !rosterData) throw new TeacherAttendanceDataError();

  const roster = rosterData as RosterRow[];
  const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
  const classes = [...new Set(
    roster.map((student) => student.class_name?.trim()).filter((value): value is string => Boolean(value)),
  )].sort(collator.compare);
  const normalizedClass = requestedClass?.trim() ?? "";
  const selectedClass = normalizedClass && classes.includes(normalizedClass) ? normalizedClass : null;
  const classNotFound = Boolean(normalizedClass && !selectedClass);
  const selectedRoster = selectedClass
    ? roster.filter((student) => student.class_name?.trim() === selectedClass)
    : [];

  let attendanceRows: AttendanceRow[] = [];
  if (selectedRoster.length > 0) {
    const { data, error } = await supabase
      .from("attendance_daily")
      .select("student_id, check_in_at, check_in_status, check_out_at, absence_category, absence_note")
      .eq("attendance_date", today)
      .in("student_id", selectedRoster.map((student) => student.id));
    if (error || !data) throw new TeacherAttendanceDataError();
    attendanceRows = data as AttendanceRow[];
  }

  const attendanceByStudent = new Map(
    attendanceRows.map((attendance) => [attendance.student_id, attendance]),
  );
  const students = selectedRoster.map((student): TeacherAttendanceStudent => {
    const attendance = attendanceByStudent.get(student.id);
    return {
      id: student.id,
      loginId: student.login_id,
      fullName: student.full_name,
      className: student.class_name?.trim() ?? "",
      status: deriveAttendanceStatus(attendance),
      checkInAt: attendance?.check_in_at ?? null,
      checkOutAt: attendance?.check_out_at ?? null,
      absenceNote: attendance?.absence_note ?? null,
    };
  });

  return {
    today,
    classes,
    selectedClass,
    classNotFound,
    students,
    summary: summarizeTeacherAttendance(students),
  };
}
