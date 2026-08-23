import type { CurrentPerson } from "./types";

type PasswordChangeState = Pick<CurrentPerson, "role" | "mustChangePassword">;

export function shouldRequirePasswordChange(person: PasswordChangeState): boolean {
  return person.role === "admin" && person.mustChangePassword;
}
