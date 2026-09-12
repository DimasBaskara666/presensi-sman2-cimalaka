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
    ? { label: "Hadir Tepat Waktu", badge: "attendance-state-on_time", desc: "Presensi masuk telah tercatat tepat waktu." }
    : attendance?.check_in_status === "late"
      ? { label: "Terlambat", badge: "attendance-state-late", desc: "Presensi masuk telah tercatat melebihi batas waktu." }
      : attendance?.absence_category === "sick"
        ? { label: "Sakit", badge: "attendance-state-sick", desc: "Tercatat keterangan sakit oleh guru." }
        : attendance?.absence_category === "permission"
          ? { label: "Izin", badge: "attendance-state-permission", desc: "Tercatat izin kegiatan resmi sekolah." }
          : attendance?.absence_category === "absent"
            ? { label: "Alfa", badge: "attendance-state-absent", desc: "Tidak ada keterangan kehadiran hari ini." }
            : attendance?.absence_category === "dispensation"
              ? { label: "Dispensasi", badge: "attendance-state-dispensation", desc: "Tercatat dispensasi kegiatan resmi." }
              : { label: "Belum Ditandai", badge: "attendance-state-unmarked", desc: "Anda belum melakukan presensi hari ini." };

  return (
    <div className="student-dashboard">
      <header className="page-header">
        <div>
          <p className="eyebrow">Portal Siswa</p>
          <h1>Selamat Datang, {person.fullName}</h1>
          <p className="muted">
            Kelas {student.class_name ?? "-"} · SMAN 2 Cimalaka
          </p>
        </div>
        <span className="status-badge status-active">Aktif</span>
      </header>

      <div className="student-home-grid">
        <section className="card student-attendance-primary" aria-labelledby="today-attendance-title">
          <div className="student-status-header">
            <div>
              <p className="eyebrow">
                {dateFormatter.format(new Date(`${today}T00:00:00.000Z`))}
              </p>
              <h2 id="today-attendance-title">Presensi Hari Ini</h2>
            </div>
            <span className={`status-badge attendance-state ${statusInfo.badge}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="student-status-desc">{statusInfo.desc}</p>

          <div className="student-attendance-times">
            <div className="student-time-item">
              <span className="student-time-label">Jam Masuk</span>
              <strong className="student-time-val">
                {attendance?.check_in_at ? `${schoolTime(attendance.check_in_at)} WIB` : "-"}
              </strong>
            </div>
            <div className="student-time-item">
              <span className="student-time-label">Jam Pulang</span>
              <strong className="student-time-val">
                {attendance?.check_out_at
                  ? `${schoolTime(attendance.check_out_at)} WIB`
                  : attendance?.check_in_at
                    ? "Belum dicatat"
                    : "-"}
              </strong>
            </div>
          </div>

          <div className="student-home-actions">
            <Link className="button button-primary student-scan-primary" href="/student/scan">
              Scan QR Presensi
            </Link>
            <Link className="button button-secondary" href="/attendance/history">
              Lihat Riwayat Saya
            </Link>
          </div>
          <p className="muted student-scan-note">
            QR hanya memulai proses. Tanggal, waktu, dan status ditentukan server sekolah.
          </p>
        </section>

        <section className="card student-identity-card" aria-labelledby="student-identity-title">
          <h2 id="student-identity-title">Identitas akun</h2>
          <ul className="status-list">
            <li><span>Nama lengkap</span><strong>{person.fullName}</strong></li>
            <li><span>ID siswa</span><strong>{person.loginId}</strong></li>
            <li><span>Kelas</span><strong>{student.class_name ?? "-"}</strong></li>
            <li><span>Status akun</span><strong>{student.claimed_at ? "Sudah diaktivasi" : "Belum diaktivasi"}</strong></li>
          </ul>
          <div className="page-actions account-actions">
            <Link className="button button-secondary" href="/change-password">Ubah kata sandi</Link>
            <form action={logoutAction}>
              <button className="button button-quiet" type="submit">Keluar</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
