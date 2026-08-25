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

  const status = attendance?.check_in_status === "on_time"
    ? "Hadir tepat waktu"
    : attendance?.check_in_status === "late"
      ? "Terlambat"
      : attendance?.absence_category === "sick"
        ? "Sakit"
        : attendance?.absence_category === "permission"
          ? "Izin"
          : attendance?.absence_category === "absent"
            ? "Alfa"
            : attendance?.absence_category === "dispensation"
              ? "Dispensasi"
              : "Belum ditandai";

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Akun siswa</p>
          <h1>Selamat datang, {person.fullName}</h1>
          <p className="muted">Halaman ini membuktikan akun siswa telah terhubung ke sesi Supabase Auth.</p>
        </div>
        <span className="status-badge status-active">Aktif</span>
      </header>

      <div className="student-home-grid">
      <section className="card student-attendance-primary">
        <p className="eyebrow">Presensi hari ini</p>
        <h2>{status}</h2>
        {attendance?.check_in_at ? (
          <div className="student-attendance-times">
            <span>Masuk <strong>{schoolTime(attendance.check_in_at)} WIB</strong></span>
            <span>Pulang <strong>{attendance.check_out_at ? `${schoolTime(attendance.check_out_at)} WIB` : "Belum"}</strong></span>
          </div>
        ) : null}
        <Link className="button button-primary student-scan-primary" href="/student/scan">Scan QR Presensi</Link>
        <p className="muted">QR hanya memulai proses. Tanggal, waktu, dan status ditentukan server sekolah.</p>
      </section>

      <section className="card">
        <h2>Identitas akun</h2>
        <ul className="status-list">
          <li><span>Nama</span><strong>{person.fullName}</strong></li>
          <li><span>ID siswa</span><strong>{person.loginId}</strong></li>
          <li><span>Kelas</span><strong>{student.class_name}</strong></li>
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
    </>
  );
}
