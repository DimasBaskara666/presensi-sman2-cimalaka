import { requireCurrentPerson } from "@/lib/auth/require-person";
import { loadTeacherAttendanceToday } from "@/lib/attendance/teacher-attendance";
import type { TeacherAttendanceSummary } from "@/lib/attendance/teacher-attendance-model";
import { TeacherAttendanceBoard } from "./attendance-board";

export const dynamic = "force-dynamic";

type TeacherPageProps = {
  searchParams: Promise<{ class?: string | string[] }>;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const summaryItems: ReadonlyArray<{ key: keyof TeacherAttendanceSummary; label: string }> = [
  { key: "total", label: "Total" },
  { key: "present", label: "Hadir" },
  { key: "late", label: "Terlambat" },
  { key: "sick", label: "Sakit" },
  { key: "permission", label: "Izin" },
  { key: "absent", label: "Alfa" },
  { key: "dispensation", label: "Dispensasi" },
  { key: "unmarked", label: "Belum" },
];

export default async function TeacherPage({ searchParams }: TeacherPageProps) {
  await requireCurrentPerson({ allowedRoles: ["teacher"] });
  const params = await searchParams;
  const requestedClass = typeof params.class === "string" ? params.class : undefined;
  const view = await loadTeacherAttendanceToday(requestedClass);

  return (
    <div className="teacher-attendance-page">
      <header className="page-header attendance-page-header">
        <div>
          <p className="eyebrow">Presensi hari ini</p>
          <h1>Presensi Manual</h1>
          <p className="muted">
            {dateFormatter.format(new Date(`${view.today}T00:00:00.000Z`))} · setiap pilihan langsung tersimpan.
          </p>
        </div>
        <span className="role-badge">Guru</span>
      </header>

      <section className="card attendance-class-card" aria-labelledby="attendance-class-title">
        <div>
          <h2 id="attendance-class-title">Pilih kelas</h2>
          <p className="muted">Tampilkan satu kelas agar pencatatan tetap cepat dan jelas.</p>
        </div>
        <form className="attendance-class-picker" method="get">
          <label className="sr-only" htmlFor="attendance-class">Kelas</label>
          <select id="attendance-class" name="class" defaultValue={view.selectedClass ?? ""} required>
            <option value="">Pilih kelas…</option>
            {view.classes.map((className) => <option key={className} value={className}>{className}</option>)}
          </select>
          <button className="button button-primary" type="submit">Tampilkan</button>
        </form>
      </section>

      {view.classNotFound ? (
        <p className="alert alert-error" role="alert">Kelas yang dipilih tidak ditemukan. Pilih kembali dari daftar.</p>
      ) : null}

      {view.selectedClass ? (
        <>
          <section className="attendance-summary" aria-label={`Ringkasan kelas ${view.selectedClass}`}>
            {summaryItems.map((item) => (
              <div className={`attendance-summary-item attendance-summary-${item.key}`} key={item.key}>
                <span>{item.label}</span>
                <strong>{view.summary[item.key]}</strong>
              </div>
            ))}
          </section>

          <div className="attendance-list-heading">
            <div>
              <p className="eyebrow">Kelas {view.selectedClass}</p>
              <h2>Daftar siswa</h2>
            </div>
            <p className="muted">{view.students.length} siswa aktif</p>
          </div>

          {view.students.length > 0 ? (
            <TeacherAttendanceBoard students={view.students} />
          ) : (
            <p className="empty-state">Tidak ada siswa aktif pada kelas ini.</p>
          )}
        </>
      ) : (
        <p className="empty-state attendance-empty-state">Pilih dan konfirmasi kelas untuk mulai mencatat presensi hari ini.</p>
      )}
    </div>
  );
}
