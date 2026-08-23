import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <section className="card narrow">
      <p className="eyebrow">Akses ditolak</p>
      <h1>Peran Anda tidak memiliki izin</h1>
      <p className="muted">Otorisasi halaman berasal dari peran akun di database.</p>
      <Link className="button button-secondary" href="/dashboard">Kembali ke dasbor</Link>
    </section>
  );
}
