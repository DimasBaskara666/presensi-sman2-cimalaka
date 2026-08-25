"use client";

export default function AdminQrError({ reset }: { reset: () => void }) {
  return (
    <section className="card narrow">
      <h1>Pengelolaan QR belum tersedia</h1>
      <p className="alert alert-error" role="alert">Data QR tidak dapat dimuat. Periksa koneksi lalu coba lagi.</p>
      <button className="button button-primary" type="button" onClick={reset}>Coba lagi</button>
    </section>
  );
}
