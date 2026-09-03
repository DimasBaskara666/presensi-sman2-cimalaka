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
      <section className="auth-card" aria-labelledby="activation-title">
        <div className="auth-brand">
          <SchoolLogo variant="color" height={54} priority />
        </div>
        <p className="eyebrow">Aktivasi siswa</p>
        <h1 id="activation-title">Aktifkan akun Anda</h1>
        <p className="muted">
          Gunakan ID siswa dan kode satu kali yang diberikan sekolah, kemudian buat kata sandi pribadi.
        </p>
        <ActivationForm />
        <p className="muted auth-footer-link">Sudah aktif? <Link href="/login">Masuk</Link></p>
      </section>
    </main>
  );
}
