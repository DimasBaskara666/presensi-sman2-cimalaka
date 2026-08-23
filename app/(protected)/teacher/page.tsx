import { requireCurrentPerson } from "@/lib/auth/require-person";

export default async function TeacherPage() {
  await requireCurrentPerson({ allowedRoles: ["admin", "teacher"] });
  return (
    <section className="card narrow">
      <p className="eyebrow">Guru dan administrator</p>
      <h1>Operasional guru</h1>
      <p className="muted">Kontrol akses guru sudah aktif. QR, pemantauan, presensi manual, dan kategori ketidakhadiran belum diterapkan.</p>
    </section>
  );
}
