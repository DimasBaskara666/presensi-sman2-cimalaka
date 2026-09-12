export default function AttendanceHistoryLoading() {
  return (
    <div className="history-page" aria-busy="true" aria-live="polite">
      <header className="page-header history-page-header">
        <div>
          <p className="eyebrow">Riwayat presensi</p>
          <h1>Laporan Kehadiran</h1>
          <p className="muted">Memuat data riwayat presensi…</p>
        </div>
      </header>

      <div className="card history-filter-card">
        <div>
          <h2>Filter laporan</h2>
          <p className="muted">Maksimal 31 hari per permintaan.</p>
        </div>
        <div className="history-filter-form">
          <div className="skeleton-box skeleton-input" />
          <div className="skeleton-box skeleton-input" />
          <div className="skeleton-box skeleton-input" />
          <div className="skeleton-box skeleton-button" />
        </div>
      </div>

      <div className="history-record-list history-loading-list">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="history-record-card">
            <div className="history-record-heading">
              <div>
                <span className="skeleton-box skeleton-text-short" />
                <span className="skeleton-box skeleton-cell-name" />
              </div>
              <span className="skeleton-box skeleton-cell-badge" />
            </div>
            <div className="history-record-details">
              <div><span className="skeleton-box skeleton-cell-time" /></div>
              <div><span className="skeleton-box skeleton-cell-time" /></div>
              <div><span className="skeleton-box skeleton-cell-time" /></div>
              <div><span className="skeleton-box skeleton-cell-time" /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

