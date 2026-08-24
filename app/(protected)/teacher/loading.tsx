export default function TeacherAttendanceLoading() {
  return (
    <div className="card attendance-loading" aria-busy="true" aria-live="polite">
      <p className="eyebrow">Presensi hari ini</p>
      <h1>Memuat daftar siswa…</h1>
      <p className="muted">Mengambil kelas dan status presensi terbaru.</p>
    </div>
  );
}

