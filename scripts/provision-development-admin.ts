import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const {
  DevelopmentAdminProvisioningError,
  provisionDevelopmentAdmin,
} = await import("../lib/auth/provision-development-admin");

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
}

function safeFailureReason(error: unknown): string {
  if (error instanceof DevelopmentAdminProvisioningError) return error.code;
  if (!(error instanceof Error)) return "unexpected_runtime_error";
  if (error.name === "InvalidLoginIdError") return "invalid_login_id";
  if (error.message.startsWith("Missing required environment variable:")) {
    return "missing_development_admin_configuration";
  }
  if (error.message.includes("AUTH_EMAIL_DOMAIN")) return "invalid_auth_email_domain";
  if (error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) return "missing_service_role_key";
  if (error.message.includes("Supabase public environment variables")) {
    return "missing_supabase_public_configuration";
  }
  return "unexpected_runtime_error";
}

try {
  const result = await provisionDevelopmentAdmin({
    loginId: requiredEnvironment("DEV_ADMIN_LOGIN_ID"),
    fullName: requiredEnvironment("DEV_ADMIN_FULL_NAME"),
    password: requiredEnvironment("DEV_ADMIN_PASSWORD"),
  });

  const verb = result.status === "created" ? "created" : "already exists";
  console.log(`Development Admin ${verb} for login ID ${result.loginId}.`);
} catch (error) {
  const reason = safeFailureReason(error);
  console.error(`Development Admin provisioning stopped: ${reason}.`);
  process.exitCode = 1;
}
