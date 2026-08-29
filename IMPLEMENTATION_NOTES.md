# Current implementation notes

## Runtime and data model

- Runtime: conventional Next.js App Router with React and TypeScript.
- Authentication: Supabase Auth password sessions through `@supabase/ssr`.
- Application data: Supabase PostgreSQL; no ORM is used.
- Authorization: server route guards plus PostgreSQL RLS, grants, and role-checked security-definer functions.
- Primary application tables: `people`, `attendance_daily`, `attendance_settings`, `qr_tokens`, and `attendance_corrections`.
- `people.auth_user_id` links an Auth identity to its application role and profile. Passwords are not stored in `people`.
- Visible login IDs are mapped deterministically to synthetic Auth emails on the server. Synthetic emails and service credentials are not exposed in the UI.

## Authentication and administration

- `/login` authenticates Admin, Teacher, and activated Student accounts by login ID and password.
- `/change-password` performs an authenticated password change through Supabase Auth. Only Admin `must_change_password` state forces a change; it does not force Teacher or Student password creation.
- `/admin/teachers` lets Admin create linked Teacher accounts, change `people.is_active`, and reset passwords through the server-only Supabase Admin API. Teachers have separate Auth identities; no function synchronizes a global password across all Teacher accounts.
- `/admin/students/import` validates, previews, and transactionally imports `.xlsx` roster data without creating Auth users.
- `/admin/students/[loginId]/activation` prepares a random expiring activation code. PostgreSQL stores only the HMAC digest.
- `/activate` creates and atomically links a Student Auth user only when the existing Student row is active, unclaimed, and has a valid code.
- `/admin/students` lets Admin deactivate/reactivate a Student by changing only `people.is_active`, and reset an activated Student password without replacing the Auth UUID or attendance history.
- No email recovery or unauthenticated forgot-password flow is implemented.

## Attendance Core

`attendance_daily` enforces one Student plus one school date per row and stores identity snapshots for historical stability. A row represents either presence or one absence category; these states cannot coexist. No row means unmarked.

PostgreSQL owns the operational school date, timestamps, duplicate handling, and schedule validation. The current settings use `Asia/Jakarta`:

- check-in before 06:30:00 is rejected;
- 06:30:00 through 06:45:00 inclusive is `on_time`;
- after 06:45:00 is `late` while late attendance is enabled;
- Monday-Thursday checkout requires 15:00:00 or later;
- Friday checkout requires 13:00:00 or later;
- weekends reject normal attendance;
- absence categories are `sick`, `permission`, `absent`, and `dispensation`.

The controlled mutation functions are:

- `record_manual_check_in(student_id)`
- `record_manual_absence(student_id, category, note)`
- `record_manual_check_out(student_id)`
- `submit_student_qr_attendance(token_hash)`
- `start_attendance_qr_session()`
- `get_attendance_qr_session()`
- `stop_attendance_qr_session()`
- `update_attendance_schedule(...)`
- `correct_attendance(...)`

Direct browser writes to attendance, settings, QR, and correction tables are revoked.

## Attendance workflows

- `/teacher` is Teacher-only and loads active Students through the narrow roster function. Teachers can operate only on today's attendance; they choose present or an absence category and can record checkout. They cannot submit a date or attendance time.
- `/admin/attendance-qr` and `/teacher/attendance-qr` control one school-wide session. Admin or Teacher can start and stop it. Staff refresh calls return the same current credential; PostgreSQL uses its clock and an advisory lock to rotate after exactly five minutes, immediately invalidating the previous QR. The short-lived display credential is excluded from direct table grants and is returned only by the role-checked staff function.
- `/student/scan` is Student-only. The Student submits the raw opaque token to a server action, which hashes it before calling PostgreSQL. The database validates the linked active Student, token type/state/expiry, server time, and existing daily row. The same QR transaction chooses check-in, checkout, or already-completed behavior.
- `/attendance/history` is available to all authenticated roles. Admin and Teacher can query permitted Student attendance; Student queries are forced to the current Student ID. Results use stored identity snapshots and a maximum 31-day filter range.
- `/attendance/history/pdf` applies the same role and filter scope and renders a server-side PDF. Reports above 5,000 rows are rejected.
- `/admin/attendance-settings` is Admin-only and calls `update_attendance_schedule`; the browser never updates `attendance_settings` directly.
- `/admin/attendance-corrections` is Admin-only. It searches existing rows by date/class/Student, re-reads Student identity and date server-side, and calls `correct_attendance`. The UI cannot change Student identity or snapshot fields. Every correction requires a reason and inserts before/after JSON into `attendance_corrections`. Admin is authorized to read the audit table, but there is no separate audit-browser page.

## Authorization summary

| Operation | Admin | Teacher | Student | Anonymous |
| --- | --- | --- | --- | --- |
| Account/roster administration | Yes | No | No | No |
| Teacher manual attendance | RPC permitted; no current Admin UI | Yes, today only | No | No |
| Shared QR session start/stop/display | Yes | Yes | No | No |
| QR check-in/out | No | No | Own account only | No |
| Attendance history/PDF | All permitted rows | All permitted rows | Own rows only | No |
| Attendance settings | Yes | No | No | No |
| Historical correction/audit read | Yes | No | No | No |

All protected routes load the active `people` record linked to the authenticated Auth UUID. Role values supplied by the client are ignored. Deactivating an account preserves its Auth linkage and historical records but prevents application login and protected-route access.

## Configuration

Application runtime variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only
- `AUTH_EMAIL_DOMAIN` — server-only synthetic-email domain
- `ACTIVATION_CODE_PEPPER` — server-only HMAC secret
- `ACTIVATION_CODE_TTL_HOURS` — required activation-code lifetime
- `NEXT_PUBLIC_APP_URL` — HTTP(S) application origin used for QR URLs

Development Admin provisioning variables:

- `DEV_ADMIN_LOGIN_ID`
- `DEV_ADMIN_FULL_NAME`
- `DEV_ADMIN_PASSWORD`

Additional `DEV_ADMIN_*`, `DEV_TEACHER_*`, and `DEV_STUDENT_*` variables in `.env.example` support dedicated integration tests. Real secrets belong only in ignored local environment files. Integration tests that exercise routes require the local application at `NEXT_PUBLIC_APP_URL`.

## Verification boundary

`npm run check` runs TypeScript, ESLint, the offline test suite, and a production build. Dedicated live integration scripts verify real development Auth, PostgreSQL functions, RLS, routing, cleanup, and restoration for each implemented milestone.

These checks demonstrate the implemented development configuration; they do not establish production hosting, operational monitoring, backups, or school deployment approval. No production infrastructure assumptions are made in this repository.
