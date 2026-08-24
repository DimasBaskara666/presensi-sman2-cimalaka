import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeLoginId } from "../lib/auth/login-id";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true);

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_EMAIL_DOMAIN",
  "DEV_ADMIN_LOGIN_ID",
  "DEV_ADMIN_PASSWORD",
  "DEV_TEACHER_LOGIN_ID",
  "DEV_TEACHER_RESET_PASSWORD",
] as const;

const isConfigured = requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Student Import integration test.`);
  return value;
}

function client(key: string): SupabaseClient {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function syntheticEmail(loginId: string): string {
  return `${normalizeLoginId(loginId).toLowerCase()}@${required("AUTH_EMAIL_DOMAIN").trim().toLowerCase()}`;
}

async function signIn(loginId: string, password: string): Promise<SupabaseClient> {
  const authenticated = client(required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const { error } = await authenticated.auth.signInWithPassword({
    email: syntheticEmail(loginId),
    password,
  });
  assert.equal(error, null);
  return authenticated;
}

test("Student roster RPC is atomic, Auth-preserving, and hidden from Teachers", { skip: !isConfigured }, async (context) => {
  const service = client(required("SUPABASE_SERVICE_ROLE_KEY"));
  const admin = await signIn(required("DEV_ADMIN_LOGIN_ID"), required("DEV_ADMIN_PASSWORD"));
  const teacher = await signIn(
    required("DEV_TEACHER_LOGIN_ID"),
    required("DEV_TEACHER_RESET_PASSWORD"),
  );
  const runPrefix = `ZST${Date.now().toString(36).toUpperCase()}`;
  const firstId = `${runPrefix}01`;
  const secondId = `${runPrefix}02`;
  const rollbackId = `${runPrefix}03`;
  const identityConflictId = `${runPrefix}04`;
  const authBefore = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.equal(authBefore.error, null);
  const linkedBefore = await service
    .from("people")
    .select("id", { count: "exact", head: true })
    .eq("role", "student")
    .not("auth_user_id", "is", null);
  assert.equal(linkedBefore.error, null);

  context.after(async () => {
    const cleanup = await service.rpc("cleanup_synthetic_student_import", {
      p_prefix: runPrefix,
      p_expected_count: 2,
    });
    assert.equal(cleanup.error, null);
    assert.equal(cleanup.data, 2);
    await Promise.all([admin.auth.signOut(), teacher.auth.signOut()]);
  });

  const payload = [
    {
      login_id: firstId,
      full_name: "Synthetic Integration Student One",
      class_name: "SYN-INT-1",
      nis: firstId,
      nisn: null,
    },
    {
      login_id: secondId,
      full_name: "Synthetic Integration Student Two",
      class_name: "SYN-INT-2",
      nis: secondId,
      nisn: null,
    },
  ];

  const adminRpc = await admin.rpc("import_student_roster", { p_students: payload });
  assert.ok(adminRpc.error, "Authenticated Admin clients must not call the service-role import RPC.");
  const teacherRpc = await teacher.rpc("import_student_roster", { p_students: payload });
  assert.ok(teacherRpc.error, "Teachers must not call the import RPC.");

  const firstImport = await service.rpc("import_student_roster", { p_students: payload });
  assert.equal(firstImport.error, null);
  assert.deepEqual(firstImport.data, [{ inserted_count: 2, updated_count: 0, unchanged_count: 0 }]);

  const imported = await service
    .from("people")
    .select("login_id, role, nis, nisn, class_name, auth_user_id, claimed_at, claim_code_digest, is_active")
    .in("login_id", [firstId, secondId])
    .order("login_id");
  assert.equal(imported.error, null);
  assert.equal(imported.data?.length, 2);
  for (const student of imported.data ?? []) {
    assert.equal(student.role, "student");
    assert.equal(student.auth_user_id, null);
    assert.equal(student.claimed_at, null);
    assert.equal(student.claim_code_digest, null);
    assert.equal(student.is_active, true);
  }

  const adminRead = await admin
    .from("people")
    .select("login_id, nis, nisn, auth_user_id, claimed_at")
    .in("login_id", [firstId, secondId]);
  assert.equal(adminRead.error, null);
  assert.equal(adminRead.data?.length, 2);

  const teacherRead = await teacher
    .from("people")
    .select("login_id, nis, nisn, auth_user_id, claimed_at")
    .in("login_id", [firstId, secondId]);
  assert.equal(teacherRead.error, null);
  assert.deepEqual(teacherRead.data, []);

  const deactivate = await service
    .from("people")
    .update({ is_active: false })
    .eq("role", "student")
    .eq("login_id", secondId);
  assert.equal(deactivate.error, null);

  const updatePayload = [
    payload[0],
    { ...payload[1], full_name: "Synthetic Integration Student Two Updated", class_name: "SYN-INT-3" },
  ];
  const secondImport = await service.rpc("import_student_roster", { p_students: updatePayload });
  assert.equal(secondImport.error, null);
  assert.deepEqual(secondImport.data, [{ inserted_count: 0, updated_count: 1, unchanged_count: 1 }]);

  const inactiveAfterUpdate = await service
    .from("people")
    .select("full_name, class_name, is_active, auth_user_id, claimed_at")
    .eq("login_id", secondId)
    .single();
  assert.equal(inactiveAfterUpdate.error, null);
  assert.equal(inactiveAfterUpdate.data?.full_name, "Synthetic Integration Student Two Updated");
  assert.equal(inactiveAfterUpdate.data?.class_name, "SYN-INT-3");
  assert.equal(inactiveAfterUpdate.data?.is_active, false);
  assert.equal(inactiveAfterUpdate.data?.auth_user_id, null);
  assert.equal(inactiveAfterUpdate.data?.claimed_at, null);

  const atomicFailure = await service.rpc("import_student_roster", {
    p_students: [
      {
        login_id: rollbackId,
        full_name: "Synthetic Rollback Student",
        class_name: "SYN-ROLLBACK",
        nis: rollbackId,
        nisn: null,
      },
      {
        login_id: normalizeLoginId(required("DEV_TEACHER_LOGIN_ID")),
        full_name: "Synthetic Invalid Collision",
        class_name: "SYN-ROLLBACK",
        nis: normalizeLoginId(required("DEV_TEACHER_LOGIN_ID")),
        nisn: null,
      },
    ],
  });
  assert.ok(atomicFailure.error);
  const rolledBack = await service.from("people").select("id").eq("login_id", rollbackId);
  assert.equal(rolledBack.error, null);
  assert.deepEqual(rolledBack.data, []);

  const identityFailure = await service.rpc("import_student_roster", {
    p_students: [{
      login_id: identityConflictId,
      full_name: "Synthetic Identity Conflict",
      class_name: "SYN-CONFLICT",
      nis: firstId,
      nisn: null,
    }],
  });
  assert.ok(identityFailure.error);
  const identityRolledBack = await service
    .from("people")
    .select("id")
    .eq("login_id", identityConflictId);
  assert.equal(identityRolledBack.error, null);
  assert.deepEqual(identityRolledBack.data, []);

  const authAfter = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.equal(authAfter.error, null);
  assert.equal(authAfter.data.users.length, authBefore.data.users.length);
  const linkedAfter = await service
    .from("people")
    .select("id", { count: "exact", head: true })
    .eq("role", "student")
    .not("auth_user_id", "is", null);
  assert.equal(linkedAfter.error, null);
  assert.equal(linkedAfter.count, linkedBefore.count);
});
