import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { normalizeLoginId } from "../lib/auth/login-id";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)));

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_EMAIL_DOMAIN",
  "DEV_TEACHER_LOGIN_ID",
  "DEV_TEACHER_RESET_PASSWORD",
] as const;

const isConfigured = requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Teacher integration test.`);
  return value;
}

function client(key: string) {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function syntheticEmailForTest(loginId: string): string {
  const domain = required("AUTH_EMAIL_DOMAIN").trim().toLowerCase();
  return `${normalizeLoginId(loginId).toLowerCase()}@${domain}`;
}

test("single development Teacher Auth linkage and RLS", { skip: !isConfigured }, async () => {
  const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const service = client(required("SUPABASE_SERVICE_ROLE_KEY"));
  const loginId = normalizeLoginId(required("DEV_TEACHER_LOGIN_ID"));

  const { data: teachers, error: teachersError } = await service
    .from("people")
    .select("id, auth_user_id, login_id, role, is_active")
    .eq("role", "teacher");
  assert.equal(teachersError, null);
  assert.ok(teachers);
  assert.equal(teachers.length, 1);
  const teacher = teachers[0];
  assert.equal(teacher.login_id, loginId);
  assert.equal(teacher.role, "teacher");
  assert.equal(teacher.is_active, true);

  const anonymous = client(publishableKey);
  const anonymousPeople = await anonymous.from("people").select("id").limit(1);
  assert.ok(anonymousPeople.error, "Anonymous people access must remain denied.");

  const teacherClient = client(publishableKey);
  const { data: auth, error: authError } = await teacherClient.auth.signInWithPassword({
    email: syntheticEmailForTest(loginId),
    password: required("DEV_TEACHER_RESET_PASSWORD"),
  });
  assert.equal(authError, null);
  assert.ok(auth.user);
  assert.equal(auth.user.id, teacher.auth_user_id);

  const { data: ownPerson, error: ownPersonError } = await teacherClient
    .from("people")
    .select("auth_user_id, login_id, role, is_active")
    .eq("auth_user_id", auth.user.id)
    .single();
  assert.equal(ownPersonError, null);
  assert.ok(ownPerson);
  assert.equal(ownPerson.role, "teacher");
  assert.equal(ownPerson.is_active, true);

  const unauthorizedStatusChange = await teacherClient
    .from("people")
    .update({ is_active: false })
    .eq("id", teacher.id);
  assert.ok(unauthorizedStatusChange.error, "Teacher must not update account status.");

  const { error: signOutError } = await teacherClient.auth.signOut();
  assert.equal(signOutError, null);
});
