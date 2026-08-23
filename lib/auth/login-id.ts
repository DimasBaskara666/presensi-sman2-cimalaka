const LOGIN_ID_PATTERN = /^[A-Z0-9._-]{1,64}$/;

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
