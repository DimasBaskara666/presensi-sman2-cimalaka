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
        <section className="card narrow">
          <h2>Pengelolaan Guru</h2>
          <p className="muted">Buat akun guru, aktifkan atau nonaktifkan akses, dan reset kata sandi.</p>
          <Link className="button button-primary" href="/admin/teachers">Kelola guru</Link>
        </section>
      </div>
    </>
  );
}
