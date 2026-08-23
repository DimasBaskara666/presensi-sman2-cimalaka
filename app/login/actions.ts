"use server";

import { redirect } from "next/navigation";
import { authenticateWithLoginId } from "@/lib/auth/login";
import { findPersonByAuthUserId } from "@/lib/auth/people";
import { getAuthEmailDomain } from "@/lib/auth/server-config";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const loginId = String(formData.get("login_id") ?? "");
  const password = String(formData.get("password") ?? "");

  let result;
  try {
    const supabase = await createClient();
    result = await authenticateWithLoginId(loginId, password, getAuthEmailDomain(), {
      async signIn(email, suppliedPassword) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: suppliedPassword,
        });
        return error ? null : (data.user?.id ?? null);
      },
      findPerson: (authUserId) => findPersonByAuthUserId(supabase, authUserId),
      async signOut() {
        await supabase.auth.signOut();
      },
    });
  } catch {
    redirect("/login?error=service");
  }

  if (result.status === "invalid") redirect("/login?error=invalid");
  redirect(result.person.mustChangePassword ? "/change-password" : "/dashboard");
}
