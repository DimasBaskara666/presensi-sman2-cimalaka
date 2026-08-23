export const APP_ROLES = ["admin", "teacher", "student"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type CurrentPerson = {
  id: string;
  authUserId: string;
  loginId: string;
  fullName: string;
  role: AppRole;
  mustChangePassword: boolean;
  isActive: boolean;
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}
