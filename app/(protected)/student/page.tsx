/**
 * Presensi SMAN 2 Cimalaka
 * © 2026 Dimas Bratakusumah
 * Institut Teknologi Nasional Bandung
 */

import Link from "next/link";
import { logoutAction } from "@/app/logout-action";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { getSchoolDate } from "@/lib/attendance/teacher-attendance-model";
import { createClient } from "@/lib/supabase/server";

function schoolTime(timestamp: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return "Selamat Pagi";
  if (hour >= 11 && hour < 15) return "Selamat Siang";
  if (hour >= 15 && hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

export default async function StudentPage() {
  const person = await requireCurrentPerson({ allowedRoles: ["student"] });
  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from("people")
    .select("class_name, claimed_at")
    .eq("id", person.id)
    .single();
  if (error || !student) throw new Error("Student profile could not be loaded.");

  const today = getSchoolDate();
  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance_daily")
    .select("check_in_at, check_in_status, check_out_at, absence_category")
    .eq("student_id", person.id)
    .eq("attendance_date", today)
    .maybeSingle();
  if (attendanceError) throw new Error("Student attendance could not be loaded.");

  const statusInfo = attendance?.check_in_status === "on_time"
    ? { label: "Hadir Tepat Waktu", badge: "status-state-present", desc: "Presensi masuk telah diverifikasi dan tercatat tepat waktu." }
    : attendance?.check_in_status === "late"
      ? { label: "Terlambat", badge: "status-state-late", desc: "Presensi masuk telah tercatat melebihi batas waktu kedatangan." }
      : attendance?.absence_category === "sick"
        ? { label: "Sakit", badge: "status-state-sick", desc: "Tercatat keterangan sakit pada daftar presensi hari ini." }
        : attendance?.absence_category === "permission"
          ? { label: "Izin", badge: "status-state-permission", desc: "Tercatat izin kegiatan resmi sekolah pada daftar presensi." }
          : attendance?.absence_category === "absent"
            ? { label: "Alfa", badge: "status-state-absent", desc: "Belum ada keterangan kehadiran sah yang tercatat hari ini." }
            : attendance?.absence_category === "dispensation"
              ? { label: "Dispensasi", badge: "status-state-dispensation", desc: "Tercatat dispensasi tugas resmi sekolah hari ini." }
              : { label: "Belum Presensi", badge: "status-state-unmarked", desc: "Anda belum mencatat presensi masuk hari ini. Silakan pindai kode QR sekolah." };

  const initials = person.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="student-dashboard">
      {/* Student Welcome Header */}
      <header className="student-hero-header">
        <div className="student-hero-profile">
          <div className="avatar-circle" aria-hidden="true">
            {initials || "S"}
          </div>
          <div className="student-hero-details">
            <p className="eyebrow student-greeting">{getGreeting()}</p>
            <h1 className="student-name">{person.fullName}</h1>
            <div className="student-meta-tags">
              <span className="meta-pill">{person.loginId}</span>
              <span className="meta-pill">Kelas {student.class_name ?? "-"}</span>
              <span className="meta-pill meta-pill-school">SMAN 2 Cimalaka</span>
            </div>
          </div>
        </div>
        <div className="student-status-indicator">
          <span className="status-badge status-active">Akun Aktif</span>
        </div>
      </header>

      <div className="student-home-grid">
        {/* Today's Hero Attendance Card */}
        <section className="card student-hero-card" aria-labelledby="today-attendance-title">
          <div className="student-card-header">
            <div className="student-date-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{dateFormatter.format(new Date(`${today}T00:00:00.000Z`))}</span>
            </div>
            <span className={`status-pill ${statusInfo.badge}`}>
              <span className="status-dot" aria-hidden="true" />
              {statusInfo.label}
            </span>
          </div>

          <div className="student-hero-body">
            <h2 id="today-attendance-title" className="student-hero-title">Presensi Hari Ini</h2>
            <p className="student-status-desc">{statusInfo.desc}</p>
          </div>

          {/* Time summary cards */}
          <div className="student-attendance-times">
            <div className="student-time-card">
              <div className="student-time-card-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
                <span className="student-time-label">Jam Masuk</span>
              </div>
              <strong className="student-time-val tnum">
                {attendance?.check_in_at ? `${schoolTime(attendance.check_in_at)} WIB` : "-"}
              </strong>
            </div>

            <div className="student-time-card">
              <div className="student-time-card-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="student-time-label">Jam Pulang</span>
              </div>
              <strong className="student-time-val tnum">
                {attendance?.check_out_at
                  ? `${schoolTime(attendance.check_out_at)} WIB`
                  : attendance?.check_in_at
                    ? "Belum Dicatat"
                    : "-"}
              </strong>
            </div>
          </div>

          {/* Primary & Secondary Actions */}
          <div className="student-home-actions">
            <Link className="button button-primary student-scan-cta" href="/student/scan">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <circle cx="17.5" cy="17.5" r="2.5" />
              </svg>
              <span>Pindai QR Presensi Sekarang</span>
            </Link>

            <Link className="button button-secondary student-history-link" href="/attendance/history">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Lihat Riwayat Presensi Saya</span>
            </Link>
          </div>
        </section>

        {/* Student Account Identity Card */}
        <section className="card student-identity-card" aria-labelledby="student-identity-title">
          <div className="student-card-section-header">
            <h2 id="student-identity-title">Identitas Akun Siswa</h2>
            <p className="muted">Informasi data profil yang terhubung dengan akun presensi Anda.</p>
          </div>

          <ul className="student-info-list">
            <li>
              <span className="student-info-label">Nama Lengkap</span>
              <strong className="student-info-value">{person.fullName}</strong>
            </li>
            <li>
              <span className="student-info-label">Nomor Induk Siswa (NIS)</span>
              <strong className="student-info-value tnum">{person.loginId}</strong>
            </li>
            <li>
              <span className="student-info-label">Kelas / Rombel</span>
              <strong className="student-info-value">{student.class_name ?? "-"}</strong>
            </li>
            <li>
              <span className="student-info-label">Status Aktivasi</span>
              <strong className="student-info-value">
                {student.claimed_at ? "Terverifikasi Aktif" : "Belum Diaktivasi"}
              </strong>
            </li>
          </ul>

          <div className="student-account-actions">
            <Link className="button button-secondary button-full" href="/change-password">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Ubah Kata Sandi</span>
            </Link>
            <form action={logoutAction} className="student-logout-form">
              <button className="button button-quiet button-full" type="submit">
                Keluar dari Akun
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
