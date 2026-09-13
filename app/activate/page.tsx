/**
 * Presensi SMAN 2 Cimalaka
 * © 2026 Dimas Bratakusumah
 * Institut Teknologi Nasional Bandung
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { SchoolLogo } from "@/components/school-logo";
import { getCurrentPerson } from "@/lib/auth/current-person";
import { ActivationForm } from "./activation-form";

export const dynamic = "force-dynamic";

export default async function ActivatePage() {
  const person = await getCurrentPerson();
  if (person) redirect(person.role === "student" ? "/student" : "/dashboard");

  return (
    <main className="auth-page">
      <section className="auth-card auth-card-wide" aria-labelledby="activation-title">
        <div className="auth-card-body">
          <header className="auth-header">
            <div className="auth-brand">
              <SchoolLogo variant="color" height={54} priority />
            </div>
            <span className="auth-badge">Pendaftaran Akun Baru</span>
            <h1 id="activation-title" className="auth-title">Aktivasi Akun Siswa Mandiri</h1>
            <p className="auth-subtitle">
              Masukkan NIS dan Kode Aktivasi 8 karakter dari slip sekolah, kemudian buat kata sandi pribadi Anda.
            </p>
          </header>

          <ActivationForm />
        </div>

        {/* Bottom Shelf */}
        <div className="auth-card-shelf">
          <div>
            <strong>Sudah pernah mengaktifkan akun?</strong>
            <p className="form-hint">Masuk langsung menggunakan NIS dan kata sandi Anda.</p>
          </div>
          <Link href="/login" className="auth-shelf-link">
            <span>Masuk ke Akun</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Attribution Footer */}
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
