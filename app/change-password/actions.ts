"use server";

import { redirect } from "next/navigation";
import { hasCapability } from "@/lib/auth/permissions";
import { evaluateStudentPassword } from "@/lib/auth/password-policy";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { createClient } from "@/lib/supabase/server";

export async function changePasswordAction(formData: FormData) {
  const person = await requireCurrentPerson({ allowPasswordChangeRequired: true });
  if (!hasCapability(person.role, "change_own_password")) redirect("/forbidden");

  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword || newPassword !== confirmation) {
    redirect("/change-password?error=invalid");
  }
  if (
    person.role === "student" &&
    evaluateStudentPassword(newPassword, person.loginId) !== "valid"
  ) {
    redirect("/change-password?error=student_policy");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });

  if (error) redirect("/change-password?error=rejected");

  const { error: profileError } = await supabase.rpc("mark_own_password_changed");
  if (profileError) redirect("/change-password?status=partial");
  redirect("/change-password?status=success");
}
