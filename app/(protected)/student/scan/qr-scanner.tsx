"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
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
    const detectorConstructor = (window as typeof window & {
      BarcodeDetector?: NativeBarcodeDetectorConstructor;
    }).BarcodeDetector;
    if (!detectorConstructor || !navigator.mediaDevices?.getUserMedia) {
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
      const detector = new detectorConstructor({ formats: ["qr_code"] });

      const scanFrame = async () => {
        if (scanRunRef.current !== run || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const token = codes.map((code) => code.rawValue ?? "").map(tokenFromScan).find(Boolean);
          if (token) {
            processToken(token);
            return;
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
      ? "Berhasil Presensi"
      : result.action === "check_out"
        ? "Berhasil Check-out"
        : "Presensi Sudah Lengkap"
    : "Presensi Belum Diproses";

  return (
    <section className="card student-scan-card" aria-labelledby="scan-title">
      <div>
        <p className="eyebrow">Kamera siswa</p>
        <h2 id="scan-title">Pindai QR sekolah</h2>
        <p className="muted">Arahkan kamera ke QR aktif. Waktu dan jenis presensi ditentukan oleh sistem sekolah.</p>
      </div>

      {receivedToken ? (
        <div className="student-token-received" role="status">
          <strong>QR diterima</strong>
          <p>Konfirmasi untuk memproses presensi menggunakan akun siswa ini.</p>
          <button className="button button-primary" type="button" disabled={pending} onClick={() => processToken(receivedToken)}>
            {pending ? "Memproses…" : "Proses Presensi"}
          </button>
        </div>
      ) : (
        <>
          <div className={`student-camera-frame${cameraState === "scanning" ? " is-active" : ""}`}>
            <video ref={videoRef} muted playsInline aria-label="Pratinjau kamera pemindai QR" />
            {cameraState !== "scanning" ? <span aria-hidden="true">QR</span> : null}
          </div>
          <div className="page-actions student-scan-actions">
            <button className="button button-primary" type="button" disabled={pending || cameraState === "starting" || cameraState === "scanning"} onClick={startCamera}>
              {cameraState === "starting" ? "Membuka kamera…" : cameraState === "scanning" ? "Mencari QR…" : "Mulai Kamera"}
            </button>
            {cameraState === "scanning" ? (
              <button className="button button-secondary" type="button" onClick={stopCamera}>Tutup Kamera</button>
            ) : null}
          </div>
        </>
      )}

      {cameraState === "unsupported" ? (
        <p className="alert alert-error" role="alert">Pemindai dalam browser tidak didukung. Buka aplikasi kamera ponsel, pindai QR, lalu buka tautan yang muncul.</p>
      ) : null}
      {cameraState === "error" ? (
        <p className="alert alert-error" role="alert">Kamera tidak dapat dibuka. Izinkan akses kamera atau gunakan aplikasi kamera ponsel.</p>
      ) : null}
      {pending ? <p className="student-scan-pending" role="status">Memverifikasi QR dan mencatat waktu dari server…</p> : null}
      {!pending && result ? (
        <div className={`student-scan-result ${result.ok ? "is-success" : "is-error"}`} role={result.ok ? "status" : "alert"}>
          <h2>{resultTitle}</h2>
          <p>{result.message}</p>
          {result.occurredAt ? <p>Waktu: <strong>{schoolTime(result.occurredAt)} WIB</strong></p> : null}
          {result.action === "check_in" && result.status ? (
            <p>Status: <strong>{result.status === "on_time" ? "Tepat Waktu" : "Terlambat"}</strong></p>
          ) : null}
        </div>
      ) : null}

      <p className="student-scan-help">Tidak perlu Wi-Fi sekolah; ponsel hanya memerlukan koneksi internet ke aplikasi.</p>
      <Link className="button button-quiet" href="/student">Kembali ke akun siswa</Link>
    </section>
  );
}
