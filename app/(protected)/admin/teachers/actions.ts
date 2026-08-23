"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import {
  createTeacher,
  resetTeacherPassword,
  setTeacherActive,
  TeacherManagementError,
} from "@/lib/auth/teacher-management";

function safeErrorCode(error: unknown): string {
  if (error instanceof TeacherManagementError) return error.code;
  if (error instanceof Error && error.name === "InvalidLoginIdError") {
    return "invalid_login_id";
  }
  return "service_error";
}

export async function createTeacherAction(formData: FormData) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });

  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");
  if (!password || password !== confirmation) {
    redirect("/admin/teachers?error=password_mismatch");
  }

  try {
    await createTeacher({
      loginId: String(formData.get("login_id") ?? ""),
      fullName: String(formData.get("full_name") ?? ""),
      password,
    });
  } catch (error) {
    redirect(`/admin/teachers?error=${safeErrorCode(error)}`);
  }

  revalidatePath("/admin/teachers");
  redirect("/admin/teachers?status=created");
}

export async function setTeacherActiveAction(formData: FormData) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });

  const teacherId = String(formData.get("teacher_id") ?? "");
  const activeValue = String(formData.get("is_active") ?? "");
  if (activeValue !== "true" && activeValue !== "false") {
    redirect("/admin/teachers?error=invalid_status");
  }

  try {
    await setTeacherActive(teacherId, activeValue === "true");
  } catch (error) {
    redirect(`/admin/teachers?error=${safeErrorCode(error)}`);
  }

  revalidatePath("/admin/teachers");
  redirect(`/admin/teachers?status=${activeValue === "true" ? "activated" : "deactivated"}`);
}

export async function resetTeacherPasswordAction(formData: FormData) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });

  const teacherId = String(formData.get("teacher_id") ?? "");
  const password = String(formData.get("new_password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");
  if (!password || password !== confirmation) {
    redirect("/admin/teachers?error=password_mismatch");
  }

  try {
    await resetTeacherPassword(teacherId, password);
  } catch (error) {
    redirect(`/admin/teachers?error=${safeErrorCode(error)}`);
  }

  revalidatePath("/admin/teachers");
  redirect("/admin/teachers?status=password_reset");
}
