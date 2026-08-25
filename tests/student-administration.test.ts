import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateWithLoginId } from "../lib/auth/login";
import type { CurrentPerson } from "../lib/auth/types";

const inactiveStudent: CurrentPerson = {
  id: "student-person-id",
  authUserId: "student-auth-id",
  loginId: "ZST001",
  fullName: "Synthetic Student",
  role: "student",
  mustChangePassword: false,
  isActive: false,
};

test("inactive Student authentication is rejected and its session is cleared", async () => {
  let signedOut = false;
  const result = await authenticateWithLoginId("ZST001", "valid-password", {
    resolveEmail: () => "zst001@auth.school.example",
    async signIn() {
      return inactiveStudent.authUserId;
    },
    async findPerson() {
      return inactiveStudent;
    },
    async signOut() {
      signedOut = true;
    },
  });
  assert.deepEqual(result, { status: "invalid" });
  assert.equal(signedOut, true);
});

test("Student status changes only is_active and targets the Student role", async () => {
  const source = await readFile(
    new URL("../lib/students/student-management.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /\.update\(\{ is_active: isActive \}\)/);
  assert.match(source, /\.eq\("login_id", loginId\)[\s\S]*\.eq\("role", "student"\)/);
  assert.doesNotMatch(source, /\.update\(\{[^}]*\b(?:role|auth_user_id)\b/);
});

test("Student password reset requires activation and uses only Supabase Admin Auth", async () => {
  const source = await readFile(
    new URL("../lib/students/student-management.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /evaluateStudentPassword\(password, loginId\) !== "valid"/);
  assert.match(source, /\.select\("auth_user_id, role"\)/);
  assert.match(source, /if \(!student\.auth_user_id \|\| student\.role !== "student"\)/);
  assert.match(source, /admin\.auth\.admin\.updateUserById\(student\.auth_user_id, \{[\s\S]*password/);
  assert.doesNotMatch(source, /auth\.admin\.createUser|auth\.admin\.deleteUser|resetPasswordForEmail/);
  assert.doesNotMatch(source, /\.from\("people"\)[\s\S]*\.update\(\{[^}]*password/);
});

test("all Student administration actions require an authenticated Admin", async () => {
  const actions = await readFile(
    new URL("../app/(protected)/admin/students/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /^"use server";/);
  const guards = actions.match(/requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/g);
  assert.equal(guards?.length, 2);
  assert.doesNotMatch(actions, /createAdminClient|SUPABASE_SERVICE_ROLE_KEY|resetPasswordForEmail/);
});

test("Student management UI hides Auth identifiers and reset controls from unactivated rows", async () => {
  const page = await readFile(
    new URL("../app/(protected)/admin/students/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/);
  assert.match(page, /student\.isActivated \? \(/);
  assert.match(page, /type="password"/);
  assert.doesNotMatch(page, /auth_user_id|syntheticEmail|AUTH_EMAIL_DOMAIN|SUPABASE_SERVICE_ROLE_KEY/);
});

test("the existing grant is narrow enough for Student activation status", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260824010000_service_role_teacher_status.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /grant update \(is_active\) on table public\.people to service_role;/);
  assert.doesNotMatch(migration, /grant update \([^)]*(?:role|auth_user_id)/);
  assert.doesNotMatch(migration, /\b(?:anon|authenticated)\b/);
});
