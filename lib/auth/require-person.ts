import "server-only";
import { redirect } from "next/navigation";
import { canAccessRoles } from "./permissions";
import { getCurrentPerson } from "./current-person";
import type { AppRole } from "./types";

type RequirePersonOptions = {
  allowedRoles?: readonly AppRole[];
  allowPasswordChangeRequired?: boolean;
};

export async function requireCurrentPerson(options: RequirePersonOptions = {}) {
  const person = await getCurrentPerson();
  if (!person) redirect("/login");

  if (person.mustChangePassword && !options.allowPasswordChangeRequired) {
    redirect("/change-password");
  }

  if (options.allowedRoles && !canAccessRoles(person.role, options.allowedRoles)) {
    redirect("/forbidden");
  }

  return person;
}
