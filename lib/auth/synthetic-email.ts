import "server-only";
import { normalizeLoginId } from "./login-id";

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function validateAuthEmailDomain(value: string): string {
  const domain = value.trim().toLowerCase();
  if (!DOMAIN_PATTERN.test(domain)) {
    throw new Error("AUTH_EMAIL_DOMAIN must be a valid dedicated domain name.");
  }
  return domain;
}

export function toSyntheticEmail(loginId: string, domain: string): string {
  const normalizedLoginId = normalizeLoginId(loginId);
  const normalizedDomain = validateAuthEmailDomain(domain);
  return `${normalizedLoginId.toLowerCase()}@${normalizedDomain}`;
}
