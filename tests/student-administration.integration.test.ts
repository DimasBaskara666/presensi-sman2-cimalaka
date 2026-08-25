import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authenticateWithLoginId } from "../lib/auth/login";
import { normalizeLoginId } from "../lib/auth/login-id";
import { evaluateStudentPassword } from "../lib/auth/password-policy";
import type { CurrentPerson } from "../lib/auth/types";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true);

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_EMAIL_DOMAIN",
  "NEXT_PUBLIC_APP_URL",
  "DEV_STUDENT_LOGIN_ID",
  "DEV_STUDENT_PASSWORD",
] as const;

const isConfigured = requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Student administration integration test.`);
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

async function authUserCount(service: SupabaseClient): Promise<number> {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ok(!error, "Supabase Auth users could not be counted.");
  return data.users.length;
}

async function setActive(
  service: SupabaseClient,
  loginId: string,
  active: boolean,
): Promise<void> {
  const result = await service
    .from("people")
    .update({ is_active: active })
    .eq("login_id", loginId)
    .eq("role", "student")
    .select("id")
    .maybeSingle();
  assert.ok(!result.error && result.data, "Student status could not be changed through the narrow service boundary.");
}

async function browserSession(password: string, loginId: string) {
  const cookieJar = new Map<string, string>();
  const supabase = createServerClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => cookieJar.set(name, value)),
      },
    },
  );
  const signIn = await supabase.auth.signInWithPassword({ email: syntheticEmail(loginId), password });
  assert.ok(!signIn.error, "Student Auth session could not be created.");
  return {
    cookieHeader: [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; "),
    supabase,
  };
}

test("Admin Student status and password reset preserve identity, attendance, and Auth count", { skip: !isConfigured }, async (context) => {
  const service = client(required("SUPABASE_SERVICE_ROLE_KEY"));
  const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const loginId = normalizeLoginId(required("DEV_STUDENT_LOGIN_ID"));
  const originalPassword = required("DEV_STUDENT_PASSWORD");
  const temporaryPassword = `${randomBytes(18).toString("base64url")}A1`;
  assert.equal(evaluateStudentPassword(originalPassword, loginId), "valid");
  assert.equal(evaluateStudentPassword(temporaryPassword, loginId), "valid");

  const initialProfile = await service
    .from("people")
    .select("id, auth_user_id, login_id, role, is_active")
    .eq("login_id", loginId)
    .single();
  assert.ok(!initialProfile.error);
  assert.equal(initialProfile.data.role, "student");
  assert.equal(initialProfile.data.is_active, true);
  assert.equal(typeof initialProfile.data.auth_user_id, "string");
  const authUserId = initialProfile.data.auth_user_id as string;
  const initialAuthCount = await authUserCount(service);

  const initialStudent = client(publishableKey);
  const initialLogin = await initialStudent.auth.signInWithPassword({
    email: syntheticEmail(loginId),
    password: originalPassword,
  });
  assert.ok(!initialLogin.error);
  const initialAttendance = await initialStudent
    .from("attendance_daily")
    .select("id, attendance_date")
    .order("id");
  assert.ok(!initialAttendance.error);

  context.after(async () => {
    const restoredPassword = await service.auth.admin.updateUserById(authUserId, {
      password: originalPassword,
    });
    assert.ok(!restoredPassword.error, "Original Student password could not be restored.");
    await setActive(service, loginId, true);

    const restored = client(publishableKey);
    const restoredLogin = await restored.auth.signInWithPassword({
      email: syntheticEmail(loginId),
      password: originalPassword,
    });
    assert.ok(!restoredLogin.error, "Restored Student credentials could not sign in.");
    const restoredProfile = await restored
      .from("people")
      .select("auth_user_id, login_id, role, is_active")
      .eq("login_id", loginId)
      .single();
    assert.ok(!restoredProfile.error);
    assert.equal(restoredProfile.data.auth_user_id, authUserId);
    assert.equal(restoredProfile.data.role, "student");
    assert.equal(restoredProfile.data.is_active, true);
    const restoredAttendance = await restored
      .from("attendance_daily")
      .select("id, attendance_date")
      .order("id");
    assert.ok(!restoredAttendance.error);
    assert.deepEqual(restoredAttendance.data, initialAttendance.data);
    assert.equal(await authUserCount(service), initialAuthCount);
    await Promise.all([initialStudent.auth.signOut(), restored.auth.signOut()]);
  });

  const studentDirectStatus = await initialStudent
    .from("people")
    .update({ is_active: false })
    .eq("login_id", loginId);
  assert.ok(studentDirectStatus.error, "Student must not change their own active status.");

  await setActive(service, loginId, false);
  const inactiveProfile = await service
    .from("people")
    .select("auth_user_id, role, is_active")
    .eq("login_id", loginId)
    .single();
  assert.ok(!inactiveProfile.error);
  assert.equal(inactiveProfile.data.auth_user_id, authUserId);
  assert.equal(inactiveProfile.data.role, "student");
  assert.equal(inactiveProfile.data.is_active, false);

  const applicationLoginClient = client(publishableKey);
  let applicationSignedOut = false;
  const applicationLogin = await authenticateWithLoginId(loginId, originalPassword, {
    resolveEmail: syntheticEmail,
    async signIn(email, password) {
      const result = await applicationLoginClient.auth.signInWithPassword({ email, password });
      return result.error ? null : result.data.user.id;
    },
    async findPerson(authId): Promise<CurrentPerson | null> {
      const result = await applicationLoginClient
        .from("people")
        .select("id, auth_user_id, login_id, full_name, role, must_change_password, is_active")
        .eq("auth_user_id", authId)
        .maybeSingle();
      if (result.error || !result.data) return null;
      return {
        id: result.data.id,
        authUserId: result.data.auth_user_id,
        loginId: result.data.login_id,
        fullName: result.data.full_name,
        role: result.data.role,
        mustChangePassword: result.data.must_change_password,
        isActive: result.data.is_active,
      } as CurrentPerson;
    },
    async signOut() {
      applicationSignedOut = true;
      await applicationLoginClient.auth.signOut();
    },
  });
  assert.deepEqual(applicationLogin, { status: "invalid" });
  assert.equal(applicationSignedOut, true);

  const inactiveBrowser = await browserSession(originalPassword, loginId);
  const appUrl = required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const inactivePage = await fetch(`${appUrl}/student`, {
    headers: { cookie: inactiveBrowser.cookieHeader },
    redirect: "follow",
  });
  assert.match(inactivePage.url, /\/login$/);

  const reset = await service.auth.admin.updateUserById(authUserId, {
    password: temporaryPassword,
  });
  assert.ok(!reset.error, "Student password could not be reset through Supabase Admin Auth.");
  const oldPasswordClient = client(publishableKey);
  const oldPasswordLogin = await oldPasswordClient.auth.signInWithPassword({
    email: syntheticEmail(loginId),
    password: originalPassword,
  });
  assert.ok(oldPasswordLogin.error, "The old Student password must stop working after reset.");

  const resetPasswordClient = client(publishableKey);
  const resetPasswordLogin = await resetPasswordClient.auth.signInWithPassword({
    email: syntheticEmail(loginId),
    password: temporaryPassword,
  });
  assert.ok(!resetPasswordLogin.error, "The reset Student password must authenticate.");
  assert.equal(resetPasswordLogin.data.user.id, authUserId);

  await setActive(service, loginId, true);
  const activeBrowser = await browserSession(temporaryPassword, loginId);
  const activePage = await fetch(`${appUrl}/student`, {
    headers: { cookie: activeBrowser.cookieHeader },
    redirect: "follow",
  });
  assert.equal(activePage.status, 200);
  assert.match(activePage.url, /\/student$/);
  const activeHtml = await activePage.text();
  assert.ok(activeHtml.includes(loginId));
  assert.ok(!activeHtml.includes(authUserId));

  const finalProfile = await service
    .from("people")
    .select("auth_user_id, role, is_active")
    .eq("login_id", loginId)
    .single();
  assert.ok(!finalProfile.error);
  assert.equal(finalProfile.data.auth_user_id, authUserId);
  assert.equal(finalProfile.data.role, "student");
  assert.equal(finalProfile.data.is_active, true);
  const finalAttendance = await resetPasswordClient
    .from("attendance_daily")
    .select("id, attendance_date")
    .order("id");
  assert.ok(!finalAttendance.error);
  assert.deepEqual(finalAttendance.data, initialAttendance.data);
  assert.equal(await authUserCount(service), initialAuthCount);

  await Promise.all([
    inactiveBrowser.supabase.auth.signOut(),
    activeBrowser.supabase.auth.signOut(),
    resetPasswordClient.auth.signOut(),
  ]);
});
