import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  digestActivationCode,
  evaluateClaimEligibility,
  generateActivationCode,
  readActivationCodeExpiry,
  verifyUnexpiredActivationCode,
} from "../lib/auth/activation-code";
import { evaluateStudentPassword } from "../lib/auth/password-policy";

test("activation codes are random, digest-only verifiable, and expiring", () => {
  const now = new Date("2026-08-25T00:00:00.000Z");
  const first = generateActivationCode(24, now);
  const second = generateActivationCode(24, now);
  assert.notEqual(first.code, second.code);
  assert.equal(first.expiresAt, "2026-08-26T00:00:00.000Z");
  assert.equal(readActivationCodeExpiry(first.code)?.toISOString(), first.expiresAt);

  const digest = digestActivationCode(first.code, "offline-test-pepper");
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(
    verifyUnexpiredActivationCode(first.code, digest, "offline-test-pepper", now),
    true,
  );
  assert.equal(
    verifyUnexpiredActivationCode(`${first.code}X`, digest, "offline-test-pepper", now),
    false,
  );
  assert.equal(
    verifyUnexpiredActivationCode(
      first.code,
      digest,
      "offline-test-pepper",
      new Date(first.expiresAt),
    ),
    false,
  );
});

test("activation eligibility rejects missing, non-Student, inactive, and claimed accounts", () => {
  assert.equal(evaluateClaimEligibility(null), "not_found");
  assert.equal(evaluateClaimEligibility({
    role: "admin",
    authUserId: null,
    claimedAt: null,
    claimCodeDigest: "digest",
    isActive: true,
  }), "not_student");
  assert.equal(evaluateClaimEligibility({
    role: "student",
    authUserId: null,
    claimedAt: null,
    claimCodeDigest: "digest",
    isActive: false,
  }), "inactive");
  assert.equal(evaluateClaimEligibility({
    role: "student",
    authUserId: "linked-auth-user",
    claimedAt: "2026-08-25T00:00:00.000Z",
    claimCodeDigest: null,
    isActive: true,
  }), "already_claimed");
  assert.equal(evaluateClaimEligibility({
    role: "student",
    authUserId: null,
    claimedAt: null,
    claimCodeDigest: null,
    isActive: true,
  }), "activation_code_missing");
});

test("Student password policy requires length, a letter, a number, and a non-ID value", () => {
  assert.equal(evaluateStudentPassword("Short123", "STUDENT001"), "too_short");
  assert.equal(evaluateStudentPassword("1234567890", "STUDENT001"), "letter_required");
  assert.equal(evaluateStudentPassword("abcdefghij", "STUDENT001"), "number_required");
  assert.equal(evaluateStudentPassword("student001", "STUDENT001"), "matches_login_id");
  assert.equal(evaluateStudentPassword("Belajar2026", "STUDENT001"), "valid");
});

test("activation migration is fail-closed, one-time, and inaccessible to browser roles", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260825100000_student_activation.sql", import.meta.url),
    "utf8",
  );
  const lifecycleSql = await readFile(
    new URL(
      "../supabase/migrations/20260825110000_student_activation_auth_metadata_update.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /create trigger link_student_activation_auth\s+after insert on auth\.users/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /p\.auth_user_id is null/);
  assert.match(sql, /p\.claimed_at is null/);
  assert.match(sql, /p\.claim_code_digest = v_claim_code_digest/);
  assert.match(sql, /auth_user_id = new\.id/);
  assert.match(sql, /claimed_at = now\(\)/);
  assert.match(sql, /claim_code_digest = null/);
  assert.match(sql, /raise exception 'student_activation_link_rejected'/);
  assert.match(sql, /raw_app_meta_data[\s\S]*- 'student_activation'/);
  assert.match(sql, /revoke all on function public\.prepare_student_activation\(text, text\) from authenticated/);
  assert.match(sql, /grant execute on function public\.prepare_student_activation\(text, text\) to service_role/);
  assert.doesNotMatch(sql, /grant [^;]+ to anon|disable row level security|grant all/i);
  assert.match(lifecycleSql, /after insert on auth\.users/);
  assert.match(lifecycleSql, /before update of raw_app_meta_data on auth\.users/);
  assert.match(lifecycleSql, /new\.raw_app_meta_data :=[\s\S]*- 'student_activation'/);
  assert.doesNotMatch(lifecycleSql, /disable row level security|grant all/i);
});

test("activation implementation keeps secrets server-only and exposes only generic public failure", async () => {
  const service = await readFile(
    new URL("../lib/auth/student-activation.ts", import.meta.url),
    "utf8",
  );
  const action = await readFile(new URL("../app/activate/actions.ts", import.meta.url), "utf8");
  const form = await readFile(new URL("../app/activate/activation-form.tsx", import.meta.url), "utf8");
  const adminAction = await readFile(
    new URL("../app/(protected)/admin/students/[loginId]/activation/actions.ts", import.meta.url),
    "utf8",
  );
  const studentList = await readFile(
    new URL("../app/(protected)/admin/students/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(service, /^import "server-only";/);
  assert.match(service, /admin\.auth\.admin\.createUser\(\{/);
  assert.match(service, /email_confirm: true/);
  assert.match(service, /student_activation:/);
  assert.match(service, /admin\.auth\.admin\.deleteUser\(createdAuth\.user\.id\)/);
  assert.match(service, /removeUnlinkedAuthAfterCreateFailure\(admin, loginId, syntheticEmail\)/);
  assert.doesNotMatch(service, /console\./);
  assert.match(action, /^"use server";/);
  assert.doesNotMatch(action, /SUPABASE_SERVICE_ROLE_KEY|claim_code_digest|console\./);
  assert.doesNotMatch(form, /AUTH_EMAIL_DOMAIN|syntheticEmail|claim_code_digest|auth_user_id/);
  assert.match(adminAction, /requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/);
  assert.doesNotMatch(studentList, /state\.code|claim_code_digest|activation-code-value/);
});

test("Student landing page and Admin activation page are protected by server-side roles", async () => {
  const studentPage = await readFile(
    new URL("../app/(protected)/student/page.tsx", import.meta.url),
    "utf8",
  );
  const adminPage = await readFile(
    new URL("../app/(protected)/admin/students/[loginId]/activation/page.tsx", import.meta.url),
    "utf8",
  );
  const syntheticEmail = await readFile(
    new URL("../lib/auth/synthetic-email.ts", import.meta.url),
    "utf8",
  );
  assert.match(studentPage, /requireCurrentPerson\(\{ allowedRoles: \["student"\] \}\)/);
  assert.match(studentPage, /class_name, claimed_at/);
  assert.doesNotMatch(studentPage, /auth_user_id|syntheticEmail|claim_code_digest/);
  assert.match(adminPage, /requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/);
  assert.match(syntheticEmail, /^import "server-only";/);
});
