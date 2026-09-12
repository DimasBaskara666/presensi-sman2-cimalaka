import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";

export default async function AdminPage() {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Khusus administrator</p>
          <h1>Administrasi</h1>
          <p className="muted">Kelola akun yang dibuat melalui operasi server terpercaya.</p>
        </div>
      </header>

      <div className="admin-sections">
        <section className="card narrow" aria-labelledby="section-settings-title">
          <h2 id="section-settings-title">Pengaturan Presensi</h2>
          <p className="muted">Atur jam masuk, toleransi keterlambatan, dan minimum jam pulang.</p>
          <Link className="button button-primary" href="/admin/attendance-settings">Buka Pengaturan</Link>
        </section>
        <section className="card narrow" aria-labelledby="section-corrections-title">
          <h2 id="section-corrections-title">Koreksi Presensi</h2>
          <p className="muted">Koreksi catatan presensi dengan alasan dan riwayat audit.</p>
          <Link className="button button-primary" href="/admin/attendance-corrections">Buka Koreksi</Link>
        </section>
        <section className="card narrow" aria-labelledby="section-history-title">
          <h2 id="section-history-title">Riwayat dan Laporan</h2>
          <p className="muted">Filter riwayat presensi dan unduh laporan PDF sesuai periode.</p>
          <Link className="button button-primary" href="/attendance/history">Buka Riwayat</Link>
        </section>
        <section className="card narrow" aria-labelledby="section-qr-title">
          <h2 id="section-qr-title">QR Presensi Siswa</h2>
          <p className="muted">Mulai, tampilkan, atau hentikan satu sesi QR sekolah bersama.</p>
          <Link className="button button-primary" href="/admin/attendance-qr">Kelola QR Presensi</Link>
        </section>
        <section className="card narrow" aria-labelledby="section-students-title">
          <h2 id="section-students-title">Kelola Siswa</h2>
          <p className="muted">Impor dan kelola data roster siswa, aktivasi akun, dan pemulihan kata sandi.</p>
          <Link className="button button-primary" href="/admin/students">Buka Kelola Siswa</Link>
        </section>
        <section className="card narrow" aria-labelledby="section-teachers-title">
          <h2 id="section-teachers-title">Pengelolaan Guru</h2>
          <p className="muted">Buat akun guru, aktifkan atau nonaktifkan akses, dan reset kata sandi.</p>
          <Link className="button button-primary" href="/admin/teachers">Kelola Guru</Link>
        </section>
      </div>
    </>
  );
}
