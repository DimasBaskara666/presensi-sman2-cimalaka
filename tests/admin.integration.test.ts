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
  "AUTH_EMAIL_DOMAIN",
  "DEV_ADMIN_LOGIN_ID",
  "DEV_ADMIN_PASSWORD",
] as const;

const isConfigured = requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Admin integration test.`);
  return value;
}

function syntheticEmailForTest(loginId: string): string {
  const domain = required("AUTH_EMAIL_DOMAIN").trim().toLowerCase();
  return `${normalizeLoginId(loginId).toLowerCase()}@${domain}`;
}

test("development Admin Auth linkage and RLS", { skip: !isConfigured }, async () => {
  const client = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const anonymous = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const anonymousPeople = await anonymous.from("people").select("id").limit(1);
  assert.ok(anonymousPeople.error, "Anonymous people access must remain denied.");

  const loginId = normalizeLoginId(required("DEV_ADMIN_LOGIN_ID"));
  const { data: auth, error: authError } = await client.auth.signInWithPassword({
    email: syntheticEmailForTest(loginId),
    password: required("DEV_ADMIN_PASSWORD"),
  });
  assert.equal(authError, null);
  assert.ok(auth.user);

  const { data: person, error: personError } = await client
    .from("people")
    .select("auth_user_id, login_id, role, is_active")
    .eq("auth_user_id", auth.user.id)
    .single();
  assert.equal(personError, null);
  assert.ok(person);
  assert.equal(person.auth_user_id, auth.user.id);
  assert.equal(person.login_id, loginId);
  assert.equal(person.role, "admin");
  assert.equal(person.is_active, true);

  const adminPeopleRead = await client.from("people").select("id, role");
  assert.equal(adminPeopleRead.error, null);
  assert.ok(adminPeopleRead.data && adminPeopleRead.data.length >= 1);

  const settingsRead = await client
    .from("attendance_settings")
    .select("id, timezone")
    .eq("id", 1)
    .single();
  assert.equal(settingsRead.error, null);
  assert.ok(settingsRead.data);

  const { error: signOutError } = await client.auth.signOut();
  assert.equal(signOutError, null);
});
