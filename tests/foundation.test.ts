import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  digestActivationCode,
  evaluateClaimEligibility,
  verifyActivationCode,
} from "../lib/auth/activation-code";
import { authenticateWithLoginId } from "../lib/auth/login";
import {
  canReadAttendanceRecord,
  hasCapability,
} from "../lib/auth/permissions";
import { normalizeLoginId, toSyntheticEmail } from "../lib/auth/synthetic-email";
import type { CurrentPerson } from "../lib/auth/types";

const student: CurrentPerson = {
  id: "person-student-1",
  authUserId: "auth-student-1",
  loginId: "001234",
  fullName: "Siswa Uji",
  role: "student",
  mustChangePassword: false,
  isActive: true,
};

test("synthetic email mapping is deterministic and preserves leading zeroes", () => {
  assert.equal(normalizeLoginId(" 001234 "), "001234");
  assert.equal(
    toSyntheticEmail(" g001 ", "auth.school.example"),
    "g001@auth.school.example",
  );
  assert.throws(() => toSyntheticEmail("bad id", "auth.school.example"));
});

test("invalid login does not create an application session", async () => {
  let personLookupCalled = false;
  const result = await authenticateWithLoginId("G001", "wrong", "auth.school.example", {
    async signIn() {
      return null;
    },
    async findPerson() {
      personLookupCalled = true;
      return student;
    },
    async signOut() {},
  });

  assert.deepEqual(result, { status: "invalid" });
  assert.equal(personLookupCalled, false);
});

test("valid login uses the internal email and database-linked role", async () => {
  let receivedEmail = "";
  const result = await authenticateWithLoginId("001234", "correct", "auth.school.example", {
    async signIn(email) {
      receivedEmail = email;
      return student.authUserId;
    },
    async findPerson() {
      return student;
    },
    async signOut() {},
  });

  assert.equal(receivedEmail, "001234@auth.school.example");
  assert.equal(result.status, "authenticated");
  if (result.status === "authenticated") assert.equal(result.person.role, "student");
});

test("an unlinked or inactive Auth user is signed out", async () => {
  let signedOut = false;
  const result = await authenticateWithLoginId("001234", "correct", "auth.school.example", {
    async signIn() {
      return "unlinked-auth-user";
    },
    async findPerson() {
      return null;
    },
    async signOut() {
      signedOut = true;
    },
  });

  assert.equal(result.status, "invalid");
  assert.equal(signedOut, true);
});

test("role permissions deny anonymous and cross-student attendance access", () => {
  assert.equal(canReadAttendanceRecord(null, student.id), false);
  assert.equal(
    canReadAttendanceRecord({ role: "student", personId: student.id }, "person-student-2"),
    false,
  );
  assert.equal(
    canReadAttendanceRecord({ role: "student", personId: student.id }, student.id),
    true,
  );
});

test("teacher cannot access admin functions while admin can", () => {
  assert.equal(hasCapability("teacher", "access_admin"), false);
  assert.equal(hasCapability("admin", "access_admin"), true);
  assert.equal(hasCapability("teacher", "read_all_attendance"), true);
});

test("activation code digest is server-verifiable and case-normalized", () => {
  const digest = digestActivationCode(" abcd-1234 ", "test-only-pepper");
  assert.equal(digest.length, 64);
  assert.equal(verifyActivationCode("ABCD-1234", digest, "test-only-pepper"), true);
  assert.equal(verifyActivationCode("WRONG", digest, "test-only-pepper"), false);
});

test("activation claim rules reject unsafe account states", () => {
  assert.equal(evaluateClaimEligibility(null), "not_found");
  assert.equal(
    evaluateClaimEligibility({
      role: "teacher",
      authUserId: null,
      claimedAt: null,
      claimCodeDigest: "digest",
      isActive: true,
    }),
    "not_student",
  );
  assert.equal(
    evaluateClaimEligibility({
      role: "student",
      authUserId: null,
      claimedAt: null,
      claimCodeDigest: "digest",
      isActive: false,
    }),
    "inactive",
  );
  assert.equal(
    evaluateClaimEligibility({
      role: "student",
      authUserId: "already-linked",
      claimedAt: "2026-08-20T00:00:00Z",
      claimCodeDigest: null,
      isActive: true,
    }),
    "already_claimed",
  );
  assert.equal(
    evaluateClaimEligibility({
      role: "student",
      authUserId: null,
      claimedAt: null,
      claimCodeDigest: "digest",
      isActive: true,
    }),
    "claimable",
  );
});

test("migration contains four RLS-protected application tables", async () => {
  const migrationUrl = new URL(
    "../supabase/migrations/20260820000000_foundation.sql",
    import.meta.url,
  );
  const sql = await readFile(migrationUrl, "utf8");

  const tables = ["people", "attendance_daily", "attendance_settings", "qr_tokens"];
  for (const table of tables) {
    assert.match(sql, new RegExp(`create table public\\.${table} \\(`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`));
  }

  assert.match(sql, /attendance_daily_student_date_unique unique \(student_id, attendance_date\)/);
  assert.match(sql, /create policy attendance_settings_update_admin/);
  assert.doesNotMatch(sql, /grant (insert|delete) on public\.attendance_daily to authenticated/);
});
