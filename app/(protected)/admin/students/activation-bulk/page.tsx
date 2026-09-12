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
          <p className="eyebrow">Khusus administrator</p>
          <h1>Aktivasi Massal &amp; Cetak Slip Siswa</h1>
          <p className="muted">
            Buat dan unduh slip kode aktivasi untuk dibagikan kepada siswa atau wali kelas.
          </p>
        </div>
        <div className="page-actions">
          <Link className="button button-secondary" href="/admin/students">
            Kembali ke Kelola Siswa
          </Link>
        </div>
      </header>

      <section className="card">
        <h2>Ringkasan Status Aktivasi Sekolah</h2>
        <div className="bulk-stat-grid">
          <div className="bulk-stat-card">
            <p className="bulk-stat-label">Total Siswa Terdaftar</p>
            <p className="bulk-stat-value">
              {stats.totalStudents}
            </p>
          </div>
          <div className="bulk-stat-card">
            <p className="bulk-stat-label">Sudah Diaktivasi</p>
            <p className="bulk-stat-value is-success">
              {stats.activatedCount}
            </p>
          </div>
          <div className="bulk-stat-card">
            <p className="bulk-stat-label">Sudah Ada Kode Aktif</p>
            <p className="bulk-stat-value is-primary">
              {stats.hasCodeCount}
            </p>
          </div>
          <div className="bulk-stat-card">
            <p className="bulk-stat-label">Belum Memiliki Kode</p>
            <p className="bulk-stat-value is-warning">
              {stats.needsCodeCount}
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Buat &amp; Unduh Slip Aktivasi</h2>
        <p className="muted">
          Pilih kelas untuk mencetak slip per kelas, atau pilih semua kelas untuk mencetak slip seluruh sekolah sekaligus.
        </p>
        <BulkActivationControl
          classes={stats.classes}
          needsCodeCount={stats.needsCodeCount}
        />
      </section>

      <section className="card">
        <h2>Rincian Status Aktivasi per Kelas</h2>
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
                    <div className="action-row">
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
                        Reset &amp; Cetak Ulang
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
