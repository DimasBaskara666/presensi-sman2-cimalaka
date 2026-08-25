"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import {
  resetStudentPassword,
  setStudentActive,
  StudentAdministrationError,
} from "@/lib/students/student-management";

function safeErrorCode(error: unknown): string {
  if (error instanceof StudentAdministrationError) return error.code;
  if (error instanceof Error && error.name === "InvalidLoginIdError") {
    return "invalid_login_id";
  }
  return "service_error";
}

export async function setStudentActiveAction(formData: FormData) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const activeValue = String(formData.get("is_active") ?? "");
  if (activeValue !== "true" && activeValue !== "false") {
    redirect("/admin/students?error=invalid_status");
  }

  try {
    await setStudentActive(
      String(formData.get("login_id") ?? ""),
      activeValue === "true",
    );
  } catch (error) {
    redirect(`/admin/students?error=${safeErrorCode(error)}`);
  }

  revalidatePath("/admin/students");
  redirect(`/admin/students?status=${activeValue === "true" ? "activated" : "deactivated"}`);
}

export async function resetStudentPasswordAction(formData: FormData) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const password = String(formData.get("new_password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");
  if (!password || password !== confirmation) {
    redirect("/admin/students?error=password_mismatch");
  }

  try {
    await resetStudentPassword(String(formData.get("login_id") ?? ""), password);
  } catch (error) {
    redirect(`/admin/students?error=${safeErrorCode(error)}`);
  }

  revalidatePath("/admin/students");
  redirect("/admin/students?status=password_reset");
}
