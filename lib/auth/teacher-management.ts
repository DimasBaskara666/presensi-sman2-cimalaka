import "server-only";
import { normalizeLoginId } from "./login-id";
import { getAuthEmailDomain } from "./server-config";
import { toSyntheticEmail } from "./synthetic-email";
import { createAdminClient } from "../supabase/admin";

export type TeacherSummary = {
  id: string;
  loginId: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
};

export type TeacherManagementErrorCode =
  | "invalid_full_name"
  | "invalid_password"
  | "teacher_list_failed"
  | "teacher_lookup_failed"
  | "teacher_not_found"
  | "login_id_in_use"
  | "auth_lookup_failed"
  | "auth_identity_exists"
  | "auth_create_failed"
  | "people_create_failed"
  | "auth_rollback_failed"
  | "teacher_status_failed"
  | "password_reset_failed";

export class TeacherManagementError extends Error {
  constructor(readonly code: TeacherManagementErrorCode) {
    super(`Teacher management failed (${code}).`);
    this.name = "TeacherManagementError";
  }
}

type CreateTeacherInput = {
  loginId: string;
  fullName: string;
  password: string;
};

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const pageSize = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) throw new TeacherManagementError("auth_lookup_failed");

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === email,
    );
    if (match) return match;
    if (data.users.length < pageSize) return null;
  }
}

export async function listTeachers(): Promise<TeacherSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("people")
    .select("id, login_id, full_name, is_active, created_at")
    .eq("role", "teacher")
    .order("login_id");
  if (error || !data) throw new TeacherManagementError("teacher_list_failed");

  return data.map((teacher) => ({
    id: teacher.id,
    loginId: teacher.login_id,
    fullName: teacher.full_name,
    isActive: teacher.is_active,
    createdAt: teacher.created_at,
  }));
}

export async function createTeacher(input: CreateTeacherInput): Promise<{ loginId: string }> {
  const loginId = normalizeLoginId(input.loginId);
  const fullName = input.fullName.trim();
  if (!fullName) throw new TeacherManagementError("invalid_full_name");
  if (!input.password) throw new TeacherManagementError("invalid_password");

  const syntheticEmail = toSyntheticEmail(loginId, getAuthEmailDomain());
  const admin = createAdminClient();

  const { data: existingPerson, error: peopleLookupError } = await admin
    .from("people")
    .select("id")
    .eq("login_id", loginId)
    .maybeSingle();
  if (peopleLookupError) throw new TeacherManagementError("teacher_lookup_failed");
  if (existingPerson) throw new TeacherManagementError("login_id_in_use");

  if (await findAuthUserByEmail(admin, syntheticEmail)) {
    throw new TeacherManagementError("auth_identity_exists");
  }

  const { data: createdAuth, error: authCreateError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: input.password,
    email_confirm: true,
  });
  if (authCreateError || !createdAuth.user) {
    throw new TeacherManagementError("auth_create_failed");
  }

  const { data: person, error: peopleCreateError } = await admin
    .from("people")
    .insert({
      auth_user_id: createdAuth.user.id,
      login_id: loginId,
      full_name: fullName,
      role: "teacher",
      claimed_at: new Date().toISOString(),
      must_change_password: false,
      is_active: true,
    })
    .select("id")
    .single();

  if (peopleCreateError || !person) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(createdAuth.user.id);
    if (rollbackError) throw new TeacherManagementError("auth_rollback_failed");
    throw new TeacherManagementError("people_create_failed");
  }

  return { loginId };
}

export async function setTeacherActive(teacherId: string, isActive: boolean): Promise<void> {
  if (!teacherId) throw new TeacherManagementError("teacher_not_found");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("people")
    .update({ is_active: isActive })
    .eq("id", teacherId)
    .eq("role", "teacher")
    .select("id")
    .maybeSingle();
  if (error) throw new TeacherManagementError("teacher_status_failed");
  if (!data) throw new TeacherManagementError("teacher_not_found");
}

export async function resetTeacherPassword(
  teacherId: string,
  password: string,
): Promise<void> {
  if (!teacherId) throw new TeacherManagementError("teacher_not_found");
  if (!password) throw new TeacherManagementError("invalid_password");

  const admin = createAdminClient();
  const { data: teacher, error: teacherLookupError } = await admin
    .from("people")
    .select("auth_user_id, role")
    .eq("id", teacherId)
    .eq("role", "teacher")
    .maybeSingle();
  if (teacherLookupError) throw new TeacherManagementError("teacher_lookup_failed");
  if (!teacher?.auth_user_id || teacher.role !== "teacher") {
    throw new TeacherManagementError("teacher_not_found");
  }

  const { error } = await admin.auth.admin.updateUserById(teacher.auth_user_id, {
    password,
  });
  if (error) throw new TeacherManagementError("password_reset_failed");
}
