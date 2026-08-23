import type { SupabaseClient } from "@supabase/supabase-js";
import { isAppRole, type CurrentPerson } from "./types";

const PERSON_COLUMNS =
  "id, auth_user_id, login_id, full_name, role, must_change_password, is_active";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCurrentPerson(value: unknown): CurrentPerson | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.auth_user_id !== "string" ||
    typeof value.login_id !== "string" ||
    typeof value.full_name !== "string" ||
    !isAppRole(value.role) ||
    typeof value.must_change_password !== "boolean" ||
    typeof value.is_active !== "boolean"
  ) {
    return null;
  }

  return {
    id: value.id,
    authUserId: value.auth_user_id,
    loginId: value.login_id,
    fullName: value.full_name,
    role: value.role,
    mustChangePassword: value.must_change_password,
    isActive: value.is_active,
  };
}

export async function findPersonByAuthUserId(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<CurrentPerson | null> {
  const { data, error } = await supabase
    .from("people")
    .select(PERSON_COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) return null;
  return parseCurrentPerson(data);
}
