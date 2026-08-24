import type { CurrentPerson } from "./types";
import { normalizeLoginId } from "./login-id";

type PasswordChangeState = Pick<CurrentPerson, "role" | "mustChangePassword">;

export function shouldRequirePasswordChange(person: PasswordChangeState): boolean {
  return person.role === "admin" && person.mustChangePassword;
}

export type StudentPasswordResult =
  | "valid"
  | "too_short"
  | "letter_required"
  | "number_required"
  | "matches_login_id";

export function evaluateStudentPassword(password: string, loginId: string): StudentPasswordResult {
  if (password.length < 10) return "too_short";
  if (!/[A-Za-z]/.test(password)) return "letter_required";
  if (!/[0-9]/.test(password)) return "number_required";

  try {
    if (password.toUpperCase() === normalizeLoginId(loginId)) return "matches_login_id";
  } catch {
    return "matches_login_id";
  }
  return "valid";
}
