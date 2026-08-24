"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import {
  isTeacherAttendanceMark,
  type TeacherAttendanceMark,
} from "@/lib/attendance/teacher-attendance-model";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TeacherAttendanceActionResult = {
  ok: boolean;
  studentId: string | null;
  message: string;
};

type AttendanceMutationInput = {
  studentId: string;
  status: TeacherAttendanceMark;
  note?: string;
};

function errorResult(studentId: string | null, message: string): TeacherAttendanceActionResult {
  return { ok: false, studentId, message };
}

function safeAttendanceMessage(error: { message?: string } | null): string {
  const code = error?.message ?? "";
  if (code.includes("attendance_before_entry_time")) {
    return "Kehadiran baru dapat dicatat mulai pukul 06.30 WIB.";
  }
  if (code.includes("attendance_weekend_rejected")) {
    return "Presensi harian tidak tersedia pada akhir pekan.";
  }
  if (code.includes("attendance_presence_exists")) {
    return "Siswa sudah tercatat hadir. Hubungi administrator jika datanya perlu dikoreksi.";
  }
  if (code.includes("attendance_checkout_too_early")) {
    return "Waktu pulang minimum belum tercapai.";
  }
  if (code.includes("attendance_check_in_required")) {
    return "Catat kehadiran siswa terlebih dahulu sebelum mencatat kepulangan.";
  }
  if (code.includes("attendance_person_not_eligible")) {
    return "Siswa tidak aktif atau tidak dapat diproses.";
  }
  return "Presensi belum tersimpan. Periksa koneksi lalu coba lagi.";
}

function parseMutationInput(input: unknown): AttendanceMutationInput | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Record<string, unknown>;
  if (!UUID_PATTERN.test(String(candidate.studentId ?? ""))) return null;
  if (!isTeacherAttendanceMark(candidate.status)) return null;
  const note = typeof candidate.note === "string" ? candidate.note.trim() : "";
  if (note.length > 200) return null;
  return {
    studentId: String(candidate.studentId),
    status: candidate.status,
    note,
  };
}

export async function markTeacherAttendanceAction(
  input: unknown,
): Promise<TeacherAttendanceActionResult> {
  await requireCurrentPerson({ allowedRoles: ["teacher"] });
  const mutation = parseMutationInput(input);
  if (!mutation) return errorResult(null, "Pilihan presensi tidak valid.");

  const supabase = await createClient();
  try {
    const result = mutation.status === "present"
      ? await supabase.rpc("record_manual_check_in", { p_student_id: mutation.studentId })
      : await supabase.rpc("record_manual_absence", {
        p_student_id: mutation.studentId,
        p_category: mutation.status,
        p_note: mutation.note || null,
      });
    if (result.error) return errorResult(mutation.studentId, safeAttendanceMessage(result.error));
  } catch {
    return errorResult(mutation.studentId, safeAttendanceMessage(null));
  }

  revalidatePath("/teacher");
  return {
    ok: true,
    studentId: mutation.studentId,
    message: mutation.status === "present" ? "Kehadiran tersimpan." : "Ketidakhadiran tersimpan.",
  };
}

export async function recordTeacherCheckOutAction(
  input: unknown,
): Promise<TeacherAttendanceActionResult> {
  await requireCurrentPerson({ allowedRoles: ["teacher"] });
  const studentId = typeof input === "string" ? input : "";
  if (!UUID_PATTERN.test(studentId)) return errorResult(null, "Siswa tidak valid.");

  const supabase = await createClient();
  try {
    const result = await supabase.rpc("record_manual_check_out", { p_student_id: studentId });
    if (result.error) return errorResult(studentId, safeAttendanceMessage(result.error));
  } catch {
    return errorResult(studentId, safeAttendanceMessage(null));
  }

  revalidatePath("/teacher");
  return { ok: true, studentId, message: "Waktu pulang tersimpan." };
}
