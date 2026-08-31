import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { getBulkActivationStats } from "@/lib/students/student-activation-bulk";
import { BulkActivationControl } from "./bulk-activation-control";

export const dynamic = "force-dynamic";

export default async function BulkActivationPage() {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const stats = await getBulkActivationStats();

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Administrator only</p>
          <h1>Aktivasi Massal & Cetak Slip Siswa</h1>
          <p className="muted">
            Generate dan unduh slip kode aktivasi untuk dibagikan kepada siswa atau wali kelas.
          </p>
        </div>
        <div className="page-actions">
          <Link className="button button-secondary" href="/admin/students">
            Kembali ke Kelola Siswa
          </Link>
        </div>
      </header>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Ringkasan Status Aktivasi Sekolah</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
          }}
        >
          <div className="card" style={{ background: "var(--color-bg-subtle, #f5f8f7)", padding: "1rem" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Total Siswa Terdaftar</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 700 }}>
              {stats.totalStudents}
            </p>
          </div>
          <div className="card" style={{ background: "var(--color-bg-subtle, #f5f8f7)", padding: "1rem" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Sudah Diaktivasi</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 700, color: "#126b51" }}>
              {stats.activatedCount}
            </p>
          </div>
          <div className="card" style={{ background: "var(--color-bg-subtle, #f5f8f7)", padding: "1rem" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Sudah Ada Kode Aktif</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 700, color: "#2563eb" }}>
              {stats.hasCodeCount}
            </p>
          </div>
          <div className="card" style={{ background: "var(--color-bg-subtle, #f5f8f7)", padding: "1rem" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Belum Memiliki Kode</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 700, color: "#d97706" }}>
              {stats.needsCodeCount}
            </p>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Generate & Unduh Slip Aktivasi</h2>
        <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
          Pilih kelas untuk mencetak slip per kelas, atau pilih semua kelas untuk mencetak slip seluruh sekolah sekaligus.
        </p>
        <BulkActivationControl
          classes={stats.classes}
          needsCodeCount={stats.needsCodeCount}
        />
      </section>

      <section className="card">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Rincian Status Aktivasi per Kelas</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kelas</th>
                <th>Total Siswa</th>
                <th>Sudah Aktif</th>
                <th>Sudah Ada Kode</th>
                <th>Belum Punya Kode</th>
                <th>Aksi Cetak</th>
              </tr>
            </thead>
            <tbody>
              {stats.classBreakdown.map((row) => (
                <tr key={row.className}>
                  <td><strong>Kelas {row.className}</strong></td>
                  <td>{row.total}</td>
                  <td>
                    <span className="status-badge status-active">{row.activated}</span>
                  </td>
                  <td>{row.hasCode}</td>
                  <td>
                    {row.needsCode > 0 ? (
                      <span className="status-badge status-inactive">{row.needsCode} perlu kode</span>
                    ) : (
                      <span className="muted">Lengkap</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <a
                        href={`/admin/students/activation-bulk/pdf?class=${encodeURIComponent(row.className)}&mode=missing`}
                        className="button button-secondary button-small"
                        download
                      >
                        Unduh Slip Baru
                      </a>
                      <a
                        href={`/admin/students/activation-bulk/pdf?class=${encodeURIComponent(row.className)}&mode=all`}
                        className="button button-secondary button-small"
                        title="Buat ulang semua kode untuk siswa yang belum aktif di kelas ini"
                        download
                      >
                        Reset & Cetak Ulang
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
