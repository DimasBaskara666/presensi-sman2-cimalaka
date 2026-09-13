"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
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

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const displayContainerRef = useRef<HTMLDivElement>(null);

  // Exact 5-minute (300-second) countdown indicator ticker
  useEffect(() => {
    if (!session.active || !session.expiresAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [session.active, session.expiresAt]);

  const secondsRemaining = session.active && session.expiresAt
    ? Math.max(0, Math.min(300, Math.round((Date.parse(session.expiresAt) - now) / 1000)))
    : 300;

  // Track fullscreen state change
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Server-authoritative refresh cycle
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

  function handleConfirmStop() {
    setShowStopDialog(false);
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

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (displayContainerRef.current) {
        void displayContainerRef.current.requestFullscreen();
      }
    } else {
      void document.exitFullscreen();
    }
  }

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / 300) * 100));

  return (
    <div className="admin-qr-layout" ref={displayContainerRef}>
      {/* Session Controls Card */}
      <section className="card admin-qr-controls" aria-labelledby="qr-controls-title">
        <div className="qr-controls-header">
          <p className="eyebrow">Kontrol Sesi Bersama</p>
          <h2 id="qr-controls-title">QR Presensi Sekolah</h2>
        </div>

        {session.active && session.createdAt && session.expiresAt ? (
          <div className="qr-session-active-panel">
            <div className="qr-session-status-row">
              <span className="status-badge status-active">
                <span className="status-dot" aria-hidden="true" />
                Sesi Aktif
              </span>
              <span className="qr-countdown-badge tnum">
                Berganti dalam: <strong>{formatCountdown(secondsRemaining)}</strong>
              </span>
            </div>

            {/* 5-minute visual progress bar */}
            <div className="qr-rotation-progress-bar" aria-hidden="true">
              <div
                className="qr-rotation-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <dl className="admin-qr-metadata">
              <div>
                <dt>Waktu Sesi Dimulai</dt>
                <dd className="tnum">{timestampLabel(session.createdAt)} WIB</dd>
              </div>
              <div>
                <dt>Berganti Otomatis Pada</dt>
                <dd className="tnum">{timestampLabel(session.expiresAt)} WIB</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="qr-session-inactive-panel">
            <p className="empty-state">Sesi QR sedang berhenti. Belum ada QR presensi yang aktif.</p>
          </div>
        )}

        <div className="page-actions admin-qr-actions">
          <button
            className="button button-primary"
            type="button"
            disabled={pending || session.active}
            onClick={startSession}
          >
            {pending && !session.active ? "Memulai Sesi…" : "Mulai Sesi QR"}
          </button>
          <button
            className="button button-danger"
            type="button"
            disabled={pending || !session.active}
            onClick={() => setShowStopDialog(true)}
          >
            {pending && session.active ? "Memproses…" : "Hentikan Sesi"}
          </button>
        </div>

        {/* PostgreSQL menentukan QR aktif dan menggantinya setiap lima menit. */}
        <p className="muted admin-qr-security-note">
          QR presensi diperbarui secara otomatis setiap 5 menit. Semua tampilan menerima kode yang sama dan kode sebelumnya langsung tidak berlaku.
        </p>

        {feedback ? (
          <div className={`alert ${feedback.ok ? "alert-success" : "alert-error"}`} role={feedback.ok ? "status" : "alert"}>
            {feedback.message}
          </div>
        ) : null}
      </section>

      {/* QR Projector Display Card */}
      <section className="card admin-qr-display" aria-labelledby="qr-display-title">
        <div className="admin-qr-display-heading">
          <div>
            <p className="eyebrow">Layar Proyektor & Monitor Guru</p>
            <h2 id="qr-display-title">Pindai QR Presensi</h2>
          </div>
          <div className="admin-qr-header-actions print-hidden">
            <button
              className="button button-secondary button-small"
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Keluar layar penuh" : "Buka tampilan layar penuh proyektor"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {isFullscreen ? (
                  <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
              <span>{isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}</span>
            </button>
          </div>
        </div>

        {session.active && session.imageDataUrl && session.expiresAt ? (
          <div className="admin-qr-image-panel">
            <div className="admin-qr-code-wrapper">
              <Image
                src={session.imageDataUrl}
                alt="QR presensi sekolah yang sedang aktif"
                width={1024}
                height={1024}
                unoptimized
                priority
              />
            </div>

            <div className="admin-qr-instructions">
              <p className="admin-qr-guide-text">
                Arahkan kamera ponsel atau menu <strong>Pindai QR</strong> pada akun siswa ke kode di atas.
              </p>
              <div className="admin-qr-refresh-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>
                  Berganti otomatis pada <strong className="tnum">{timestampLabel(session.expiresAt)} WIB</strong> (rotasi 5 menit).
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-qr-placeholder">
            <div className="admin-qr-placeholder-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <circle cx="17.5" cy="17.5" r="2.5" />
              </svg>
            </div>
            <h3>Sesi QR Belum Dimulai</h3>
            <p className="muted">Klik tombol <strong>Mulai Sesi QR</strong> pada panel sebelah kiri untuk memunculkan kode QR di layar proyektor.</p>
          </div>
        )}
      </section>

      {/* Confirmation Dialog for stopping active session */}
      <ConfirmDialog
        isOpen={showStopDialog}
        title="Hentikan Sesi QR Sekolah?"
        description="Sesi QR yang sedang aktif di proyektor akan dihentikan seketika. Siswa tidak dapat lagi melakukan presensi mandiri sampai sesi baru dimulai."
        confirmLabel="Hentikan Sesi"
        cancelLabel="Batal"
        variant="danger"
        isPending={pending}
        onConfirm={handleConfirmStop}
        onCancel={() => setShowStopDialog(false)}
      />
    </div>
  );
}
