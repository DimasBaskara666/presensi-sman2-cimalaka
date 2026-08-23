import { requireCurrentPerson } from "@/lib/auth/require-person";

export default async function StudentPage() {
  await requireCurrentPerson({ allowedRoles: ["student"] });
  return (
    <section className="card narrow">
      <p className="eyebrow">Data pribadi siswa</p>
      <h1>Presensi saya</h1>
      <p className="muted">Halaman ini sudah dibatasi untuk siswa yang sedang masuk. Data presensi akan ditampilkan setelah transaksi presensi diterapkan.</p>
    </section>
  );
}
