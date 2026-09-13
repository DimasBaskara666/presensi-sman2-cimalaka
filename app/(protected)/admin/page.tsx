/**
 * Presensi SMAN 2 Cimalaka
 * © 2026 Dimas Bratakusumah
 * Institut Teknologi Nasional Bandung
 */

import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { listStudents } from "@/lib/students/student-management";
import { listTeachers } from "@/lib/auth/teacher-management";
import { loadSharedAttendanceQrSession } from "@/lib/attendance/shared-qr-session";
import { getSchoolDate } from "@/lib/attendance/teacher-attendance-model";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

export default async function AdminPage() {
  const person = await requireCurrentPerson({ allowedRoles: ["admin"] });

  const [students, teachers, qrSession] = await Promise.all([
    listStudents().catch(() => []),
    listTeachers().catch(() => []),
    loadSharedAttendanceQrSession().catch(() => ({ active: false })),
  ]);

  const today = getSchoolDate();
  const supabase = await createClient();
  const { count: todayAttendanceCount } = await supabase
    .from("attendance_daily")
    .select("id", { count: "exact", head: true })
    .eq("attendance_date", today);

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.isActive).length;
  const activatedStudents = students.filter((s) => s.isActivated).length;
  const hasCodeStudents = students.filter((s) => !s.isActivated && s.hasActivationCode).length;
  const needsCodeStudents = students.filter((s) => !s.isActivated && !s.hasActivationCode).length;
  const totalClasses = new Set(students.map((s) => s.className).filter(Boolean)).size;

  const totalTeachers = teachers.length;
  const activeTeachers = teachers.filter((t) => t.isActive).length;

  return (
    <div className="admin-overview-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Pusat Kendali Operasional</p>
          <h1>Ringkasan Administrator</h1>
          <p className="muted">
            {dateFormatter.format(new Date(`${today}T00:00:00.000Z`))} · Pantau kondisi operasional presensi SMAN 2 Cimalaka.
          </p>
        </div>
        <div className="admin-header-badges">
          <span className="meta-pill">{person.fullName}</span>
          <span className="role-badge">Administrator</span>
        </div>
      </header>

      {/* Operational Summary Metric Cards */}
      <section className="admin-stats-section" aria-label="Ringkasan statistik operasional">
        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span className="admin-stat-label">Total Siswa Terdaftar</span>
            <strong className="admin-stat-value tnum">{totalStudents}</strong>
            <span className="admin-stat-hint">{activeStudents} aktif · {totalClasses} rombel</span>
          </div>

          <div className="admin-stat-card">
            <span className="admin-stat-label">Aktivasi Akun Siswa</span>
            <strong className="admin-stat-value tnum is-success">{activatedStudents}</strong>
            <span className="admin-stat-hint">
              {hasCodeStudents} ada kode · {needsCodeStudents} perlu kode
            </span>
          </div>

          <div className="admin-stat-card">
            <span className="admin-stat-label">Pengajar / Guru</span>
            <strong className="admin-stat-value tnum">{totalTeachers}</strong>
            <span className="admin-stat-hint">{activeTeachers} akun aktif</span>
          </div>

          <div className="admin-stat-card">
            <span className="admin-stat-label">Sesi QR Sekolah</span>
            <strong className="admin-stat-value">
              <span className={`status-pill ${qrSession.active ? "status-state-present" : "status-state-unmarked"}`}>
                <span className="status-dot" aria-hidden="true" />
                {qrSession.active ? "Aktif" : "Berhenti"}
              </span>
            </strong>
            <span className="admin-stat-hint">Rotasi otomatis 5 menit</span>
          </div>

          <div className="admin-stat-card">
            <span className="admin-stat-label">Presensi Masuk Hari Ini</span>
            <strong className="admin-stat-value tnum is-primary">{todayAttendanceCount ?? 0}</strong>
            <span className="admin-stat-hint">Catatan tanggal {today}</span>
          </div>
        </div>
      </section>

      {/* Operational Modules Navigation Cards */}
      <section aria-labelledby="admin-modules-heading">
        <div className="admin-modules-header">
          <h2 id="admin-modules-heading">Modul Pengelolaan Utama</h2>
          <p className="muted">Pilih modul kerja untuk administrasi akun, jadwal, dan pencatatan presensi.</p>
        </div>

        <div className="admin-modules-grid">
          <article className="card admin-module-card">
            <div className="admin-module-body">
              <div className="admin-module-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h3>Kelola Data Siswa</h3>
                <p className="muted">
                  Kelola data 676 siswa, status keaktifan akun, aktivasi individu, dan reset kata sandi.
                </p>
              </div>
            </div>
            <div className="admin-module-footer">
              <Link className="button button-primary button-small" href="/admin/students">
                Buka Data Siswa
              </Link>
              <Link className="button button-secondary button-small" href="/admin/students/import">
                Impor Excel
              </Link>
            </div>
          </article>

          <article className="card admin-module-card">
            <div className="admin-module-body">
              <div className="admin-module-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <h3>Aktivasi Massal &amp; Slip</h3>
                <p className="muted">
                  Buat token aktivasi per kelas atau seluruh sekolah dan unduh lembar cetak slip PDF A4.
                </p>
              </div>
            </div>
            <div className="admin-module-footer">
              <Link className="button button-primary button-small" href="/admin/students/activation-bulk">
                Distribusi Slip
              </Link>
            </div>
          </article>

          <article className="card admin-module-card">
            <div className="admin-module-body">
              <div className="admin-module-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h3>Pengelolaan Guru</h3>
                <p className="muted">
                  Buat akun guru baru, aktifkan atau nonaktifkan akses mengajar, dan reset kata sandi.
                </p>
              </div>
            </div>
            <div className="admin-module-footer">
              <Link className="button button-primary button-small" href="/admin/teachers">
                Kelola Akun Guru
              </Link>
            </div>
          </article>

          <article className="card admin-module-card">
            <div className="admin-module-body">
              <div className="admin-module-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
              </div>
              <div>
                <h3>QR Presensi Siswa</h3>
                <p className="muted">
                  Mulai, pantau, dan tampilkan kode QR presensi sesi sekolah di layar monitor atau proyektor.
                </p>
              </div>
            </div>
            <div className="admin-module-footer">
              <Link className="button button-primary button-small" href="/admin/attendance-qr">
                Buka Layar QR
              </Link>
            </div>
          </article>

          <article className="card admin-module-card">
            <div className="admin-module-body">
              <div className="admin-module-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <h3>Pengaturan Jam Presensi</h3>
                <p className="muted">
                  Atur jam kedatangan normal, batas toleransi keterlambatan, dan jam kepulangan resmi sekolah.
                </p>
              </div>
            </div>
            <div className="admin-module-footer">
              <Link className="button button-primary button-small" href="/admin/attendance-settings">
                Atur Jam Presensi
              </Link>
            </div>
          </article>

          <article className="card admin-module-card">
            <div className="admin-module-body">
              <div className="admin-module-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <div>
                <h3>Koreksi Presensi</h3>
                <p className="muted">
                  Koreksi status kehadiran siswa dengan alasan resmi dan rekaman audit log otomatis.
                </p>
              </div>
            </div>
            <div className="admin-module-footer">
              <Link className="button button-primary button-small" href="/admin/attendance-corrections">
                Koreksi Presensi
              </Link>
            </div>
          </article>

          <article className="card admin-module-card">
            <div className="admin-module-body">
              <div className="admin-module-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <h3>Riwayat &amp; Laporan PDF</h3>
                <p className="muted">
                  Cari arsip presensi berdasarkan rentang tanggal dan kelas, serta cetak laporan PDF resmi.
                </p>
              </div>
            </div>
            <div className="admin-module-footer">
              <Link className="button button-primary button-small" href="/attendance/history">
                Buka Riwayat
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
