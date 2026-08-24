import "server-only";
import {
  digestActivationCode,
  evaluateClaimEligibility,
  generateActivationCode,
  verifyUnexpiredActivationCode,
  type ClaimCandidate,
} from "./activation-code";
import { normalizeLoginId } from "./login-id";
import { evaluateStudentPassword } from "./password-policy";
import {
  getActivationCodePepper,
  getActivationCodeTtlHours,
  getAuthEmailDomain,
} from "./server-config";
import { toSyntheticEmail } from "./synthetic-email";
import { createAdminClient } from "../supabase/admin";

const DUMMY_ACTIVATION_DIGEST = "0".repeat(64);

type StudentClaimRow = {
  login_id: string;
  role: "admin" | "teacher" | "student";
  auth_user_id: string | null;
  claimed_at: string | null;
  claim_code_digest: string | null;
  is_active: boolean;
};

export type PreparedStudentActivation = {
  code: string;
  expiresAt: string;
};

export type StudentActivationResult = {
  loginId: string;
};

export type StudentActivationErrorCode =
  | "invalid_request"
  | "invalid_password"
  | "activation_failed"
  | "activation_cleanup_failed"
  | "student_not_found"
  | "student_not_eligible"
  | "code_prepare_failed";

export class StudentActivationError extends Error {
  constructor(readonly code: StudentActivationErrorCode) {
    super(`Student activation failed (${code}).`);
    this.name = "StudentActivationError";
  }
}

function toClaimCandidate(row: StudentClaimRow | null): ClaimCandidate | null {
  if (!row) return null;
  return {
    role: row.role,
    authUserId: row.auth_user_id,
    claimedAt: row.claimed_at,
    claimCodeDigest: row.claim_code_digest,
    isActive: row.is_active,
  };
}

async function findStudentClaimRow(loginId: string): Promise<StudentClaimRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("people")
    .select("login_id, role, auth_user_id, claimed_at, claim_code_digest, is_active")
    .eq("login_id", loginId)
    .maybeSingle();
  if (error) throw new StudentActivationError("activation_failed");
  return data as StudentClaimRow | null;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const pageSize = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) throw new StudentActivationError("activation_cleanup_failed");
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < pageSize) return null;
  }
}

async function removeUnlinkedAuthAfterCreateFailure(
  admin: ReturnType<typeof createAdminClient>,
  loginId: string,
  email: string,
): Promise<void> {
  const candidate = await findStudentClaimRow(loginId);
  if (candidate?.auth_user_id || candidate?.claimed_at) return;
  const orphan = await findAuthUserByEmail(admin, email);
  if (!orphan) return;
  const { error } = await admin.auth.admin.deleteUser(orphan.id);
  if (error) throw new StudentActivationError("activation_cleanup_failed");
}

export async function prepareStudentActivationCode(
  submittedLoginId: string,
): Promise<PreparedStudentActivation> {
  let loginId: string;
  try {
    loginId = normalizeLoginId(submittedLoginId);
  } catch {
    throw new StudentActivationError("student_not_found");
  }

  const candidate = await findStudentClaimRow(loginId);
  const eligibility = evaluateClaimEligibility(toClaimCandidate(candidate));
  if (eligibility === "not_found" || eligibility === "not_student") {
    throw new StudentActivationError("student_not_found");
  }
  if (eligibility === "inactive" || eligibility === "already_claimed") {
    throw new StudentActivationError("student_not_eligible");
  }

  const generated = generateActivationCode(getActivationCodeTtlHours());
  const digest = digestActivationCode(generated.code, getActivationCodePepper());
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("prepare_student_activation", {
    p_login_id: loginId,
    p_claim_code_digest: digest,
  });
  if (error || data !== true) throw new StudentActivationError("code_prepare_failed");
  return generated;
}

export async function activateStudentAccount(input: {
  loginId: string;
  activationCode: string;
  password: string;
}): Promise<StudentActivationResult> {
  let loginId: string;
  try {
    loginId = normalizeLoginId(input.loginId);
  } catch {
    throw new StudentActivationError("invalid_request");
  }
  if (evaluateStudentPassword(input.password, loginId) !== "valid") {
    throw new StudentActivationError("invalid_password");
  }

  const candidate = await findStudentClaimRow(loginId);
  const expectedDigest = candidate?.claim_code_digest ?? DUMMY_ACTIVATION_DIGEST;
  const codeMatches = verifyUnexpiredActivationCode(
    input.activationCode,
    expectedDigest,
    getActivationCodePepper(),
  );
  if (evaluateClaimEligibility(toClaimCandidate(candidate)) !== "claimable" || !codeMatches) {
    throw new StudentActivationError("activation_failed");
  }

  const admin = createAdminClient();
  const syntheticEmail = toSyntheticEmail(loginId, getAuthEmailDomain());
  const { data: createdAuth, error: authCreateError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: input.password,
    email_confirm: true,
    app_metadata: {
      student_activation: {
        login_id: loginId,
        claim_code_digest: expectedDigest,
      },
    },
  });
  if (authCreateError || !createdAuth.user) {
    await removeUnlinkedAuthAfterCreateFailure(admin, loginId, syntheticEmail);
    throw new StudentActivationError("activation_failed");
  }

  const { data: linkedPerson, error: linkedPersonError } = await admin
    .from("people")
    .select("auth_user_id, claimed_at, claim_code_digest, role, is_active")
    .eq("login_id", loginId)
    .maybeSingle();
  const linkedCorrectly =
    !linkedPersonError &&
    linkedPerson?.role === "student" &&
    linkedPerson.is_active === true &&
    linkedPerson.auth_user_id === createdAuth.user.id &&
    typeof linkedPerson.claimed_at === "string" &&
    linkedPerson.claim_code_digest === null;

  if (!linkedCorrectly) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(createdAuth.user.id);
    if (cleanupError) throw new StudentActivationError("activation_cleanup_failed");
    throw new StudentActivationError("activation_failed");
  }

  return { loginId };
}
