"use client";

export default function TeacherAttendanceError({ reset }: { reset: () => void }) {
  return (
    <section className="card narrow">
      <p className="eyebrow">Presensi hari ini</p>
      <h1>Data belum dapat dimuat</h1>
      <p className="alert alert-error" role="alert">
        Periksa koneksi internet, lalu coba muat kembali daftar presensi.
      </p>
      <button className="button button-primary" type="button" onClick={reset}>Coba lagi</button>
    </section>
  );
}
