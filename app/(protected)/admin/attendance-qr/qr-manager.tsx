"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  generateAttendanceQrAction,
  revokeAttendanceQrAction,
  type AdminQrActionResult,
} from "./actions";

type ActiveQrMetadata = {
  createdAt: string;
  expiresAt: string;
} | null;

function expiryLabel(expiresAt: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(expiresAt));
}

export function AdminQrManager({ initialActive }: { initialActive: ActiveQrMetadata }) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AdminQrActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      setFeedback(null);
      try {
        const result = await generateAttendanceQrAction();
        setFeedback(result);
        if (result.ok && result.imageDataUrl && result.expiresAt) {
          setImageDataUrl(result.imageDataUrl);
          setActive({ createdAt: "", expiresAt: result.expiresAt });
          router.refresh();
        }
      } catch {
        setFeedback({ ok: false, message: "Koneksi terputus. Coba buat QR kembali.", imageDataUrl: null, expiresAt: null });
      }
    });
  }

  function revoke() {
    startTransition(async () => {
      setFeedback(null);
      try {
        const result = await revokeAttendanceQrAction();
        setFeedback(result);
        if (result.ok) {
          setImageDataUrl(null);
          setActive(null);
          router.refresh();
        }
      } catch {
        setFeedback({ ok: false, message: "Koneksi terputus. QR belum dicabut.", imageDataUrl: null, expiresAt: null });
      }
    });
  }

  return (
    <div className="admin-qr-layout">
      <section className="card admin-qr-controls" aria-labelledby="qr-controls-title">
        <div>
          <p className="eyebrow">Kontrol QR</p>
          <h2 id="qr-controls-title">QR presensi aktif</h2>
        </div>

        {active ? (
          <dl className="admin-qr-metadata">
            <div><dt>Status</dt><dd>QR terakhir</dd></div>
            <div><dt>Berlaku sampai</dt><dd>{expiryLabel(active.expiresAt)} WIB</dd></div>
          </dl>
        ) : (
          <p className="empty-state">Belum ada QR aktif.</p>
        )}

        <div className="page-actions admin-qr-actions">
          <button className="button button-primary" type="button" disabled={pending} onClick={generate}>
            {pending ? "Memproses…" : active ? "Putar QR Baru" : "Buat QR Aktif"}
          </button>
          <button className="button button-secondary" type="button" disabled={pending || !active} onClick={revoke}>
            Cabut QR
          </button>
        </div>

        <p className="muted admin-qr-security-note">
          Membuat QR baru otomatis mencabut QR sebelumnya. Gambar hanya dapat ditampilkan pada sesi pembuatan ini karena sistem tidak menyimpan token aslinya.
        </p>
        {feedback ? (
          <p className={`alert ${feedback.ok ? "alert-success" : "alert-error"}`} role={feedback.ok ? "status" : "alert"}>
            {feedback.message}
          </p>
        ) : null}
      </section>

      <section className="card admin-qr-display" aria-labelledby="qr-display-title">
        <div className="admin-qr-display-heading">
          <div>
            <p className="eyebrow">Layar / cetak sementara</p>
            <h2 id="qr-display-title">Pindai QR Presensi</h2>
          </div>
          {imageDataUrl ? (
            <button className="button button-secondary print-hidden" type="button" onClick={() => window.print()}>Cetak</button>
          ) : null}
        </div>

        {imageDataUrl && active ? (
          <div className="admin-qr-image-panel">
            <Image src={imageDataUrl} alt="QR presensi siswa aktif" width={1024} height={1024} unoptimized priority />
            <p>Pindai menggunakan kamera ponsel atau menu Scan QR pada akun siswa.</p>
            <strong>Berlaku sampai {expiryLabel(active.expiresAt)} WIB</strong>
          </div>
        ) : (
          <div className="admin-qr-placeholder">
            <span aria-hidden="true">QR</span>
            <p>Buat atau putar QR untuk menampilkan gambar yang dapat dipindai.</p>
          </div>
        )}
      </section>
    </div>
  );
}
