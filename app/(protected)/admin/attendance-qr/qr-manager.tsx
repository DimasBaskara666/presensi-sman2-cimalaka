"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import {
  refreshAttendanceQrSessionAction,
  startAttendanceQrSessionAction,
  stopAttendanceQrSessionAction,
  type AttendanceQrSessionActionResult,
} from "./actions";

function timestampLabel(timestamp: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

export function SharedQrManager({
  initialState,
}: {
  initialState: AttendanceQrSessionActionResult;
}) {
  const [session, setSession] = useState(initialState);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(
    initialState.message ? { ok: initialState.ok, message: initialState.message } : null,
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const serverRemaining = session.active && session.expiresAt && session.serverNow
      ? Date.parse(session.expiresAt) - Date.parse(session.serverNow) + 250
      : 10_000;
    const delay = Math.max(1_000, Math.min(10_000, serverRemaining));
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await refreshAttendanceQrSessionAction();
          if (result.ok) setSession(result);
          if (!result.ok) setFeedback({ ok: false, message: result.message });
          else if (!result.active) setFeedback(null);
        } catch {
          setFeedback({ ok: false, message: "Koneksi terputus. Tampilan QR akan mencoba lagi." });
        }
      })();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session.active, session.expiresAt, session.serverNow]);

  function startSession() {
    startTransition(async () => {
      setFeedback(null);
      try {
        const result = await startAttendanceQrSessionAction();
        if (result.ok) setSession(result);
        setFeedback({ ok: result.ok, message: result.message });
      } catch {
        setFeedback({ ok: false, message: "Koneksi terputus. Sesi QR belum dimulai." });
      }
    });
  }

  function stopSession() {
    startTransition(async () => {
      setFeedback(null);
      try {
        const result = await stopAttendanceQrSessionAction();
        if (result.ok) setSession(result);
        setFeedback({ ok: result.ok, message: result.message });
      } catch {
        setFeedback({ ok: false, message: "Koneksi terputus. Sesi QR belum dihentikan." });
      }
    });
  }

  return (
    <div className="admin-qr-layout">
      <section className="card admin-qr-controls" aria-labelledby="qr-controls-title">
        <div>
          <p className="eyebrow">Kontrol sesi bersama</p>
          <h2 id="qr-controls-title">QR presensi sekolah</h2>
        </div>

        {session.active && session.createdAt && session.expiresAt ? (
          <dl className="admin-qr-metadata">
            <div><dt>Status</dt><dd>Sesi aktif</dd></div>
            <div><dt>QR dibuat</dt><dd>{timestampLabel(session.createdAt)} WIB</dd></div>
            <div><dt>Berganti pada</dt><dd>{timestampLabel(session.expiresAt)} WIB</dd></div>
          </dl>
        ) : (
          <p className="empty-state">Sesi QR sedang berhenti. Tidak ada QR yang valid.</p>
        )}

        <div className="page-actions admin-qr-actions">
          <button className="button button-primary" type="button" disabled={pending || session.active} onClick={startSession}>
            {pending && !session.active ? "Memulai…" : "Mulai Sesi QR"}
          </button>
          <button className="button button-secondary" type="button" disabled={pending || !session.active} onClick={stopSession}>
            {pending && session.active ? "Memproses…" : "Hentikan Sesi"}
          </button>
        </div>

        <p className="muted admin-qr-security-note">
          PostgreSQL menentukan QR aktif dan menggantinya setiap lima menit. Semua tampilan Admin dan Guru menerima QR sekolah yang sama; QR sebelumnya langsung tidak berlaku.
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
            <p className="eyebrow">Layar QR bersama</p>
            <h2 id="qr-display-title">Pindai QR Presensi</h2>
          </div>
          {session.imageDataUrl ? (
            <button className="button button-secondary print-hidden" type="button" onClick={() => window.print()}>Cetak</button>
          ) : null}
        </div>

        {session.active && session.imageDataUrl && session.expiresAt ? (
          <div className="admin-qr-image-panel">
            <Image src={session.imageDataUrl} alt="QR presensi sekolah yang sedang aktif" width={1024} height={1024} unoptimized priority />
            <p>Pindai menggunakan kamera ponsel atau menu Pindai QR pada akun siswa.</p>
            <strong>Berganti otomatis pada {timestampLabel(session.expiresAt)} WIB</strong>
          </div>
        ) : (
          <div className="admin-qr-placeholder">
            <span aria-hidden="true">QR</span>
            <p>Mulai sesi untuk menampilkan QR presensi sekolah.</p>
          </div>
        )}
      </section>
    </div>
  );
}
