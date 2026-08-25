import { requireCurrentPerson } from "@/lib/auth/require-person";

const roleCopy = {
  admin: {
    title: "Dasbor Administrator",
    description: "Kelola fondasi akun dan kebijakan aplikasi dari area terproteksi.",
  },
  teacher: {
    title: "Dasbor Guru",
    description: "Pilih kelas dan catat presensi siswa hari ini dari area operasional guru.",
  },
  student: {
    title: "Dasbor Siswa",
    description: "Pindai QR sekolah untuk mencatat presensi masuk atau pulang dari akun Anda.",
  },
} as const;

export default async function DashboardPage() {
  const person = await requireCurrentPerson();
  const copy = roleCopy[person.role];

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Fondasi akun aktif</p>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.description}</p>
        </div>
        <span className="role-badge">{person.role}</span>
      </header>

      <div className="grid">
        <section className="card">
          <h2>Identitas akun</h2>
          <p className="muted">Nama dan peran ini dibaca dari tabel people yang terhubung ke sesi Auth.</p>
          <ul className="status-list">
            <li><span>Nama</span><strong>{person.fullName}</strong></li>
            <li><span>ID</span><strong>{person.loginId}</strong></li>
            <li><span>Peran</span><strong>{person.role}</strong></li>
          </ul>
        </section>
        <section className="card">
          <h2>Keamanan</h2>
          <p className="muted">Sesi menggunakan Supabase Auth. Otorisasi halaman diperiksa kembali di server.</p>
        </section>
        <section className="card">
          <h2>Operasional aktif</h2>
          <p className="muted">Impor siswa, presensi manual Guru, dan QR presensi Siswa menggunakan transaksi PostgreSQL terkontrol.</p>
        </section>
      </div>
    </>
  );
}
