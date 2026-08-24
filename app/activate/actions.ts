"use server";

import { redirect } from "next/navigation";
import { normalizeLoginId } from "@/lib/auth/login-id";
import { evaluateStudentPassword, type StudentPasswordResult } from "@/lib/auth/password-policy";
import { getAuthEmailDomain } from "@/lib/auth/server-config";
import { activateStudentAccount } from "@/lib/auth/student-activation";
import { toSyntheticEmail } from "@/lib/auth/synthetic-email";
import { createClient } from "@/lib/supabase/server";

export type ActivateStudentActionState = {
  error: "generic" | "password_mismatch" | StudentPasswordResult | null;
};

export async function activateStudentAction(
  _previousState: ActivateStudentActionState,
  formData: FormData,
): Promise<ActivateStudentActionState> {
  const submittedLoginId = String(formData.get("login_id") ?? "");
  const activationCode = String(formData.get("activation_code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");

  if (password !== confirmation) return { error: "password_mismatch" };

  let normalizedLoginId: string | null = null;
  try {
    normalizedLoginId = normalizeLoginId(submittedLoginId);
  } catch {
    // Invalid IDs use the same generic result as unknown or ineligible accounts.
  }
  if (normalizedLoginId) {
    const passwordResult = evaluateStudentPassword(password, normalizedLoginId);
    if (passwordResult !== "valid") return { error: passwordResult };
  }

  let activatedLoginId: string;
  try {
    const activated = await activateStudentAccount({
      loginId: submittedLoginId,
      activationCode,
      password,
    });
    activatedLoginId = activated.loginId;
  } catch {
    return { error: "generic" };
  }

  let signedIn = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: toSyntheticEmail(activatedLoginId, getAuthEmailDomain()),
      password,
    });
    signedIn = !error;
  } catch {
    // The account is already claimed; the normal login page is the safe recovery path.
  }
  if (!signedIn) redirect("/login?status=activated");
  redirect("/student");
}
