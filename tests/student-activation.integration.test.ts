import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import nextEnv from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { digestActivationCode, generateActivationCode } from "../lib/auth/activation-code";
import { normalizeLoginId } from "../lib/auth/login-id";
import { evaluateStudentPassword } from "../lib/auth/password-policy";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true);

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_EMAIL_DOMAIN",
  "ACTIVATION_CODE_PEPPER",
  "ACTIVATION_CODE_TTL_HOURS",
  "NEXT_PUBLIC_APP_URL",
  "DEV_STUDENT_LOGIN_ID",
  "DEV_STUDENT_FULL_NAME",
  "DEV_STUDENT_CLASS_NAME",
  "DEV_STUDENT_PASSWORD",
] as const;

const isConfigured = requiredEnvironment.every((name) => Boolean(process.env[name]));

function required(name: (typeof requiredEnvironment)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Student activation integration test.`);
  return value;
}

function supabaseClient(key: string): SupabaseClient {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function syntheticEmail(loginId: string): string {
  return `${normalizeLoginId(loginId).toLowerCase()}@${required("AUTH_EMAIL_DOMAIN").trim().toLowerCase()}`;
}

test("one synthetic Student activates atomically, signs in, and remains isolated", { skip: !isConfigured }, async (context) => {
  const service = supabaseClient(required("SUPABASE_SERVICE_ROLE_KEY"));
  const loginId = normalizeLoginId(required("DEV_STUDENT_LOGIN_ID"));
  const fullName = required("DEV_STUDENT_FULL_NAME").trim();
  const className = required("DEV_STUDENT_CLASS_NAME").trim();
  const password = required("DEV_STUDENT_PASSWORD");
  assert.match(loginId, /^ZST[A-Z0-9._-]+$/, "Development Student ID must use the ZST synthetic prefix.");
  assert.ok(fullName.startsWith("Synthetic Development Student"));
  assert.ok(className.length > 0);
  assert.equal(evaluateStudentPassword(password, loginId), "valid");

  const authBefore = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ok(!authBefore.error, "Auth-user count could not be read before activation.");
  const staffBefore = await service
    .from("people")
    .select("id, auth_user_id, updated_at")
    .in("role", ["admin", "teacher"])
    .order("id");
  assert.ok(!staffBefore.error, "Staff profiles could not be read before activation.");

  const existing = await service
    .from("people")
    .select("role, auth_user_id, claimed_at, claim_code_digest, is_active")
    .eq("login_id", loginId)
    .maybeSingle();
  assert.ok(!existing.error, "Development Student lookup failed.");
  if (!existing.data) {
    const imported = await service.rpc("import_student_roster", {
      p_students: [{
        login_id: loginId,
        full_name: fullName,
        class_name: className,
        nis: loginId,
        nisn: null,
      }],
    });
    assert.ok(!imported.error, "Synthetic development Student could not be imported.");
    assert.deepEqual(imported.data, [{ inserted_count: 1, updated_count: 0, unchanged_count: 0 }]);
  } else {
    assert.equal(existing.data.role, "student");
    assert.equal(existing.data.is_active, true);
  }

  const wasAlreadyClaimed = Boolean(existing.data?.auth_user_id);
  let preparedDigest: string | null = null;
  if (!wasAlreadyClaimed) {
    const generated = generateActivationCode(Number(required("ACTIVATION_CODE_TTL_HOURS")));
    preparedDigest = digestActivationCode(generated.code, required("ACTIVATION_CODE_PEPPER"));
    const prepared = await service.rpc("prepare_student_activation", {
      p_login_id: loginId,
      p_claim_code_digest: preparedDigest,
    });
    assert.ok(!prepared.error, "Synthetic Student activation code could not be prepared.");
    assert.equal(prepared.data, true);

    const rejectedCreation = await service.auth.admin.createUser({
      email: syntheticEmail(loginId),
      password,
      email_confirm: true,
      app_metadata: {
        student_activation: {
          login_id: loginId,
          claim_code_digest: "f".repeat(64),
        },
      },
    });
    assert.ok(rejectedCreation.error, "A mismatched activation digest must reject Auth creation.");
    const usersAfterRejectedCreation = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    assert.ok(!usersAfterRejectedCreation.error, "Rejected Auth creation could not be audited.");
    assert.equal(
      usersAfterRejectedCreation.data.users.filter(
        (user) => user.email?.trim().toLowerCase() === syntheticEmail(loginId),
      ).length,
      0,
      "Rejected activation must not leave an orphan Auth user.",
    );

    const created = await service.auth.admin.createUser({
      email: syntheticEmail(loginId),
      password,
      email_confirm: true,
      app_metadata: {
        student_activation: {
          login_id: loginId,
          claim_code_digest: preparedDigest,
        },
      },
    });
    assert.ok(!created.error && created.data.user, "Synthetic Student Auth creation failed.");
  }

  const activated = await service
    .from("people")
    .select("id, auth_user_id, claimed_at, claim_code_digest, role, is_active, class_name")
    .eq("login_id", loginId)
    .single();
  assert.ok(!activated.error, "Activated Student profile could not be read.");
  assert.equal(activated.data.role, "student");
  assert.equal(activated.data.is_active, true);
  assert.equal(activated.data.class_name, className);
  assert.equal(typeof activated.data.auth_user_id, "string");
  assert.equal(typeof activated.data.claimed_at, "string");
  assert.equal(activated.data.claim_code_digest, null);

  const authAfter = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ok(!authAfter.error, "Auth-user count could not be read after activation.");
  assert.equal(
    authAfter.data.users.length,
    authBefore.data.users.length + (wasAlreadyClaimed ? 0 : 1),
  );
  const matchingAuth = authAfter.data.users.filter(
    (user) => user.email?.trim().toLowerCase() === syntheticEmail(loginId),
  );
  assert.equal(matchingAuth.length, 1);
  assert.equal(matchingAuth[0].id, activated.data.auth_user_id);
  assert.equal(matchingAuth[0].app_metadata.student_activation, undefined);

  const student = supabaseClient(required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const signedIn = await student.auth.signInWithPassword({
    email: syntheticEmail(loginId),
    password,
  });
  assert.ok(!signedIn.error, "Synthetic Student login failed.");
  assert.equal(signedIn.data.user.id, activated.data.auth_user_id);

  const ownProfile = await student
    .from("people")
    .select("login_id, full_name, class_name, role")
    .eq("login_id", loginId);
  assert.ok(!ownProfile.error, "Student could not read their own profile.");
  assert.equal(ownProfile.data.length, 1);

  const privacyPrefix = `ZSTP${Date.now().toString(36).toUpperCase()}`;
  const privacyId = `${privacyPrefix}01`;
  const privacyImport = await service.rpc("import_student_roster", {
    p_students: [{
      login_id: privacyId,
      full_name: "Synthetic Integration Student Privacy",
      class_name: "SYN-PRIVACY",
      nis: privacyId,
      nisn: null,
    }],
  });
  assert.ok(!privacyImport.error, "Temporary privacy fixture could not be created.");

  context.after(async () => {
    const cleanup = await service.rpc("cleanup_synthetic_student_import", {
      p_prefix: privacyPrefix,
      p_expected_count: 1,
    });
    assert.ok(!cleanup.error, "Temporary privacy fixture cleanup failed.");
    assert.equal(cleanup.data, 1);
    await student.auth.signOut();
  });

  const otherProfile = await student
    .from("people")
    .select("login_id, full_name, class_name")
    .eq("login_id", privacyId);
  assert.ok(!otherProfile.error, "Cross-Student RLS query failed unexpectedly.");
  assert.deepEqual(otherProfile.data, []);

  if (preparedDigest) {
    const secondCreation = await service.auth.admin.createUser({
      email: syntheticEmail(loginId),
      password,
      email_confirm: true,
      app_metadata: {
        student_activation: {
          login_id: loginId,
          claim_code_digest: preparedDigest,
        },
      },
    });
    assert.ok(secondCreation.error, "A claimed Student must not create a second Auth user.");
  }
  const authAfterSecondAttempt = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ok(!authAfterSecondAttempt.error, "Auth-user count could not be rechecked.");
  assert.equal(authAfterSecondAttempt.data.users.length, authAfter.data.users.length);

  const cookieJar = new Map<string, string>();
  const browserSession = createServerClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => cookieJar.set(name, value)),
      },
    },
  );
  const browserSignIn = await browserSession.auth.signInWithPassword({
    email: syntheticEmail(loginId),
    password,
  });
  assert.ok(!browserSignIn.error, "Student browser session could not be created.");
  const cookieHeader = [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; ");
  const appUrl = required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const studentPage = await fetch(`${appUrl}/student`, { headers: { cookie: cookieHeader } });
  assert.equal(studentPage.status, 200);
  const studentHtml = await studentPage.text();
  assert.ok(studentHtml.includes(loginId));
  assert.ok(studentHtml.includes(fullName));
  assert.ok(studentHtml.includes(className));
  assert.ok(!studentHtml.includes(syntheticEmail(loginId)));
  assert.ok(!studentHtml.includes(activated.data.auth_user_id));
  assert.doesNotMatch(studentHtml, /auth_user_id|claim_code_digest/);

  const adminPage = await fetch(`${appUrl}/admin`, {
    headers: { cookie: cookieHeader },
    redirect: "follow",
  });
  assert.match(adminPage.url, /\/forbidden$/);

  const staffAfter = await service
    .from("people")
    .select("id, auth_user_id, updated_at")
    .in("role", ["admin", "teacher"])
    .order("id");
  assert.ok(!staffAfter.error, "Staff profiles could not be read after activation.");
  assert.deepEqual(staffAfter.data, staffBefore.data);
});
