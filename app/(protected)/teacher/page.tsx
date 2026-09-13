import Link from "next/link";
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
  const person = await requireCurrentPerson({ allowedRoles: ["teacher"] });
  const params = await searchParams;
  const requestedClass = typeof params.class === "string" ? params.class : undefined;
  const view = await loadTeacherAttendanceToday(requestedClass);

  return (
    <div className="teacher-attendance-page">
      <header className="page-header attendance-page-header">
        <div>
          <p className="eyebrow">Operasional Guru · Presensi Hari Ini</p>
          <h1>Presensi Kelas Harian</h1>
          <p className="muted">
            {dateFormatter.format(new Date(`${view.today}T00:00:00.000Z`))} · Pilih rombongan belajar dan kelola presensi harian siswa.
          </p>
        </div>
        <div className="teacher-header-badges">
          <span className="meta-pill">{person.fullName}</span>
          <span className="status-badge status-active">Guru Aktif</span>
        </div>
      </header>

      <div className="teacher-top-cards">
        <section className="card attendance-class-card" aria-labelledby="attendance-class-title">
          <div className="attendance-card-content">
            <h2 id="attendance-class-title">Pilih Rombongan Belajar</h2>
            <p className="muted">Tampilkan satu kelas agar pencatatan presensi tetap terfokus dan akurat.</p>
          </div>
          <form className="attendance-class-picker" method="get">
            <label className="sr-only" htmlFor="attendance-class">Pilih Kelas</label>
            <select id="attendance-class" name="class" defaultValue={view.selectedClass ?? ""} required>
              <option value="">Pilih kelas rombel…</option>
              {view.classes.map((className) => <option key={className} value={className}>{className}</option>)}
            </select>
            <button className="button button-primary" type="submit">
              Tampilkan
            </button>
          </form>
        </section>

        <section className="card attendance-class-card teacher-qr-banner-card" aria-labelledby="teacher-qr-title">
          <div className="attendance-card-content">
            <h2 id="teacher-qr-title">QR Presensi Bersama</h2>
            <p className="muted">Tampilkan kode QR presensi sesi sekolah di layar proyektor (berganti otomatis tiap 5 menit).</p>
          </div>
          <Link className="button button-secondary teacher-qr-btn" href="/teacher/attendance-qr">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
            <span>Buka QR Bersama</span>
          </Link>
        </section>
      </div>

      {view.classNotFound ? (
        <div className="alert alert-error" role="alert">
          <strong>Kelas Tidak Ditemukan</strong>
          <p>Rombongan belajar yang Anda pilih tidak tersedia dalam sistem. Silakan pilih kembali dari daftar rombel.</p>
        </div>
      ) : null}

      {view.selectedClass ? (
        <>
          <section className="attendance-summary" aria-label={`Ringkasan kelas ${view.selectedClass}`}>
            {summaryItems.map((item) => (
              <div className={`attendance-summary-item attendance-summary-${item.key}`} key={item.key}>
                <span className="summary-label">{item.label}</span>
                <strong className="summary-count tnum">{view.summary[item.key]}</strong>
              </div>
            ))}
          </section>

          <div className="attendance-list-heading">
            <div>
              <p className="eyebrow">Roster Siswa</p>
              <h2>Daftar Kehadiran Kelas {view.selectedClass}</h2>
            </div>
            <span className="meta-pill">{view.students.length} Siswa Terdaftar</span>
          </div>

          {view.students.length > 0 ? (
            <TeacherAttendanceBoard students={view.students} />
          ) : (
            <div className="card empty-state-card">
              <p className="empty-state">Tidak ada siswa aktif yang terdaftar pada kelas ini.</p>
            </div>
          )}
        </>
      ) : (
        <div className="card empty-state-card attendance-empty-card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-icon" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3>Belum Ada Kelas yang Dipilih</h3>
          <p className="muted">
            Pilih rombongan belajar pada dropdown di atas, lalu klik <strong>Tampilkan</strong> untuk membuka lembar presensi kelas.
          </p>
        </div>
      )}
    </div>
  );
}
