export default function AdminQrLoading() {
  return (
    <div className="admin-qr-page" aria-busy="true" aria-live="polite">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administrator · sesi sekolah bersama</p>
          <h1>QR Presensi Siswa</h1>
          <p className="muted">Memuat pengelolaan sesi QR…</p>
        </div>
      </header>
      <div className="admin-qr-layout">
        <div className="card admin-qr-controls">
          <div className="skeleton-box skeleton-text-short" />
          <div className="skeleton-box skeleton-button" />
        </div>
        <div className="card admin-qr-display">
          <div className="skeleton-box skeleton-scanner-frame" />
        </div>
      </div>
    </div>
  );
}

