import "server-only";
import QRCode from "qrcode";
import { buildAttendanceQrUrl, isAttendanceQrToken } from "./qr-token";
import { createClient } from "@/lib/supabase/server";

export type SharedQrSessionView = {
  ok: boolean;
  active: boolean;
  message: string;
  imageDataUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  serverNow: string | null;
};

type SharedQrDatabaseRow = {
  session_active: boolean;
  token_value: string | null;
  created_at: string | null;
  expires_at: string | null;
  server_now: string;
};

const failedView: SharedQrSessionView = {
  ok: false,
  active: false,
  message: "Sesi QR tidak dapat dimuat. Periksa koneksi lalu coba lagi.",
  imageDataUrl: null,
  createdAt: null,
  expiresAt: null,
  serverNow: null,
};

async function toView(
  row: SharedQrDatabaseRow | null,
  message: string,
): Promise<SharedQrSessionView> {
  if (!row) return failedView;
  if (!row.session_active) {
    return {
      ok: true,
      active: false,
      message,
      imageDataUrl: null,
      createdAt: null,
      expiresAt: null,
      serverNow: row.server_now,
    };
  }
  if (
    !isAttendanceQrToken(row.token_value) ||
    typeof row.created_at !== "string" ||
    typeof row.expires_at !== "string"
  ) {
    return failedView;
  }
  const imageDataUrl = await QRCode.toDataURL(buildAttendanceQrUrl(row.token_value), {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 1024,
    color: { dark: "#102a22", light: "#ffffff" },
  });
  return {
    ok: true,
    active: true,
    message,
    imageDataUrl,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    serverNow: row.server_now,
  };
}

async function callSessionFunction(
  functionName: "start_attendance_qr_session" | "get_attendance_qr_session",
  message: string,
): Promise<SharedQrSessionView> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(functionName);
    const row = Array.isArray(data) ? data[0] as SharedQrDatabaseRow | undefined : undefined;
    if (error || !row) return failedView;
    return await toView(row, message);
  } catch {
    return failedView;
  }
}

export function loadSharedAttendanceQrSession(): Promise<SharedQrSessionView> {
  return callSessionFunction("get_attendance_qr_session", "");
}

export function startSharedAttendanceQrSession(): Promise<SharedQrSessionView> {
  return callSessionFunction(
    "start_attendance_qr_session",
    "Sesi QR presensi aktif. QR akan berganti otomatis setiap lima menit.",
  );
}

export async function stopSharedAttendanceQrSession(): Promise<SharedQrSessionView> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("stop_attendance_qr_session");
    if (error) return failedView;
    return {
      ok: true,
      active: false,
      message: "Sesi QR dihentikan. Tidak ada QR presensi yang valid.",
      imageDataUrl: null,
      createdAt: null,
      expiresAt: null,
      serverNow: new Date().toISOString(),
    };
  } catch {
    return failedView;
  }
}
