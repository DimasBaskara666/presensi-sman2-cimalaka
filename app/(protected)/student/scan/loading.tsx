export default function StudentScanLoading() {
  return (
    <div className="student-scan-page" aria-busy="true" aria-live="polite">
      <header className="page-header attendance-page-header">
        <div>
          <p className="eyebrow">Presensi siswa</p>
          <h1>Pindai QR Presensi</h1>
          <p className="muted">Menyiapkan pemindai QR…</p>
        </div>
        <span className="role-badge">Siswa</span>
      </header>

      <div className="card student-scan-card">
        <div>
          <div className="skeleton-box skeleton-text-short" />
          <div className="skeleton-box skeleton-text-medium" />
        </div>
        <div className="skeleton-box skeleton-scanner-frame" />
        <div className="skeleton-box skeleton-scan-btn" />
      </div>
    </div>
  );
}
