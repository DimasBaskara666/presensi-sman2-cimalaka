export type StudentQrAction = "check_in" | "check_out" | "completed";
export type StudentQrStatus = "on_time" | "late" | null;

export type StudentQrActionResult = {
  ok: boolean;
  action: StudentQrAction | null;
  occurredAt: string | null;
  status: StudentQrStatus;
  message: string;
};

export function safeStudentQrError(error: { message?: string } | null): string {
  const code = error?.message ?? "";
  if (code.includes("qr_expired")) return "QR sudah kedaluwarsa. Pindai QR terbaru dari sekolah.";
  if (code.includes("qr_invalid") || code.includes("qr_revoked")) {
    return "QR tidak valid atau sudah diganti. Pindai QR terbaru.";
  }
  if (code.includes("attendance_before_entry_time")) {
    return "Presensi belum dibuka. Silakan coba mulai pukul 06.30 WIB.";
  }
  if (code.includes("attendance_checkout_too_early")) {
    return "Belum memenuhi waktu check-out sekolah.";
  }
  if (code.includes("attendance_weekend_rejected")) {
    return "Presensi normal tidak tersedia pada akhir pekan.";
  }
  if (code.includes("attendance_account_inactive") || code.includes("attendance_person_not_eligible")) {
    return "Akun tidak aktif. Hubungi administrator sekolah.";
  }
  if (code.includes("attendance_student_required")) {
    return "Fitur ini hanya dapat digunakan oleh akun siswa.";
  }
  return "Presensi belum diproses. Periksa koneksi lalu pindai kembali.";
}

export function successStudentQrResult(input: {
  action: unknown;
  occurredAt: unknown;
  status: unknown;
}): StudentQrActionResult | null {
  if (input.action !== "check_in" && input.action !== "check_out" && input.action !== "completed") {
    return null;
  }
  if (typeof input.occurredAt !== "string") return null;
  const status = input.status === "on_time" || input.status === "late" ? input.status : null;
  if (input.action === "check_in" && !status) return null;

  const message = input.action === "check_in"
    ? "Berhasil presensi masuk."
    : input.action === "check_out"
      ? "Berhasil check-out."
      : "Presensi hari ini sudah lengkap.";
  return { ok: true, action: input.action, occurredAt: input.occurredAt, status, message };
}

