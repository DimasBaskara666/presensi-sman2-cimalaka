import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ACTIVATION_EPOCH_MS = 1767225600000; // 2026-01-01T00:00:00.000Z
export const EXPIRY_BLOCK_MS = 2 * 60 * 60 * 1000; // 2-hour blocks
export const ACTIVATION_CODE_EXPIRY_CHARS = 3;
export const ACTIVATION_CODE_RANDOM_CHARS = 5;
export const ACTIVATION_CODE_NORMALIZED_LENGTH = 8;
export const MAX_EXPIRY_BLOCKS = 36 ** ACTIVATION_CODE_EXPIRY_CHARS; // 46,656 blocks (approx. 10.65 years)
export const ACTIVATION_CODE_PATTERN = /^[0-9A-Z]{8}$/;

const BASE36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const recentCodes = new Set<string>();

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

export function normalizeActivationCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export type GeneratedActivationCode = {
  code: string;
  expiresAt: string;
};

function generateSecureRandomBase36(length: number): string {
  let result = "";
  while (result.length < length) {
    const bytes = randomBytes(length * 2);
    for (let i = 0; i < bytes.length && result.length < length; i += 1) {
      const byte = bytes[i];
      if (byte < 252) {
        result += BASE36_CHARS[byte % 36];
      }
    }
  }
  return result;
}

export function generateActivationCode(
  ttlHours: number,
  now: Date = new Date(),
): GeneratedActivationCode {
  if (!Number.isSafeInteger(ttlHours) || ttlHours <= 0) {
    throw new Error("Activation code TTL must be a positive whole number of hours.");
  }
  const expiresAtMs = now.getTime() + ttlHours * 60 * 60 * 1000;
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs < ACTIVATION_EPOCH_MS) {
    throw new Error("Activation code expiry is outside the supported range.");
  }

  const block = Math.ceil((expiresAtMs - ACTIVATION_EPOCH_MS) / EXPIRY_BLOCK_MS);
  if (block >= MAX_EXPIRY_BLOCKS) {
    throw new Error("Activation code expiry is outside the supported range.");
  }

  const expiryDate = new Date(ACTIVATION_EPOCH_MS + block * EXPIRY_BLOCK_MS);
  const expiryPart = block.toString(36).toUpperCase().padStart(ACTIVATION_CODE_EXPIRY_CHARS, "0");

  let raw: string;
  let formattedCode: string;
  do {
    const randomPart = generateSecureRandomBase36(ACTIVATION_CODE_RANDOM_CHARS);
    raw = `${expiryPart}${randomPart}`;
    formattedCode = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  } while (recentCodes.has(formattedCode));

  if (recentCodes.size >= 10000) {
    recentCodes.clear();
  }
  recentCodes.add(formattedCode);

  return {
    code: formattedCode,
    expiresAt: expiryDate.toISOString(),
  };
}

export function readActivationCodeExpiry(code: string): Date | null {
  const normalized = normalizeActivationCode(code);
  if (normalized.length !== ACTIVATION_CODE_NORMALIZED_LENGTH || !ACTIVATION_CODE_PATTERN.test(normalized)) {
    return null;
  }
  const block = Number.parseInt(normalized.slice(0, ACTIVATION_CODE_EXPIRY_CHARS), 36);
  if (!Number.isSafeInteger(block) || block < 0 || block >= MAX_EXPIRY_BLOCKS) {
    return null;
  }
  const expiresAt = new Date(ACTIVATION_EPOCH_MS + block * EXPIRY_BLOCK_MS);
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
