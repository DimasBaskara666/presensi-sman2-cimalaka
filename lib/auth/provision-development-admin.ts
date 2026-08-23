import "server-only";
import { normalizeLoginId } from "./login-id";
import { getAuthEmailDomain } from "./server-config";
import { toSyntheticEmail } from "./synthetic-email";
import { createAdminClient } from "../supabase/admin";

export type DevelopmentAdminProvisioningResult = {
  status: "created" | "already_exists";
  loginId: string;
};

export type DevelopmentAdminProvisioningErrorCode =
  | "invalid_full_name"
  | "invalid_password"
  | "people_lookup_failed"
  | "admin_already_exists"
  | "admin_link_inconsistent"
  | "admin_inactive"
  | "login_id_in_use"
  | "auth_lookup_failed"
  | "auth_identity_exists"
  | "auth_create_failed"
  | "people_create_failed"
  | "auth_rollback_failed";

export class DevelopmentAdminProvisioningError extends Error {
  constructor(readonly code: DevelopmentAdminProvisioningErrorCode) {
    super(`Development Admin provisioning failed (${code}).`);
    this.name = "DevelopmentAdminProvisioningError";
  }
}

type ProvisionDevelopmentAdminInput = {
  loginId: string;
  fullName: string;
  password: string;
};

type ExistingPerson = {
  auth_user_id: string;
  login_id: string;
  role: "admin" | "teacher" | "student";
  is_active: boolean;
};

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const pageSize = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) throw new DevelopmentAdminProvisioningError("auth_lookup_failed");

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === email,
    );
    if (match) return match;
    if (data.users.length < pageSize) return null;
  }
}

export async function provisionDevelopmentAdmin(
  input: ProvisionDevelopmentAdminInput,
): Promise<DevelopmentAdminProvisioningResult> {
  const loginId = normalizeLoginId(input.loginId);
  const fullName = input.fullName.trim();
  if (!fullName) throw new DevelopmentAdminProvisioningError("invalid_full_name");
  if (!input.password) throw new DevelopmentAdminProvisioningError("invalid_password");

  const syntheticEmail = toSyntheticEmail(loginId, getAuthEmailDomain());
  const admin = createAdminClient();

  const { data: existingAdmins, error: adminLookupError } = await admin
    .from("people")
    .select("auth_user_id, login_id, role, is_active")
    .eq("role", "admin")
    .limit(2);
  if (adminLookupError || !existingAdmins) {
    throw new DevelopmentAdminProvisioningError("people_lookup_failed");
  }

  if (existingAdmins.length > 0) {
    if (existingAdmins.length !== 1 || existingAdmins[0].login_id !== loginId) {
      throw new DevelopmentAdminProvisioningError("admin_already_exists");
    }

    const existingAdmin = existingAdmins[0] as ExistingPerson;
    if (!existingAdmin.is_active) {
      throw new DevelopmentAdminProvisioningError("admin_inactive");
    }

    const { data, error } = await admin.auth.admin.getUserById(existingAdmin.auth_user_id);
    if (
      error ||
      !data.user ||
      data.user.email?.trim().toLowerCase() !== syntheticEmail
    ) {
      throw new DevelopmentAdminProvisioningError("admin_link_inconsistent");
    }

    return { status: "already_exists", loginId };
  }

  const { data: existingLogin, error: loginLookupError } = await admin
    .from("people")
    .select("auth_user_id, login_id, role, is_active")
    .eq("login_id", loginId)
    .maybeSingle();
  if (loginLookupError) {
    throw new DevelopmentAdminProvisioningError("people_lookup_failed");
  }
  if (existingLogin) {
    throw new DevelopmentAdminProvisioningError("login_id_in_use");
  }

  if (await findAuthUserByEmail(admin, syntheticEmail)) {
    throw new DevelopmentAdminProvisioningError("auth_identity_exists");
  }

  const { data: createdAuth, error: authCreateError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: input.password,
    email_confirm: true,
  });
  if (authCreateError || !createdAuth.user) {
    throw new DevelopmentAdminProvisioningError("auth_create_failed");
  }

  const { data: person, error: peopleCreateError } = await admin
    .from("people")
    .insert({
      auth_user_id: createdAuth.user.id,
      login_id: loginId,
      full_name: fullName,
      role: "admin",
      claimed_at: new Date().toISOString(),
      must_change_password: false,
      is_active: true,
    })
    .select("auth_user_id, login_id, role, is_active")
    .single();

  if (peopleCreateError || !person) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(createdAuth.user.id);
    if (rollbackError) {
      throw new DevelopmentAdminProvisioningError("auth_rollback_failed");
    }
    throw new DevelopmentAdminProvisioningError("people_create_failed");
  }

  return { status: "created", loginId };
}
