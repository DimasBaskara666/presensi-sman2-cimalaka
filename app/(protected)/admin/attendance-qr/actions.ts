"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import {
  buildAttendanceQrUrl,
  digestAttendanceQrToken,
  generateAttendanceQrToken,
} from "@/lib/attendance/qr-token";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { createClient } from "@/lib/supabase/server";

export type AdminQrActionResult = {
  ok: boolean;
  message: string;
  imageDataUrl: string | null;
  expiresAt: string | null;
};

const failedResult: AdminQrActionResult = {
  ok: false,
  message: "QR belum dibuat. Periksa konfigurasi atau koneksi lalu coba lagi.",
  imageDataUrl: null,
  expiresAt: null,
};

export async function generateAttendanceQrAction(): Promise<AdminQrActionResult> {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  try {
    const token = generateAttendanceQrToken();
    const tokenHash = digestAttendanceQrToken(token);
    const scanUrl = buildAttendanceQrUrl(token);
    const imageDataUrl = await QRCode.toDataURL(scanUrl, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 1024,
      color: { dark: "#102a22", light: "#ffffff" },
    });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("rotate_attendance_qr", {
      p_token_hash: tokenHash,
    });
    if (error || !Array.isArray(data) || !data[0]?.expires_at) return failedResult;
    revalidatePath("/admin/attendance-qr");
    return {
      ok: true,
      message: "QR aktif berhasil dibuat. Tampilkan atau cetak sebelum meninggalkan halaman.",
      imageDataUrl,
      expiresAt: data[0].expires_at,
    };
  } catch {
    return failedResult;
  }
}

export async function revokeAttendanceQrAction(): Promise<AdminQrActionResult> {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("revoke_active_attendance_qr");
    if (error) return failedResult;
    revalidatePath("/admin/attendance-qr");
    return {
      ok: true,
      message: "QR aktif telah dicabut.",
      imageDataUrl: null,
      expiresAt: null,
    };
  } catch {
    return failedResult;
  }
}
