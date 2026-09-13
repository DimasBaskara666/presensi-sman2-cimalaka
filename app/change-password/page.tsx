/**
 * Presensi SMAN 2 Cimalaka
 * © 2026 Dimas Bratakusumah
 * Institut Teknologi Nasional Bandung
 */

import Link from "next/link";
import { SchoolLogo } from "@/components/school-logo";
import { shouldRequirePasswordChange } from "@/lib/auth/password-policy";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { logoutAction } from "@/app/logout-action";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

type ChangePasswordPageProps = {
  searchParams: Promise<{ error?: string; status?: string }>;
};

const roleLabels = {
  admin: "Administrator",
  teacher: "Guru",
  student: "Siswa",
} as const;

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  const person = await requireCurrentPerson({ allowPasswordChangeRequired: true });
  const { error, status } = await searchParams;

  const returnHref = person.role === "student" ? "/student" : "/dashboard";

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-title">
        <div className="auth-card-body">
          <header className="auth-header">
            <div className="auth-brand">
              <SchoolLogo variant="color" height={54} priority />
            </div>
            <span className="auth-badge">{roleLabels[person.role]} - {person.loginId}</span>
            <h1 id="password-title" className="auth-title">Ubah Kata Sandi</h1>
            <p className="auth-subtitle">
              Kata sandi akun Anda dilindungi enkripsi standar institusi dan diverifikasi langsung oleh sistem keamanan sekolah.
            </p>
          </header>

          {error ? (
            <p className="alert alert-error" role="alert">
              {error === "invalid"
                ? "Lengkapi semua kolom dan pastikan konfirmasi kata sandi cocok."
                : error === "student_policy"
                  ? "Kata sandi siswa harus memiliki minimal 10 karakter, satu huruf, satu angka, dan berbeda dari NIS siswa."
                  : "Kata sandi tidak dapat diubah. Periksa kata sandi saat ini dan coba kembali."}
            </p>
          ) : null}
          {status === "success" ? (
            <p className="alert alert-success" role="status">
              Kata sandi berhasil diperbarui. Silakan gunakan kata sandi baru untuk akses berikutnya.
            </p>
          ) : null}
          {status === "partial" ? (
            <p className="alert alert-warning" role="alert">
              Kata sandi sudah berubah, tetapi penanda profil belum diperbarui. Hubungi administrator sekolah.
            </p>
          ) : null}

          <ChangePasswordForm role={person.role} loginId={person.loginId} />

          <div className="password-actions">
            {!shouldRequirePasswordChange(person) ? (
              <Link className="button button-secondary" href={returnHref}>
                Kembali
              </Link>
            ) : <span />}
            <form action={logoutAction}>
              <button className="button button-quiet" type="submit">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Institutional Attribution Footer */}
      <footer className="auth-attribution-footer">
        <div className="auth-attribution-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Sistem Resmi Presensi Digital Terverifikasi</span>
        </div>
        <div>Jalan Tanjungkerta No. 34 Cimalaka, Kabupaten Sumedang</div>
        <div>&copy; {new Date().getFullYear()} SMAN 2 Cimalaka. Hak cipta dilindungi.</div>
        <div className="auth-attribution-author">&copy; 2026 Dimas Bratakusumah &middot; Institut Teknologi Nasional Bandung</div>
      </footer>
    </main>
  );
}
