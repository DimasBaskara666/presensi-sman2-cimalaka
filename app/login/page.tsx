/**
 * Presensi SMAN 2 Cimalaka
 * © 2026 Dimas Bratakusumah
 * Institut Teknologi Nasional Bandung
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { SchoolLogo } from "@/components/school-logo";
import { getCurrentPerson } from "@/lib/auth/current-person";
import { shouldRequirePasswordChange } from "@/lib/auth/password-policy";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; status?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "ID atau kata sandi tidak valid. Periksa kembali ID dan kata sandi Anda.",
  service: "Layanan masuk belum tersedia. Periksa koneksi atau hubungi administrator sekolah.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const person = await getCurrentPerson();
  if (person) redirect(shouldRequirePasswordChange(person) ? "/change-password" : "/dashboard");

  const { error, status } = await searchParams;
  const errorMessage = error ? errorMessages[error] : null;

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-card-body">
          <header className="auth-header">
            <div className="auth-brand">
              <SchoolLogo variant="color" height={54} priority />
            </div>
            <span className="auth-badge">Pemerintah Daerah Provinsi Jawa Barat</span>
            <h1 id="login-title" className="auth-title">SMAN 2 Cimalaka</h1>
            <p className="auth-subtitle">Sistem Presensi Digital Terpadu</p>
          </header>

          {errorMessage ? (
            <p className="alert alert-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {status === "activated" ? (
            <p className="alert alert-success" role="status">
              Akun sudah aktif. Silakan masuk menggunakan NIS dan kata sandi baru Anda.
            </p>
          ) : null}

          <LoginForm />
        </div>

        {/* Bottom Shelf (Callout Aktivasi Siswa Baru) */}
        <div className="auth-card-shelf">
          <div>
            <strong>Siswa baru atau belum punya kata sandi?</strong>
            <p className="form-hint">Gunakan NIS aktif Anda untuk aktivasi perdana.</p>
          </div>
          <Link href="/activate" className="auth-shelf-link">
            <span>Aktivasi Akun</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
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
