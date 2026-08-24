import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ACTIVATION_CODE_VERSION = "A1";
const ACTIVATION_CODE_RANDOM_BYTES = 16;
const ACTIVATION_CODE_PATTERN = /^A1-([0-9A-Z]+)-([A-F0-9]{32})$/;

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

export type GeneratedActivationCode = {
  code: string;
  expiresAt: string;
};

export function generateActivationCode(
  ttlHours: number,
  now: Date = new Date(),
): GeneratedActivationCode {
  if (!Number.isSafeInteger(ttlHours) || ttlHours <= 0) {
    throw new Error("Activation code TTL must be a positive whole number of hours.");
  }
  const expiresAtMs = now.getTime() + ttlHours * 60 * 60 * 1000;
  if (!Number.isSafeInteger(expiresAtMs)) {
    throw new Error("Activation code expiry is outside the supported range.");
  }

  const expiresAtSeconds = Math.floor(expiresAtMs / 1000);
  const expiry = expiresAtSeconds.toString(36).toUpperCase();
  const random = randomBytes(ACTIVATION_CODE_RANDOM_BYTES).toString("hex").toUpperCase();
  return {
    code: `${ACTIVATION_CODE_VERSION}-${expiry}-${random}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

export function readActivationCodeExpiry(code: string): Date | null {
  const match = ACTIVATION_CODE_PATTERN.exec(normalizeActivationCode(code));
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 36);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  const expiresAt = new Date(seconds * 1000);
  return Number.isNaN(expiresAt.getTime()) ? null : expiresAt;
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
  let actual: Buffer;
  try {
    actual = Buffer.from(digestActivationCode(code, pepper), "hex");
  } catch {
    return false;
  }
  const expected = Buffer.from(expectedDigest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyUnexpiredActivationCode(
  code: string,
  expectedDigest: string,
  pepper: string,
  now: Date = new Date(),
): boolean {
  const digestMatches = verifyActivationCode(code, expectedDigest, pepper);
  const expiresAt = readActivationCodeExpiry(code);
  return digestMatches && expiresAt !== null && expiresAt.getTime() > now.getTime();
}

export function evaluateClaimEligibility(candidate: ClaimCandidate | null): ClaimEligibility {
  if (!candidate) return "not_found";
  if (candidate.role !== "student") return "not_student";
  if (!candidate.isActive) return "inactive";
  if (candidate.authUserId || candidate.claimedAt) return "already_claimed";
  if (!candidate.claimCodeDigest) return "activation_code_missing";
  return "claimable";
}
