"use server";

import { redirect } from "next/navigation";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { createClient } from "@/lib/supabase/server";

export async function changePasswordAction(formData: FormData) {
  await requireCurrentPerson({ allowPasswordChangeRequired: true });

  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword || newPassword !== confirmation) {
    redirect("/change-password?error=invalid");
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
