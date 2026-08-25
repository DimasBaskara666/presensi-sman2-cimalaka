"use server";

import { revalidatePath } from "next/cache";
import { digestAttendanceQrToken, isAttendanceQrToken } from "@/lib/attendance/qr-token";
import {
  safeStudentQrError,
  successStudentQrResult,
  type StudentQrActionResult,
} from "@/lib/attendance/student-qr-model";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { createClient } from "@/lib/supabase/server";

const invalidResult: StudentQrActionResult = {
  ok: false,
  action: null,
  occurredAt: null,
  status: null,
  message: "QR tidak valid atau sudah diganti. Pindai QR terbaru.",
};

export async function submitStudentQrAction(token: unknown): Promise<StudentQrActionResult> {
  await requireCurrentPerson({ allowedRoles: ["student"] });
  if (!isAttendanceQrToken(token)) return invalidResult;

  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("submit_student_qr_attendance", {
      p_token_hash: digestAttendanceQrToken(token),
    });
    if (error) return { ...invalidResult, message: safeStudentQrError(error) };
    const row = Array.isArray(data) ? data[0] : null;
    const result = row ? successStudentQrResult({
      action: row.action,
      occurredAt: row.occurred_at,
      status: row.status,
    }) : null;
    if (!result) return { ...invalidResult, message: safeStudentQrError(null) };
    revalidatePath("/student");
    return result;
  } catch {
    return { ...invalidResult, message: safeStudentQrError(null) };
  }
}

