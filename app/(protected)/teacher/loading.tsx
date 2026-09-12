export default function TeacherAttendanceLoading() {
  return (
    <div className="teacher-attendance-page" aria-busy="true" aria-live="polite">
      <header className="page-header attendance-page-header">
        <div>
          <p className="eyebrow">Presensi hari ini</p>
          <h1>Presensi Manual</h1>
          <p className="muted">Memuat data kelas dan status presensi hari ini…</p>
        </div>
        <span className="role-badge">Guru</span>
      </header>

      <div className="teacher-top-cards">
        <div className="card attendance-class-card">
          <div>
            <h2>QR Presensi Sekolah</h2>
            <p className="muted">Mulai atau tampilkan sesi QR bersama yang berganti otomatis setiap lima menit.</p>
          </div>
          <div className="skeleton-box skeleton-button" />
        </div>

        <div className="card attendance-class-card">
          <div>
            <h2>Pilih kelas</h2>
            <p className="muted">Tampilkan satu kelas agar pencatatan tetap cepat dan jelas.</p>
          </div>
          <div className="skeleton-box skeleton-button" />
        </div>
      </div>

      <div className="card attendance-board-card">
        <div className="attendance-board-toolbar">
          <div className="skeleton-box skeleton-search" />
          <div className="skeleton-box skeleton-text-short" />
        </div>
        <div className="table-wrap attendance-table-wrap">
          <table className="data-table attendance-table">
            <thead>
              <tr>
                <th className="th-no">No</th>
                <th className="th-student">Siswa</th>
                <th className="th-status">Status</th>
                <th className="th-time">Waktu</th>
                <th className="th-actions">Tandai Kehadiran</th>
                <th className="th-note">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="attendance-row">
                  <td className="td-no">
                    <span className="skeleton-box skeleton-cell-no" />
                  </td>
                  <td className="td-student">
                    <div className="attendance-student-meta">
                      <span className="skeleton-box skeleton-cell-name" />
                      <span className="skeleton-box skeleton-cell-id" />
                    </div>
                  </td>
                  <td className="td-status">
                    <span className="skeleton-box skeleton-cell-badge" />
                  </td>
                  <td className="td-time">
                    <span className="skeleton-box skeleton-cell-time" />
                  </td>
                  <td className="td-actions">
                    <span className="skeleton-box skeleton-cell-actions" />
                  </td>
                  <td className="td-note">
                    <span className="skeleton-box skeleton-cell-note" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
