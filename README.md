# SMAN 2 Cimalaka Attendance System

A Next.js and Supabase attendance application for Admin, Teacher, and Student users. The current implementation includes account administration, Student roster import and activation, database-controlled attendance, manual Teacher attendance, Student QR attendance, history, PDF export, configurable attendance times, and audited Admin corrections.

This repository contains the application and Supabase migrations. It does not claim a production deployment or define infrastructure outside the configuration described below.

## Architecture

- Next.js App Router, React, and TypeScript
- Supabase Auth for passwords and sessions
- Supabase PostgreSQL for application data and attendance transactions
- PostgreSQL RLS, grants, constraints, and security-definer functions for authorization and mutation boundaries
- Plain CSS for the interface
- ExcelJS for server-side `.xlsx` roster parsing
- `qrcode` for Admin-generated attendance QR images
- PDFKit for server-generated attendance reports

The application does not use Vinext, Vite, Drizzle, D1, or Cloudflare Workers. Passwords are stored only by Supabase Auth, never in application tables.

## Implemented capabilities

### Authentication and account management

- Users sign in with `login_id + password`; a deterministic synthetic email is generated only on the server for Supabase Auth.
- Each Auth identity is linked to one `people` row through `auth_user_id`; the database role is authoritative.
- Inactive or unlinked accounts cannot enter protected application routes.
- Authenticated users can change their own password. There is no email recovery or forgot-password flow.
- A development Admin can be provisioned through `npm run provision:dev-admin`.
- Admin can create, list, deactivate/reactivate, and reset passwords for Teacher accounts. Each Teacher is a separate Supabase Auth identity; the current code does not synchronize one global password across all Teachers.
- Admin can import Student roster data, prepare activation codes, deactivate/reactivate Students, and reset an activated Student's password.
- Student activation is allowed only for an existing active, unclaimed Student row with a valid unexpired code. Activation creates and links the Supabase Auth user.

### Student roster import

- Admin uploads one `.xlsx` worksheet and explicitly maps ID, name, and class columns.
- NIS or NISN is retained as text so verified leading zeroes are preserved.
- The server validates and previews the workbook, then reparses it before a transactional import.
- Maximum upload size is 5 MB with at most 2,000 meaningful Student rows.
- Re-import updates roster fields without replacing Auth linkage, activation state, active status, passwords, or attendance history.
- Missing workbook rows are not automatically deleted or deactivated.

### Attendance

The Attendance Core stores at most one record per Student and school date. Each record preserves Student ID, name, and class snapshots so historical reports are not changed by later roster edits. A missing record means unmarked, not automatically absent.

Configured school rules are:

- Timezone: `Asia/Jakarta`
- Check-in before `06:30:00`: rejected
- `06:30:00` through `06:45:00`, inclusive: on time
- After `06:45:00`: late, while late attendance remains enabled
- Monday-Thursday checkout: `15:00:00` or later
- Friday checkout: `13:00:00` or later
- Saturday and Sunday: normal attendance rejected
- Absence categories: Sick, Permission, Absent, and Dispensation
- Presence and absence are mutually exclusive

Operational check-in/out timestamps and attendance dates come from PostgreSQL in the school timezone. Browser-supplied dates or clocks are not authoritative.

Implemented workflows:

- Teacher `/teacher`: select a class and record today's present/absence state or checkout using controlled PostgreSQL functions.
- Admin `/admin/attendance-qr`: create/rotate or revoke the single active attendance QR. The default QR lifetime is 300 seconds from `attendance_settings`.
- Student `/student/scan`: submit a current QR for their own check-in or checkout. PostgreSQL validates role, active account, token hash, expiry, schedule, and current attendance state.
- Attendance history `/attendance/history`: Admin and Teacher can view permitted attendance across Students; a Student sees only their own records. Filters support a maximum 31-day range.
- PDF export `/attendance/history/pdf`: generates the filtered report server-side, with a maximum of 5,000 rows.
- Admin `/admin/attendance-settings`: edit entry time, late tolerance, Monday-Thursday checkout minimum, and Friday checkout minimum through `update_attendance_schedule`.
- Admin `/admin/attendance-corrections`: find an existing record by date, class, and Student, then correct presence or absence through `correct_attendance`. A reason is mandatory and PostgreSQL stores immutable before/after audit data in `attendance_corrections`; there is no separate audit-browser page.

## Role and authorization boundaries

| Role | Current access |
| --- | --- |
| Anonymous | Login and Student activation forms only; no direct application-table access |
| Admin | Account management, Student import/activation, QR management, attendance settings, historical correction, database-authorized audit access, all attendance history, and PDF export |
| Teacher | Today's manual attendance and checkout, attendance history, and PDF export; no Admin routes or Admin RPCs |
| Student | Own dashboard, QR check-in/out, own history, own PDF scope, and authenticated password change |

Protected pages load the active `people` row linked to the Supabase session. Server actions verify the role again and never trust a browser-provided role. Authenticated browser clients cannot directly insert, update, or delete attendance, QR, settings, or correction-audit rows; mutations use the approved PostgreSQL functions. The Supabase service-role key is used only in trusted server-side account, import, activation, and test-support operations.

## Development setup

Requirements:

- Node.js 22.13 or newer
- npm
- A development Supabase project with the repository migrations applied in filename order

Install and configure:

```powershell
npm install
Copy-Item .env.example .env.local
```

Required application values in the ignored `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_EMAIL_DOMAIN=auth.your-school.example
ACTIVATION_CODE_PEPPER=
ACTIVATION_CODE_TTL_HOURS=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_EMAIL_DOMAIN`, and `ACTIVATION_CODE_PEPPER` are server-only. Never prefix them with `NEXT_PUBLIC_`, expose them in Client Components, or commit real values. `NEXT_PUBLIC_APP_URL` must be the public HTTP(S) origin used to construct QR scan URLs.

Development Admin provisioning additionally requires:

```dotenv
DEV_ADMIN_LOGIN_ID=ADMIN
DEV_ADMIN_FULL_NAME=Development Administrator
DEV_ADMIN_PASSWORD=
```

The remaining `DEV_ADMIN_*`, `DEV_TEACHER_*`, and `DEV_STUDENT_*` values in `.env.example` are development integration-test fixtures. Use only synthetic accounts in a dedicated development Supabase project. For controlled account creation, public email sign-up should remain disabled in Supabase Auth.

Apply all migrations under `supabase/migrations/` to the development project before provisioning accounts. Then run:

```powershell
npm run provision:dev-admin
npm run dev
```

Open `http://localhost:3000/login` and sign in with the visible development Admin login ID and password. Synthetic email addresses are internal and are not entered by users.

## Migrations

Current migrations, in order:

```text
20260820000000_foundation.sql
20260824000000_service_role_people_provisioning.sql
20260824010000_service_role_teacher_status.sql
20260825000000_student_import.sql
20260825010000_student_import_test_cleanup.sql
20260825100000_student_activation.sql
20260825110000_student_activation_auth_metadata_update.sql
20260825200000_attendance_core.sql
20260825210000_teacher_attendance_roster.sql
20260825220000_qr_token_attendance_type.sql
20260825221000_student_qr_attendance.sql
```

Test-cleanup functions are restricted to reserved synthetic fixtures and do not grant broad service-role access to attendance tables.

## Commands

```powershell
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run check
npm run provision:dev-admin
```

Dedicated live tests are exposed as `test:*integration` scripts in `package.json`, including account, import, activation, Student administration, Attendance Core, Teacher attendance, Student QR, reporting, and Admin attendance operations. They require the matching private development fixture variables and may start from or temporarily create synthetic data. Use a dedicated development Supabase project, not production data.

## Current deployment boundary

The repository is configured for local Next.js operation and connection to a Supabase project. Hosting provider settings, production domains, production credentials, backup policy, monitoring, and school deployment procedures are not defined here and must be confirmed separately before production use.
