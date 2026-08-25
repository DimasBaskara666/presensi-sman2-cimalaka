import { createHash, randomBytes } from "node:crypto";

export const QR_TOKEN_PATTERN = /^qra_[A-Za-z0-9_-]{43}$/;

export function generateAttendanceQrToken(): string {
  return `qra_${randomBytes(32).toString("base64url")}`;
}

export function isAttendanceQrToken(value: unknown): value is string {
  return typeof value === "string" && QR_TOKEN_PATTERN.test(value);
}

export function digestAttendanceQrToken(token: string): string {
  if (!isAttendanceQrToken(token)) throw new Error("invalid_attendance_qr_token");
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function buildAttendanceQrUrl(token: string): string {
  if (!isAttendanceQrToken(token)) throw new Error("invalid_attendance_qr_token");
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) throw new Error("NEXT_PUBLIC_APP_URL is not configured.");

  const appUrl = new URL(configuredUrl);
  if (appUrl.protocol !== "https:" && appUrl.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTP or HTTPS.");
  }
  appUrl.pathname = "/student/scan";
  appUrl.search = "";
  appUrl.hash = "";
  appUrl.searchParams.set("token", token);
  return appUrl.toString();
}
