"use client";

export default function AttendanceHistoryError({ reset }: { reset: () => void }) {
  return (
    <section className="card narrow">
      <h1>Riwayat belum tersedia</h1>
      <p className="alert alert-error" role="alert">Data riwayat tidak dapat dimuat. Periksa koneksi lalu coba lagi.</p>
      <button className="button button-primary" type="button" onClick={reset}>Coba lagi</button>
    </section>
  );
}

