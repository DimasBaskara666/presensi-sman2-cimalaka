import { createHmac, timingSafeEqual } from "node:crypto";

export type ClaimCandidate = {
  role: "admin" | "teacher" | "student";
  authUserId: string | null;
  claimedAt: string | null;
  claimCodeDigest: string | null;
  isActive: boolean;
};

export type ClaimEligibility =
  | "claimable"
  | "not_found"
  | "not_student"
  | "inactive"
  | "already_claimed"
  | "activation_code_missing";

function normalizeActivationCode(code: string): string {
  return code.trim().toUpperCase();
}

export function digestActivationCode(code: string, pepper: string): string {
  const normalizedCode = normalizeActivationCode(code);
  if (!normalizedCode || !pepper) {
    throw new Error("Activation code and pepper are required.");
  }
  return createHmac("sha256", pepper).update(normalizedCode, "utf8").digest("hex");
}

export function verifyActivationCode(code: string, expectedDigest: string, pepper: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedDigest)) {
    return false;
  }
  const actual = Buffer.from(digestActivationCode(code, pepper), "hex");
  const expected = Buffer.from(expectedDigest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function evaluateClaimEligibility(candidate: ClaimCandidate | null): ClaimEligibility {
  if (!candidate) return "not_found";
  if (candidate.role !== "student") return "not_student";
  if (!candidate.isActive) return "inactive";
  if (candidate.authUserId || candidate.claimedAt) return "already_claimed";
  if (!candidate.claimCodeDigest) return "activation_code_missing";
  return "claimable";
}
