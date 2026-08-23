# SMAN 2 Cimalaka Attendance Foundation

This branch contains the first conventional Next.js and Supabase foundation for the PKM attendance system. It includes real Supabase Auth integration points, server-side route protection, database-backed roles, the initial PostgreSQL schema, and RLS policies.

It does **not** contain QR generation/scanning, attendance mutations, Excel import, manual attendance, reports, student registration UI, or production deployment.

The original Vinext prototype is preserved locally at:

- tag: `prototype-pre-next-foundation`
- branch: `codex/prototype-pre-next-foundation`

## Architecture

- Next.js App Router, React, and TypeScript
- Plain CSS
- Supabase Auth for passwords and sessions
- Supabase PostgreSQL for application data
- PostgreSQL RLS for final data authorization
- No ORM, D1, Cloudflare Worker, Vite, or OpenAI platform authentication

## Local setup

Requirements:

- Node.js 22.13 or newer
- npm
- A development Supabase project when testing real login and RLS

Install and configure:

```powershell
npm install
Copy-Item .env.example .env.local
```

Fill `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
AUTH_EMAIL_DOMAIN=auth.your-controlled-domain.example
ACTIVATION_CODE_PEPPER=GENERATE_A_LONG_RANDOM_SERVER_SECRET
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` is not used by normal login or password change. It is reserved for later server-only account provisioning. Never prefix it with `NEXT_PUBLIC_` and never place it in client code.

## Database migration

The initial migration is:

```text
supabase/migrations/20260820000000_foundation.sql
```

It creates exactly four application tables:

1. `people`
2. `attendance_daily`
3. `attendance_settings`
4. `qr_tokens`

It also creates the approved enums, constraints, indexes, singleton attendance settings row, RLS policies, private role/person lookup helpers, and the narrow `mark_own_password_changed()` function.

Apply it to a development Supabase project using the Supabase CLI migration workflow or the dashboard SQL editor. This repository does not automatically apply it and has not applied it to a real project yet.

Before real testing, disable public email sign-up in the Supabase Auth settings. Accounts for this application are created only through controlled administrator/student-claim workflows.

## Synthetic Auth email mapping

Users only see `ID / Username` and `Password`.

The server applies this exact mapping:

1. Trim the visible ID.
2. Convert it to uppercase.
3. Require 1–64 characters from `A-Z`, `0-9`, `.`, `_`, or `-`.
4. Convert the normalized ID to lowercase for the email local part.
5. Append the configured `AUTH_EMAIL_DOMAIN`.

Example:

```text
Visible ID:        G001
Normalized ID:     G001
Internal email:    g001@auth.your-controlled-domain.example
```

The synthetic email is never displayed in the UI and is not used as an authorization role. After Supabase authenticates the password, the application loads the linked `people` row using the Auth user UUID. The database `role` is the only source for application authorization.

Passwords and password hashes are never stored in application tables.

## Initial administrator

Until account-management screens are implemented, provision the first development admin manually:

1. Create a Supabase Auth user in the dashboard using the synthetic email for the chosen admin login ID.
2. Set a temporary password and mark the email confirmed.
3. Copy the new Auth user UUID.
4. Insert the linked application row through the SQL editor:

```sql
insert into public.people (
  auth_user_id,
  login_id,
  full_name,
  role,
  claimed_at,
  must_change_password
) values (
  'AUTH-USER-UUID',
  'ADMIN',
  'Administrator',
  'admin',
  now(),
  true
);
```

The login ID and internal email must use the same normalization/domain configured by the application.

## Commands

```powershell
npm run dev        # local Next.js development server
npm run typecheck  # TypeScript validation
npm run lint       # ESLint
npm test           # local foundation unit/static tests
npm run test:integration # real Auth/RLS tests; requires .env.test values loaded
npm run build      # production Next.js build
npm run check      # run all checks above
```

## Test boundary

The local test suite verifies:

- deterministic ID-to-email mapping
- valid and invalid login orchestration with test doubles
- rejection of unlinked Auth users
- application role decisions
- cross-student access denial logic
- activation-code digest and claim eligibility rules
- required migration tables, RLS enablement, and critical constraints

These tests do not prove Supabase Auth or PostgreSQL RLS against a live database. Before calling the system production-ready, apply the migration to a dedicated development Supabase project and run authenticated integration tests with separate admin, teacher, and two student accounts.

Copy `.env.test.example` to a private environment file, provide development-only test accounts, load those variables into the shell, and run `npm run test:integration`. The integration test is automatically skipped when its required variables are absent. It creates and removes one future-dated attendance fixture through the server-only service-role client.

## Current security boundaries

- Protected pages verify the Supabase JWT and load the linked active `people` row.
- Role data is never accepted from the browser.
- Anonymous roles have no table grants or RLS policies.
- Students can read only their own people/attendance rows under RLS.
- Teachers can read operational student and attendance rows but cannot update settings.
- Only admins receive the attendance-settings update policy.
- Direct attendance and QR table writes are not granted to authenticated users.
- Activation-code digests and QR token hashes are excluded from normal client column grants.
- The service-role key has no browser import or endpoint in this milestone.
