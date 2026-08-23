import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  digestActivationCode,
  evaluateClaimEligibility,
  verifyActivationCode,
} from "../lib/auth/activation-code";
import { authenticateWithLoginId } from "../lib/auth/login";
import { normalizeLoginId } from "../lib/auth/login-id";
import { shouldRequirePasswordChange } from "../lib/auth/password-policy";
import {
  canReadAttendanceRecord,
  hasCapability,
} from "../lib/auth/permissions";
import type { CurrentPerson } from "../lib/auth/types";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

type SourceFile = {
  path: string;
  source: string;
};

async function readTypeScriptTree(relativeDirectory: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];

  async function visit(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        files.push({
          path: relative(projectRoot, absolutePath).replaceAll("\\", "/"),
          source: await readFile(absolutePath, "utf8"),
        });
      }
    }
  }

  await visit(join(projectRoot, relativeDirectory));
  return files;
}

function testSyntheticEmail(loginId: string): string {
  return `${normalizeLoginId(loginId).toLowerCase()}@auth.school.example`;
}

const student: CurrentPerson = {
  id: "person-student-1",
  authUserId: "auth-student-1",
  loginId: "001234",
  fullName: "Siswa Uji",
  role: "student",
  mustChangePassword: false,
  isActive: true,
};

test("synthetic email mapping is deterministic, preserves leading zeroes, and is server-only", async () => {
  assert.equal(normalizeLoginId(" 001234 "), "001234");
  assert.throws(() => normalizeLoginId("bad id"));

  const source = await readFile(
    new URL("../lib/auth/synthetic-email.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /const normalizedLoginId = normalizeLoginId\(loginId\);/);
  assert.match(source, /const normalizedDomain = validateAuthEmailDomain\(domain\);/);
  assert.match(
    source,
    /return `\$\{normalizedLoginId\.toLowerCase\(\)\}@\$\{normalizedDomain\}`;/,
  );
  assert.doesNotMatch(source, /process\.env/);
});

test("invalid login does not create an application session", async () => {
  let personLookupCalled = false;
  const result = await authenticateWithLoginId("G001", "wrong", {
    resolveEmail: testSyntheticEmail,
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
  const result = await authenticateWithLoginId("001234", "correct", {
    resolveEmail: testSyntheticEmail,
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
  const result = await authenticateWithLoginId("001234", "correct", {
    resolveEmail: testSyntheticEmail,
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

test("an inactive linked Teacher is rejected and signed out", async () => {
  let signedOut = false;
  const inactiveTeacher: CurrentPerson = {
    ...student,
    authUserId: "auth-teacher-1",
    loginId: "G001",
    role: "teacher",
    isActive: false,
  };
  const result = await authenticateWithLoginId("G001", "correct", {
    resolveEmail: testSyntheticEmail,
    async signIn() {
      return inactiveTeacher.authUserId;
    },
    async findPerson() {
      return inactiveTeacher;
    },
    async signOut() {
      signedOut = true;
    },
  });

  assert.deepEqual(result, { status: "invalid" });
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

test("Admin, Teacher, and Student may change only their own authenticated password", () => {
  assert.equal(hasCapability("admin", "change_own_password"), true);
  assert.equal(hasCapability("teacher", "change_own_password"), true);
  assert.equal(hasCapability("student", "change_own_password"), true);
});

test("must_change_password is role-aware and never forces Teacher or Student", () => {
  assert.equal(
    shouldRequirePasswordChange({ role: "admin", mustChangePassword: true }),
    true,
  );
  assert.equal(
    shouldRequirePasswordChange({ role: "admin", mustChangePassword: false }),
    false,
  );
  assert.equal(
    shouldRequirePasswordChange({ role: "teacher", mustChangePassword: true }),
    false,
  );
  assert.equal(
    shouldRequirePasswordChange({ role: "student", mustChangePassword: true }),
    false,
  );
});

test("password changes remain authenticated, server-side, and role-authorized", async () => {
  const source = await readFile(
    new URL("../app/change-password/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /^"use server";/);
  assert.match(source, /requireCurrentPerson\(\{ allowPasswordChangeRequired: true \}\)/);
  assert.match(source, /hasCapability\(person\.role, "change_own_password"\)/);
  assert.match(source, /supabase\.auth\.updateUser\(\{/);
  assert.match(source, /current_password: currentPassword/);
});

test("there is no Teacher or Student forgot-password or email self-reset path", async () => {
  const applicationFiles = [
    ...(await readTypeScriptTree("app")),
    ...(await readTypeScriptTree("lib")),
  ];
  const applicationSource = applicationFiles.map((file) => file.source).join("\n");

  assert.equal(
    applicationFiles.some((file) => /(?:forgot|reset)-password/i.test(file.path)),
    false,
  );
  assert.doesNotMatch(applicationSource, /resetPasswordForEmail/);
  assert.doesNotMatch(applicationSource, /\/forgot-password|\/reset-password/);
});

test("Auth secrets and synthetic-email configuration cannot enter Client Components", async () => {
  const applicationFiles = [
    ...(await readTypeScriptTree("app")),
    ...(await readTypeScriptTree("lib")),
  ];
  const clientFiles = applicationFiles.filter((file) => /^"use client";/m.test(file.source));
  assert.ok(clientFiles.length > 0, "Expected at least one Client Component module.");

  for (const file of clientFiles) {
    assert.doesNotMatch(file.source, /AUTH_EMAIL_DOMAIN/, file.path);
    assert.doesNotMatch(file.source, /SUPABASE_SERVICE_ROLE_KEY/, file.path);
    assert.doesNotMatch(file.source, /auth\/synthetic-email/, file.path);
    assert.doesNotMatch(file.source, /auth\/server-config/, file.path);
    assert.doesNotMatch(file.source, /supabase\/admin/, file.path);
  }

  const adminClientSource = await readFile(
    new URL("../lib/supabase/admin.ts", import.meta.url),
    "utf8",
  );
  const serverConfigSource = await readFile(
    new URL("../lib/auth/server-config.ts", import.meta.url),
    "utf8",
  );
  assert.match(adminClientSource, /^import "server-only";/);
  assert.match(adminClientSource, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(serverConfigSource, /^import "server-only";/);
  assert.match(serverConfigSource, /process\.env\.AUTH_EMAIL_DOMAIN/);
});

test("development Admin provisioning validates identity and prevents duplicate states", async () => {
  const source = await readFile(
    new URL("../lib/auth/provision-development-admin.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /const loginId = normalizeLoginId\(input\.loginId\);/);
  assert.match(source, /const fullName = input\.fullName\.trim\(\);/);
  assert.match(source, /if \(!input\.password\)/);
  assert.match(source, /\.eq\("role", "admin"\)/);
  assert.match(source, /existingAdmins\.length !== 1/);
  assert.match(source, /\.eq\("login_id", loginId\)/);
  assert.match(source, /findAuthUserByEmail\(admin, syntheticEmail\)/);
  assert.match(source, /"admin_already_exists"/);
  assert.match(source, /"login_id_in_use"/);
  assert.match(source, /"auth_identity_exists"/);
});

test("development Admin provisioning confirms Auth, links people, and rolls back failure", async () => {
  const source = await readFile(
    new URL("../lib/auth/provision-development-admin.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /admin\.auth\.admin\.createUser\(\{/);
  assert.match(source, /email_confirm: true/);
  assert.match(source, /auth_user_id: createdAuth\.user\.id/);
  assert.match(source, /role: "admin"/);
  assert.match(source, /must_change_password: false/);
  assert.match(source, /is_active: true/);
  assert.match(source, /admin\.auth\.admin\.deleteUser\(createdAuth\.user\.id\)/);
  assert.doesNotMatch(source, /console\./);
  assert.doesNotMatch(source, /return \{[^}]*syntheticEmail/);
});

test("Teacher creation is server-only, duplicate-safe, linked, and rollback-safe", async () => {
  const source = await readFile(
    new URL("../lib/auth/teacher-management.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /const loginId = normalizeLoginId\(input\.loginId\);/);
  assert.match(source, /\.eq\("login_id", loginId\)/);
  assert.match(source, /findAuthUserByEmail\(admin, syntheticEmail\)/);
  assert.match(source, /admin\.auth\.admin\.createUser\(\{/);
  assert.match(source, /email_confirm: true/);
  assert.match(source, /auth_user_id: createdAuth\.user\.id/);
  assert.match(source, /role: "teacher"/);
  assert.match(source, /must_change_password: false/);
  assert.match(source, /is_active: true/);
  assert.match(source, /admin\.auth\.admin\.deleteUser\(createdAuth\.user\.id\)/);
  assert.doesNotMatch(source, /console\./);
});

test("Teacher status and password reset operations target Teacher accounts only", async () => {
  const source = await readFile(
    new URL("../lib/auth/teacher-management.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /\.update\(\{ is_active: isActive \}\)/);
  assert.match(source, /\.eq\("role", "teacher"\)/);
  assert.match(source, /admin\.auth\.admin\.updateUserById\(teacher\.auth_user_id, \{/);
  assert.doesNotMatch(source, /must_change_password: true/);
});

test("every Teacher management action requires an authenticated Admin", async () => {
  const source = await readFile(
    new URL("../app/(protected)/admin/teachers/actions.ts", import.meta.url),
    "utf8",
  );
  const adminGuards = source.match(/requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/g);
  assert.equal(adminGuards?.length, 3);
  assert.match(source, /^"use server";/);
  assert.doesNotMatch(source, /signUp\(|resetPasswordForEmail/);
});

test("Teacher management UI does not display internal Auth identifiers", async () => {
  const source = await readFile(
    new URL("../app/(protected)/admin/teachers/page.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /auth_user_id|syntheticEmail|AUTH_EMAIL_DOMAIN|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /type="password"/);
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

test("development provisioning migration grants only narrow people access", async () => {
  const migrationUrl = new URL(
    "../supabase/migrations/20260824000000_service_role_people_provisioning.sql",
    import.meta.url,
  );
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /grant select, insert on table public\.people to service_role;/);
  assert.doesNotMatch(sql, /\b(anon|authenticated)\b/);
  assert.doesNotMatch(sql, /disable row level security|grant all/i);
});

test("Teacher status migration grants only service-role is_active updates", async () => {
  const migrationUrl = new URL(
    "../supabase/migrations/20260824010000_service_role_teacher_status.sql",
    import.meta.url,
  );
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /grant update \(is_active\) on table public\.people to service_role;/);
  assert.doesNotMatch(sql, /\b(anon|authenticated)\b/);
  assert.doesNotMatch(sql, /disable row level security|grant all|\bdelete\b/i);
});
