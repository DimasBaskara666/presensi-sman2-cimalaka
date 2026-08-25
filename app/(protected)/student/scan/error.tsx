"use client";

export default function StudentScanError({ reset }: { reset: () => void }) {
  return (
    <section className="card narrow">
      <h1>Pemindai belum tersedia</h1>
      <p className="alert alert-error" role="alert">Halaman tidak dapat dimuat. Periksa koneksi lalu coba lagi.</p>
      <button className="button button-primary" type="button" onClick={reset}>Coba lagi</button>
    </section>
  );
}
