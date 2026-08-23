import type { AppRole } from "./types";

export type Capability =
  | "access_admin"
  | "access_teacher_operations"
  | "read_all_attendance"
  | "read_own_attendance";

const PERMISSIONS: Record<AppRole, ReadonlySet<Capability>> = {
  admin: new Set(["access_admin", "access_teacher_operations", "read_all_attendance"]),
  teacher: new Set(["access_teacher_operations", "read_all_attendance"]),
  student: new Set(["read_own_attendance"]),
};

export function hasCapability(role: AppRole, capability: Capability): boolean {
  return PERMISSIONS[role].has(capability);
}

export function canAccessRoles(role: AppRole, allowedRoles: readonly AppRole[]): boolean {
  return allowedRoles.includes(role);
}

export function canReadAttendanceRecord(
  viewer: { role: AppRole; personId: string } | null,
  studentPersonId: string,
): boolean {
  if (!viewer) return false;
  return viewer.role === "admin" || viewer.role === "teacher" || viewer.personId === studentPersonId;
}
