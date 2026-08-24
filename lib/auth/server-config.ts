import "server-only";
import { validateAuthEmailDomain } from "./synthetic-email";

export function getAuthEmailDomain(): string {
  const value = process.env.AUTH_EMAIL_DOMAIN;
  if (!value) {
    throw new Error("AUTH_EMAIL_DOMAIN is not configured.");
  }
  return validateAuthEmailDomain(value);
}

export function getActivationCodePepper(): string {
  const value = process.env.ACTIVATION_CODE_PEPPER;
  if (!value) {
    throw new Error("ACTIVATION_CODE_PEPPER is not configured.");
  }
  return value;
}

export function getActivationCodeTtlHours(): number {
  const value = process.env.ACTIVATION_CODE_TTL_HOURS;
  const ttlHours = value ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(ttlHours) || ttlHours <= 0) {
    throw new Error("ACTIVATION_CODE_TTL_HOURS must be a positive whole number.");
  }
  return ttlHours;
}
