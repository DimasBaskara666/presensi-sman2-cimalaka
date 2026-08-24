"use server";

import { requireCurrentPerson } from "@/lib/auth/require-person";
import {
  prepareStudentActivationCode,
  StudentActivationError,
} from "@/lib/auth/student-activation";

export type ActivationCodeActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "revealed"; code: string; expiresAt: string };

export async function generateActivationCodeAction(
  _previousState: ActivationCodeActionState,
  formData: FormData,
): Promise<ActivationCodeActionState> {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  try {
    const prepared = await prepareStudentActivationCode(String(formData.get("login_id") ?? ""));
    return { status: "revealed", ...prepared };
  } catch (error) {
    const message =
      error instanceof StudentActivationError && error.code === "student_not_eligible"
        ? "Kode hanya dapat dibuat untuk siswa aktif yang belum diaktivasi."
        : "Kode aktivasi tidak dapat dibuat. Muat ulang halaman dan coba lagi.";
    return { status: "error", message };
  }
}
