# Implementation status

This workspace contains a polished, responsive product prototype plus the first
Supabase schema/RLS migration for the PKM attendance system.

## Confirmed implementation choices

- The shared login form determines the destination from the authenticated role.
- `auth.users.id` remains the identity key; school `login_id` values are unique
  identifiers, not database identity keys.
- Student master records may exist before an Auth account is claimed.
- A QR token is tied to either `check_in` or `check_out`, and only one token can
  be active at a time.
- Attendance uniqueness is enforced on student, school-local date, and type.
- Direct client inserts are not allowed by RLS; secure mutations belong in a
  server transaction/RPC or Edge Function.

## Provisional values shown in the prototype

- Timezone: `Asia/Jakarta`
- QR expiry: 5 minutes
- Check-in: 06:00–07:15
- Check-out: 14:00–17:00

They remain marked provisional because the school has not confirmed its policy.

## Not yet production-connected

The deployed interface runs in clearly labelled preview mode with demonstration
data. Real Supabase Auth, student claiming, CSV import, QR token hashing, atomic
attendance RPCs, password administration, and production reporting require a
Supabase project and its environment values. Do not treat the preview login or
the visually rendered QR as a production security implementation.

