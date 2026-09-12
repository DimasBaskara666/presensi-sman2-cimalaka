import Link from "next/link";
import { redirect } from "next/navigation";
import { SchoolLogo } from "@/components/school-logo";
import { getCurrentPerson } from "@/lib/auth/current-person";
import { shouldRequirePasswordChange } from "@/lib/auth/password-policy";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; status?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "ID atau kata sandi tidak valid.",
  service: "Layanan masuk belum tersedia. Periksa konfigurasi Supabase lokal.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const person = await getCurrentPerson();
  if (person) redirect(shouldRequirePasswordChange(person) ? "/change-password" : "/dashboard");

  const { error, status } = await searchParams;
  const errorMessage = error ? errorMessages[error] : null;

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-brand">
          <SchoolLogo variant="color" height={54} priority />
        </div>
        <p className="eyebrow">SMAN 2 Cimalaka</p>
        <h1 id="login-title">Masuk ke Presensi</h1>
        <p className="muted">Gunakan ID sekolah dan kata sandi akun Anda.</p>

        {errorMessage ? <p className="alert alert-error" role="alert">{errorMessage}</p> : null}
        {status === "activated" ? (
          <p className="alert alert-success" role="status">Akun sudah aktif. Silakan masuk menggunakan kata sandi baru.</p>
        ) : null}

        <form action={loginAction} className="form-stack">
          <div className="field">
            <label htmlFor="login_id">ID / Username</label>
            <input
              id="login_id"
              name="login_id"
              type="text"
              autoComplete="username"
              autoCapitalize="characters"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Kata sandi</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="button button-primary" type="submit">
            Masuk
          </button>
        </form>

        <p className="auth-footer-link">
          Siswa baru? <Link href="/activate">Aktifkan akun</Link>.{" "}
          <Link href="/">Kembali</Link>
        </p>
      </section>
    </main>
  );
}
