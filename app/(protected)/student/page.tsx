import Link from "next/link";
import { logoutAction } from "@/app/logout-action";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { createClient } from "@/lib/supabase/server";

export default async function StudentPage() {
  const person = await requireCurrentPerson({ allowedRoles: ["student"] });
  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from("people")
    .select("class_name, claimed_at")
    .eq("id", person.id)
    .single();
  if (error || !student) throw new Error("Student profile could not be loaded.");

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

      <section className="card narrow">
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
        <p className="muted account-scope-note">Fitur presensi belum tersedia pada milestone ini.</p>
      </section>
    </>
  );
}
