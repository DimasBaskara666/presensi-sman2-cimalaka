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
  const [filterQuery, setFilterQuery] = useState("");

  const filtered = students.filter((s) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase().trim();
    return s.fullName.toLowerCase().includes(q) || s.loginId.toLowerCase().includes(q);
  });

  return (
    <section className="card attendance-board-card">
      <div className="attendance-board-toolbar">
        <div className="field attendance-search-field">
          <label className="sr-only" htmlFor="attendance-student-search">
            Cari siswa
          </label>
          <input
            id="attendance-student-search"
            type="search"
            placeholder="Cari nama atau ID siswa…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
        <p className="muted attendance-count-note">
          Menampilkan {filtered.length} dari {students.length} siswa
        </p>
      </div>

      <div className="table-wrap attendance-table-wrap">
        <table className="data-table attendance-table">
          <thead>
            <tr>
              <th className="th-no">No</th>
              <th className="th-student">Siswa</th>
              <th className="th-status">Status</th>
              <th className="th-time">Waktu</th>
              <th className="th-actions">Tandai Kehadiran</th>
              <th className="th-note">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student, index) => (
              <AttendanceStudentRow key={student.id} student={student} index={index} />
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">
          {students.length === 0
            ? "Tidak ada siswa aktif pada kelas ini."
            : "Tidak ada siswa yang sesuai dengan pencarian."}
        </p>
      ) : null}
    </section>
  );
}

function AttendanceStudentRow({
  student,
  index,
}: {
  student: TeacherAttendanceStudent;
  index: number;
}) {
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
    <tr className={`attendance-row${present ? " is-present" : ""}`}>
      <td className="td-no">
        <span className="attendance-student-number">{index + 1}</span>
      </td>
      <td className="td-student">
        <div className="attendance-student-meta">
          <strong>{student.fullName}</strong>
          <span className="attendance-student-id">{student.loginId}</span>
        </div>
      </td>
      <td className="td-status">
        <span className={`status-badge attendance-state attendance-state-${student.status}`}>
          {statusLabels[student.status]}
        </span>
      </td>
      <td className="td-time">
        {student.checkInAt ? (
          <div className="attendance-time-compact">
            <span>Masuk <strong>{schoolTime(student.checkInAt)} WIB</strong></span>
            {student.checkOutAt ? (
              <span>Pulang <strong>{schoolTime(student.checkOutAt)} WIB</strong></span>
            ) : null}
          </div>
        ) : (
          <span className="muted">-</span>
        )}
      </td>
      <td className="td-actions">
        <div className="attendance-actions" aria-label={`Presensi ${student.fullName}`}>
          {markOptions.map((option) => {
            const selected = selectedMark(student, option.value);
            const notPermitted = present && option.value !== "present";
            return (
              <button
                className={`attendance-mark-button${selected ? " is-selected" : ""}`}
                key={option.value}
                type="button"
                aria-label={`Tandai ${option.label} untuk ${student.fullName}`}
                aria-pressed={selected}
                disabled={pending || notPermitted || (selected && option.value === "present")}
                onClick={() => mark(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {present && !student.checkOutAt ? (
          <button
            className="button button-secondary button-small attendance-checkout"
            type="button"
            aria-label={`Catat pulang untuk ${student.fullName}`}
            disabled={pending}
            onClick={checkOut}
          >
            Catat pulang
          </button>
        ) : null}

        {pending ? <p className="attendance-feedback muted" role="status">Menyimpan…</p> : null}
        {!pending && feedback ? (
          <p
            className={`attendance-feedback ${feedback.ok ? "attendance-feedback-success" : "attendance-feedback-error"}`}
            role={feedback.ok ? "status" : "alert"}
          >
            {feedback.message}
          </p>
        ) : null}
        {present ? (
          <p className="attendance-lock-note">
            Perubahan dari hadir menjadi tidak hadir memerlukan koreksi administrator.
          </p>
        ) : null}
      </td>
      <td className="td-note">
        <details className="attendance-note" open={Boolean(student.absenceNote)}>
          <summary>Catatan opsional</summary>
          <div className="attendance-note-input-wrap">
            <label className="sr-only" htmlFor={`attendance-note-${student.id}`}>
              Catatan untuk {student.fullName}
            </label>
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
          </div>
        </details>
      </td>
    </tr>
  );
}
