import { requireCurrentPerson } from "@/lib/auth/require-person";

export default async function AdminPage() {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  return (
    <section className="card narrow">
      <p className="eyebrow">Khusus administrator</p>
      <h1>Administrasi</h1>
      <p className="muted">Kontrol akses administrator sudah aktif. Pengelolaan guru, siswa, dan pengaturan akan ditambahkan pada milestone berikutnya.</p>
    </section>
  );
}
