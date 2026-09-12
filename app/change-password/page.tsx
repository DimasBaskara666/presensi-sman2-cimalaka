import Link from "next/link";
import { shouldRequirePasswordChange } from "@/lib/auth/password-policy";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { logoutAction } from "@/app/logout-action";
import { changePasswordAction } from "./actions";

export const dynamic = "force-dynamic";

type ChangePasswordPageProps = {
  searchParams: Promise<{ error?: string; status?: string }>;
};

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  const person = await requireCurrentPerson({ allowPasswordChangeRequired: true });
  const { error, status } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-title">
        <p className="eyebrow">Akun {person.loginId}</p>
        <h1 id="password-title">Ubah kata sandi</h1>
        <p className="muted">Kata sandi diproses langsung oleh Supabase Auth dan tidak disimpan aplikasi.</p>

        {error ? (
          <p className="alert alert-error" role="alert">
            {error === "invalid"
              ? "Lengkapi semua kolom dan pastikan konfirmasi sama."
              : error === "student_policy"
                ? "Kata sandi siswa harus memiliki minimal 10 karakter, satu huruf, satu angka, dan berbeda dari ID siswa."
                : "Kata sandi tidak dapat diubah. Periksa kata sandi saat ini dan kebijakan kata sandi."}
          </p>
        ) : null}
        {status === "success" ? <p className="alert alert-success" role="status">Kata sandi berhasil diubah.</p> : null}
        {status === "partial" ? (
          <p className="alert alert-error" role="alert">
            Kata sandi sudah berubah, tetapi penanda profil belum diperbarui. Hubungi administrator.
          </p>
        ) : null}

        <form action={changePasswordAction} className="form-stack">
          <div className="field">
            <label htmlFor="current_password">Kata sandi saat ini</label>
            <input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
          </div>
          <div className="field">
            <label htmlFor="new_password">Kata sandi baru</label>
            <input id="new_password" name="new_password" type="password" autoComplete="new-password" minLength={person.role === "student" ? 10 : undefined} required />
          </div>
          <div className="field">
            <label htmlFor="confirm_password">Ulangi kata sandi baru</label>
            <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" minLength={person.role === "student" ? 10 : undefined} required />
          </div>
          <button className="button button-primary" type="submit">Simpan kata sandi</button>
        </form>

        <div className="page-actions password-actions">
          {!shouldRequirePasswordChange(person) ? (
            <Link className="button button-secondary" href="/dashboard">Kembali</Link>
          ) : null}
          <form action={logoutAction}><button className="button button-quiet" type="submit">Keluar</button></form>
        </div>
      </section>
    </main>
  );
}
