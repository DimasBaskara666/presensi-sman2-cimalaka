"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
import type { StudentQrActionResult } from "@/lib/attendance/student-qr-model";
import { submitStudentQrAction } from "./actions";

type DetectedBarcode = { rawValue?: string };
type NativeBarcodeDetector = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type NativeBarcodeDetectorConstructor = new (options: { formats: string[] }) => NativeBarcodeDetector;

function schoolTime(timestamp: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function tokenFromScan(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (/^qra_[A-Za-z0-9_-]{43}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.pathname !== "/student/scan") return null;
    const token = url.searchParams.get("token") ?? "";
    return /^qra_[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function StudentQrScanner({ initialToken }: { initialToken: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRunRef = useRef(0);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "scanning" | "unsupported" | "error">("idle");
  const [receivedToken, setReceivedToken] = useState(initialToken);
  const [result, setResult] = useState<StudentQrActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => {
    scanRunRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function stopCamera() {
    scanRunRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
  }

  function processToken(token: string) {
    if (pending) return;
    stopCamera();
    setReceivedToken(null);
    setResult(null);
    window.history.replaceState(null, "", "/student/scan");
    startTransition(async () => {
      try {
        setResult(await submitStudentQrAction(token));
      } catch {
        setResult({
          ok: false,
          action: null,
          occurredAt: null,
          status: null,
          message: "Koneksi terputus. Pindai QR kembali setelah koneksi tersedia.",
        });
      }
    });
  }

  async function startCamera() {
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      return;
    }

    setCameraState("starting");
    const run = scanRunRef.current + 1;
    scanRunRef.current = run;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      if (scanRunRef.current !== run) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("camera_video_unavailable");
      video.srcObject = stream;
      await video.play();
      setCameraState("scanning");

      const detectorConstructor = (window as typeof window & {
        BarcodeDetector?: NativeBarcodeDetectorConstructor;
      }).BarcodeDetector;
      const detector = detectorConstructor ? new detectorConstructor({ formats: ["qr_code"] }) : null;

      const canvas = document.createElement("canvas");
      const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });

      const scanFrame = async () => {
        if (scanRunRef.current !== run || !videoRef.current) return;
        const currentVideo = videoRef.current;
        try {
          if (detector) {
            const codes = await detector.detect(currentVideo);
            const token = codes.map((code) => code.rawValue ?? "").map(tokenFromScan).find(Boolean);
            if (token) {
              processToken(token);
              return;
            }
          } else if (canvasCtx && currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0) {
            canvas.width = currentVideo.videoWidth;
            canvas.height = currentVideo.videoHeight;
            canvasCtx.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
            const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            if (code?.data) {
              const token = tokenFromScan(code.data);
              if (token) {
                processToken(token);
                return;
              }
            }
          }
        } catch {
          // A transient undecodable camera frame is expected while scanning.
        }
        window.setTimeout(scanFrame, 300);
      };
      void scanFrame();
    } catch {
      stopCamera();
      setCameraState("error");
    }
  }

  const resultTitle = result?.ok
    ? result.action === "check_in"
      ? "Presensi Masuk Berhasil!"
      : result.action === "check_out"
        ? "Presensi Pulang Berhasil!"
        : "Presensi Hari Ini Lengkap!"
    : "Presensi Belum Berhasil";

  return (
    <section className="card student-scan-card" aria-labelledby="scan-title">
      <div className="student-scan-intro">
        <h2 id="scan-title" className="student-scan-title">Pindai QR Presensi</h2>
        <p className="muted">
          Posisikan kamera tepat di depan kode QR yang aktif pada layar proyektor kelas atau monitor guru.
        </p>
      </div>

      {receivedToken ? (
        <div className="student-token-received" role="status">
          <div className="student-token-info">
            <span className="eyebrow">Kode QR Terdeteksi</span>
            <strong className="student-token-title">Tautan presensi berhasil dibaca dari kamera</strong>
            <p className="muted">
              Tekan tombol di bawah untuk memproses pencatatan kehadiran menggunakan akun siswa Anda.
            </p>
          </div>
          <div className="page-actions student-token-actions">
            <button
              className="button button-primary button-full"
              type="button"
              disabled={pending}
              onClick={() => processToken(receivedToken)}
            >
              {pending ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  <span>Memproses Presensi…</span>
                </>
              ) : (
                <span>Konfirmasi & Proses Presensi</span>
              )}
            </button>
            <Link className="button button-secondary button-full" href="/student">
              Batal
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className={`student-camera-viewport${cameraState === "scanning" ? " is-active" : ""}`}>
            <video ref={videoRef} autoPlay muted playsInline aria-label="Jendela bidik kamera pemindai QR" />
            {cameraState === "scanning" ? (
              <div className="student-camera-overlay" aria-hidden="true">
                <div className="student-camera-reticle">
                  <span className="reticle-corner reticle-top-left" />
                  <span className="reticle-corner reticle-top-right" />
                  <span className="reticle-corner reticle-bottom-left" />
                  <span className="reticle-corner reticle-bottom-right" />
                  <div className="reticle-scanner-line" />
                </div>
                <p className="student-camera-live-hint">Arahkan bingkai ke kode QR</p>
              </div>
            ) : (
              <div className="student-camera-idle-content">
                <div className="student-camera-idle-icon-wrap" aria-hidden="true">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <circle cx="17.5" cy="17.5" r="2.5" />
                  </svg>
                </div>
                <p className="student-camera-idle-text">
                  {cameraState === "starting" ? "Menghubungkan sensor kamera ponsel…" : "Ketuk tombol di bawah untuk menyalakan kamera pemindai"}
                </p>
              </div>
            )}
          </div>

          <div className="student-scan-controls">
            <button
              className="button button-primary student-camera-toggle-btn"
              type="button"
              disabled={pending || cameraState === "starting" || cameraState === "scanning"}
              onClick={startCamera}
            >
              {cameraState === "starting" ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  <span>Membuka Kamera…</span>
                </>
              ) : cameraState === "scanning" ? (
                <span>Mencari Kode QR…</span>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>Nyalakan Kamera Pemindai</span>
                </>
              )}
            </button>
            {cameraState === "scanning" ? (
              <button className="button button-secondary student-camera-stop-btn" type="button" onClick={stopCamera}>
                Matikan Kamera
              </button>
            ) : null}
          </div>
        </>
      )}

      {cameraState === "unsupported" ? (
        <div className="alert alert-error" role="alert">
          <strong>Peramban Tidak Mendukung Akses Kamera Langsung</strong>
          <p>Gunakan aplikasi kamera bawaan ponsel Anda untuk memindai kode QR, lalu buka tautan yang terdeteksi.</p>
        </div>
      ) : null}

      {cameraState === "error" ? (
        <div className="alert alert-error" role="alert">
          <strong>Izin Akses Kamera Ditolak atau Tidak Tersedia</strong>
          <p>Pastikan Anda telah memberikan izin akses kamera untuk situs ini pada pengaturan peramban ponsel Anda.</p>
        </div>
      ) : null}

      {pending ? (
        <div className="student-scan-pending-banner" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>Memverifikasi QR dan mencatat waktu presensi resmi dari server…</span>
        </div>
      ) : null}

      {!pending && result ? (
        <div className={`student-scan-result-card ${result.ok ? "is-success" : "is-error"}`} role={result.ok ? "status" : "alert"}>
          <div className="student-result-header">
            <div className="student-result-icon" aria-hidden="true">
              {result.ok ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="student-result-heading">{resultTitle}</h3>
              <p className="student-result-message">{result.message}</p>
            </div>
          </div>

          <div className="student-result-details">
            {result.occurredAt ? (
              <div className="student-result-row">
                <span>Waktu Server Tercatat</span>
                <strong className="tnum">{schoolTime(result.occurredAt)} WIB</strong>
              </div>
            ) : null}
            {result.action === "check_in" && result.status ? (
              <div className="student-result-row">
                <span>Status Kehadiran</span>
                <span className={`status-pill ${result.status === "on_time" ? "status-state-present" : "status-state-late"}`}>
                  <span className="status-dot" aria-hidden="true" />
                  {result.status === "on_time" ? "Tepat Waktu" : "Terlambat"}
                </span>
              </div>
            ) : null}
          </div>

          <div className="student-result-actions">
            <Link className="button button-primary button-full" href="/student">
              Kembali ke Akun Siswa
            </Link>
            <button className="button button-secondary button-full" type="button" onClick={startCamera}>
              Pindai Lagi
            </button>
          </div>
        </div>
      ) : null}

      <div className="student-scan-footer-help">
        <p className="student-scan-help">
          Posisikan kode QR di dalam kotak bidik kamera hingga terdeteksi otomatis.
        </p>
        <Link className="button button-quiet" href="/student">
          Kembali ke Beranda Siswa
        </Link>
      </div>
    </section>
  );
}
