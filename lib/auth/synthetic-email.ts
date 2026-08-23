const LOGIN_ID_PATTERN = /^[A-Z0-9._-]{1,64}$/;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export class InvalidLoginIdError extends Error {
  constructor() {
    super("Login ID is not valid.");
    this.name = "InvalidLoginIdError";
  }
}

export function normalizeLoginId(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!LOGIN_ID_PATTERN.test(normalized)) {
    throw new InvalidLoginIdError();
  }
  return normalized;
}

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
