# SMAN 2 Cimalaka Attendance Foundation

This branch contains the first conventional Next.js and Supabase foundation for the PKM attendance system. It includes real Supabase Auth integration points, server-side route protection, database-backed roles, the initial PostgreSQL schema, and RLS policies.

It does **not** contain QR generation/scanning, attendance mutations, manual attendance, reports, student activation/Auth creation, or production deployment.

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
DEV_ADMIN_LOGIN_ID=ADMIN
DEV_ADMIN_FULL_NAME=Development Administrator
DEV_ADMIN_PASSWORD=CHOOSE_A_LOCAL_DEVELOPMENT_PASSWORD
DEV_ADMIN_NEW_PASSWORD=CHOOSE_A_DIFFERENT_LOCAL_PASSWORD_FOR_VERIFICATION
DEV_TEACHER_LOGIN_ID=G001
DEV_TEACHER_FULL_NAME=Development Teacher
DEV_TEACHER_PASSWORD=CHOOSE_A_LOCAL_DEVELOPMENT_PASSWORD
DEV_TEACHER_SELF_PASSWORD=CHOOSE_A_DIFFERENT_SELF_CHANGE_PASSWORD
DEV_TEACHER_RESET_PASSWORD=CHOOSE_A_DIFFERENT_ADMIN_RESET_PASSWORD
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` is not used by normal login or password change. The development provisioning command uses it only in a trusted server-side process. Never prefix it with `NEXT_PUBLIC_` and never place it in client code.

The values shown for `DEV_ADMIN_PASSWORD` and `DEV_ADMIN_NEW_PASSWORD` are placeholders. Choose both real development passwords only in the ignored `.env.local`; never commit or paste them into documentation, source code, logs, or chat. `DEV_ADMIN_NEW_PASSWORD` is used only to verify the authenticated password-change flow and can be removed afterward.

All `DEV_TEACHER_*PASSWORD` values are also placeholders. Real Teacher test credentials belong only in `.env.local` and are used for the one-account development integration flow.

## Database migration

The foundation and trusted-provisioning migrations are:

```text
supabase/migrations/20260820000000_foundation.sql
supabase/migrations/20260824000000_service_role_people_provisioning.sql
supabase/migrations/20260824010000_service_role_teacher_status.sql
supabase/migrations/20260825000000_student_import.sql
supabase/migrations/20260825010000_student_import_test_cleanup.sql
```

It creates exactly four application tables:

1. `people`
2. `attendance_daily`
3. `attendance_settings`
4. `qr_tokens`

The foundation migration also creates the approved enums, constraints, indexes, singleton attendance settings row, RLS policies, private role/person lookup helpers, and the narrow `mark_own_password_changed()` function. The provisioning follow-up grants only `SELECT` and `INSERT` on `people` to the trusted `service_role`. The Teacher-status follow-up adds only column-level `UPDATE (is_active)` for that role. The Student-import follow-up permits unclaimed roster rows without activation codes, removes Teacher-wide access to Student identity rows, and adds a service-role-only transactional roster function. A separate test-support migration permits only the service role to remove fresh, unclaimed, attendance-free rows with the integration test's reserved synthetic prefix; it cannot remove ordinary, claimed, or historical Student records. None grants anonymous access or disables RLS.

Apply it separately to a development Supabase project using the Supabase CLI migration workflow or the dashboard SQL editor. Admin provisioning does not apply or modify migrations.

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

Until account-management screens are implemented, provision exactly one development Admin using the trusted local command:

1. Confirm the foundation migration is already applied to the linked development project.
2. Put `DEV_ADMIN_LOGIN_ID`, `DEV_ADMIN_FULL_NAME`, and `DEV_ADMIN_PASSWORD` in `.env.local`.
3. Run:

```powershell
npm run provision:dev-admin
```

The command normalizes the login ID, creates one confirmed synthetic-email Auth identity, and inserts the linked active `admin` row. Re-running it with the same correctly linked account is non-destructive. It refuses conflicting Admin, login-ID, Auth-email, inactive, or inconsistent-link states. If the `people` insert fails after Auth creation, it attempts to remove the newly created Auth identity.

Start the local application with `npm run dev`, open `/login`, and sign in using the visible login ID and password. The synthetic email is never entered or displayed. The development password remains managed only by Supabase Auth.

## Teacher management

An authenticated Admin manages Teacher accounts at `/admin/teachers`. The page supports:

- creating one Auth user and linked `people` row with `role = teacher`
- listing Login ID, full name, active status, and creation date
- activating or deactivating application access through `people.is_active`
- setting a new Teacher password through the server-only Supabase Admin API

The UI never displays the synthetic email, Auth UUID, service-role credential, or any password. Teachers can still change only their own password through `/change-password`; no email recovery flow exists.

## Student roster import

An authenticated Admin manages imported Student records at `/admin/students` and uploads one `.xlsx` workbook at `/admin/students/import`. The workflow inspects arbitrary headers, requires explicit column mapping and NIS/NISN selection, validates and previews without database writes, then reparses the same workbook before one transactional import.

Limits are 5 MB, one worksheet, and 2,000 meaningful Student rows. IDs remain text; plain numeric IDs without explicit zero-padding are rejected. New Students remain unlinked to Supabase Auth with no activation code. Re-import updates only name and class while preserving identity, active status, Auth linkage, activation state, and passwords. Missing Students are reported but never deleted or deactivated automatically.

Excel parsing uses the exactly pinned `exceljs` dependency only from server-reached code. Uploaded files are not permanently stored.

## Commands

```powershell
npm run dev        # local Next.js development server
npm run typecheck  # TypeScript validation
npm run lint       # ESLint
npm test           # local foundation unit/static tests
npm run provision:dev-admin # create/check the single linked development Admin
npm run test:admin-integration # real Admin Auth/link/RLS test; reads ignored .env.local
npm run test:teacher-integration # final-state Teacher Auth/link/RLS test; uses DEV_TEACHER_RESET_PASSWORD
npm run test:student-import-integration # live roster transaction and privacy test; creates no Auth users
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
- development Admin provisioning safeguards and server-only boundaries
- synthetic `.xlsx` parsing, column mapping, leading-zero preservation, and roster-import safeguards

These tests do not prove Supabase Auth or PostgreSQL RLS against a live database. Before calling the system production-ready, apply the migration to a dedicated development Supabase project and run authenticated integration tests with separate admin, teacher, and two student accounts.

Copy `.env.test.example` to a private environment file, provide development-only test accounts, load those variables into the shell, and run `npm run test:integration`. The integration test is automatically skipped when its required variables are absent. It creates and removes one future-dated attendance fixture through the server-only service-role client.

## Current security boundaries

- Protected pages verify the Supabase JWT and load the linked active `people` row.
- Role data is never accepted from the browser.
- Anonymous roles have no table grants or RLS policies.
- Students can read only their own people/attendance rows under RLS.
- Teachers cannot query unrestricted Student identity rows; a narrow attendance directory will be designed with the Attendance milestone.
- Only admins receive the attendance-settings update policy.
- Direct attendance and QR table writes are not granted to authenticated users.
- Activation-code digests and QR token hashes are excluded from normal client column grants.
- The service-role key has no browser import or endpoint in this milestone.
