"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TeacherAttendanceStudent } from "@/lib/attendance/teacher-attendance";
import type { TeacherAttendanceMark } from "@/lib/attendance/teacher-attendance-model";
import {
  markTeacherAttendanceAction,
  recordTeacherCheckOutAction,
  type TeacherAttendanceActionResult,
} from "./actions";

const markOptions: ReadonlyArray<{ value: TeacherAttendanceMark; label: string }> = [
  { value: "present", label: "Hadir" },
  { value: "sick", label: "Sakit" },
  { value: "permission", label: "Izin" },
  { value: "absent", label: "Alfa" },
  { value: "dispensation", label: "Disp." },
];

const statusLabels = {
  unmarked: "Belum ditandai",
  on_time: "Hadir tepat waktu",
  late: "Terlambat",
  sick: "Sakit",
  permission: "Izin",
  absent: "Alfa",
  dispensation: "Dispensasi",
} as const;

function schoolTime(timestamp: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function isPresent(student: TeacherAttendanceStudent): boolean {
  return student.status === "on_time" || student.status === "late";
}

function selectedMark(student: TeacherAttendanceStudent, mark: TeacherAttendanceMark): boolean {
  if (mark === "present") return isPresent(student);
  return student.status === mark;
}

export function TeacherAttendanceBoard({
  students,
}: {
  students: TeacherAttendanceStudent[];
}) {
  return (
    <div className="attendance-student-list">
      {students.map((student) => <AttendanceStudentCard key={student.id} student={student} />)}
    </div>
  );
}

function AttendanceStudentCard({ student }: { student: TeacherAttendanceStudent }) {
  const router = useRouter();
  const [note, setNote] = useState(student.absenceNote ?? "");
  const [feedback, setFeedback] = useState<TeacherAttendanceActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const present = isPresent(student);

  function mark(status: TeacherAttendanceMark) {
    startTransition(async () => {
      setFeedback(null);
      try {
        const result = await markTeacherAttendanceAction({
          studentId: student.id,
          status,
          note: status === "present" ? "" : note,
        });
        setFeedback(result);
        if (result.ok) router.refresh();
      } catch {
        setFeedback({
          ok: false,
          studentId: student.id,
          message: "Koneksi terputus. Coba simpan kembali.",
        });
      }
    });
  }

  function checkOut() {
    startTransition(async () => {
      setFeedback(null);
      try {
        const result = await recordTeacherCheckOutAction(student.id);
        setFeedback(result);
        if (result.ok) router.refresh();
      } catch {
        setFeedback({
          ok: false,
          studentId: student.id,
          message: "Koneksi terputus. Coba simpan kembali.",
        });
      }
    });
  }

  return (
    <article className="attendance-student-card">
      <div className="attendance-student-heading">
        <div>
          <p className="attendance-student-id">{student.loginId}</p>
          <h2>{student.fullName}</h2>
          <p className="muted">Kelas {student.className}</p>
        </div>
        <span className={`attendance-state attendance-state-${student.status}`}>
          {statusLabels[student.status]}
        </span>
      </div>

      {student.checkInAt ? (
        <div className="attendance-time-row">
          <span>Masuk <strong>{schoolTime(student.checkInAt)} WIB</strong></span>
          {student.checkOutAt ? <span>Pulang <strong>{schoolTime(student.checkOutAt)} WIB</strong></span> : null}
        </div>
      ) : null}

      <div className="attendance-actions" aria-label={`Presensi ${student.fullName}`}>
        {markOptions.map((option) => {
          const selected = selectedMark(student, option.value);
          const notPermitted = present && option.value !== "present";
          return (
            <button
              className={`attendance-mark-button${selected ? " is-selected" : ""}`}
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={pending || notPermitted || (selected && option.value === "present")}
              onClick={() => mark(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <details className="attendance-note" open={Boolean(student.absenceNote)}>
        <summary>Catatan opsional</summary>
        <label className="sr-only" htmlFor={`attendance-note-${student.id}`}>Catatan untuk {student.fullName}</label>
        <input
          id={`attendance-note-${student.id}`}
          type="text"
          value={note}
          maxLength={200}
          placeholder="Contoh: surat menyusul"
          disabled={pending || present}
          onChange={(event) => setNote(event.target.value)}
        />
        <small>{note.length}/200</small>
      </details>

      {present && !student.checkOutAt ? (
        <button className="button button-secondary attendance-checkout" type="button" disabled={pending} onClick={checkOut}>
          Catat pulang
        </button>
      ) : null}

      {pending ? <p className="attendance-feedback muted" role="status">Menyimpan…</p> : null}
      {!pending && feedback ? (
        <p className={`attendance-feedback ${feedback.ok ? "attendance-feedback-success" : "attendance-feedback-error"}`} role={feedback.ok ? "status" : "alert"}>
          {feedback.message}
        </p>
      ) : null}
      {present ? <p className="attendance-lock-note">Perubahan dari hadir menjadi tidak hadir memerlukan koreksi administrator.</p> : null}
    </article>
  );
}
