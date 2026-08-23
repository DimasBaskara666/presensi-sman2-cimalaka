-- Foundation schema for the SMAN 2 Cimalaka attendance application.
-- Apply only to a development Supabase project until RLS integration tests pass.

create schema if not exists private;
revoke all on schema private from public;

create type public.app_role as enum ('admin', 'teacher', 'student');
create type public.attendance_method as enum ('qr', 'manual');
create type public.attendance_status as enum ('on_time', 'late');
create type public.absence_category as enum ('sick', 'permission', 'absent', 'dispensation');
create type public.qr_token_type as enum ('check_in', 'check_out');

create table public.people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete restrict,
  login_id text not null unique,
  full_name text not null,
  role public.app_role not null,
  nis text unique,
  nisn text unique,
  class_name text,
  claim_code_digest text,
  claimed_at timestamptz,
  must_change_password boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_login_id_canonical check (
    login_id = upper(btrim(login_id))
    and login_id ~ '^[A-Z0-9._-]{1,64}$'
  ),
  constraint people_full_name_not_blank check (length(btrim(full_name)) > 0),
  constraint people_nis_not_blank check (nis is null or length(btrim(nis)) > 0),
  constraint people_nisn_not_blank check (nisn is null or length(btrim(nisn)) > 0),
  constraint people_claim_digest_format check (
    claim_code_digest is null or claim_code_digest ~ '^[a-f0-9]{64}$'
  ),
  constraint people_account_state check (
    (
      role = 'student'
      and auth_user_id is null
      and claimed_at is null
      and claim_code_digest is not null
    )
    or
    (
      auth_user_id is not null
      and claimed_at is not null
      and claim_code_digest is null
    )
  )
);

create index people_role_active_idx on public.people (role, is_active);
create index people_class_name_idx on public.people (class_name) where class_name is not null;

create table public.attendance_settings (
  id smallint primary key default 1,
  timezone text not null default 'Asia/Jakarta',
  qr_lifetime_seconds integer not null default 300,
  official_start_time time not null default time '06:30',
  on_time_cutoff time not null default time '06:45',
  late_attendance_allowed boolean not null default true,
  monday_checkout_minimum time not null default time '15:00',
  tuesday_checkout_minimum time not null default time '15:00',
  wednesday_checkout_minimum time not null default time '15:00',
  thursday_checkout_minimum time not null default time '15:00',
  friday_checkout_minimum time not null default time '13:00',
  updated_by uuid references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_settings_singleton check (id = 1),
  constraint attendance_settings_qr_lifetime_positive check (qr_lifetime_seconds > 0),
  constraint attendance_settings_cutoff_order check (official_start_time <= on_time_cutoff)
);

insert into public.attendance_settings (id) values (1);

create table public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  token_type public.qr_token_type not null,
  created_by uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  deactivated_at timestamptz,
  constraint qr_tokens_hash_format check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint qr_tokens_expiry_order check (expires_at > created_at),
  constraint qr_tokens_active_state check (not is_active or deactivated_at is null)
);

create unique index qr_tokens_one_active_idx on public.qr_tokens ((1)) where is_active;
create index qr_tokens_expires_at_idx on public.qr_tokens (expires_at);

create table public.attendance_daily (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.people (id) on delete restrict,
  attendance_date date not null,
  check_in_at timestamptz,
  check_in_status public.attendance_status,
  check_in_method public.attendance_method,
  check_in_recorded_by uuid references public.people (id) on delete restrict,
  check_in_qr_token_id uuid references public.qr_tokens (id) on delete restrict,
  check_out_at timestamptz,
  check_out_method public.attendance_method,
  check_out_recorded_by uuid references public.people (id) on delete restrict,
  check_out_qr_token_id uuid references public.qr_tokens (id) on delete restrict,
  absence_category public.absence_category,
  absence_note text,
  absence_recorded_by uuid references public.people (id) on delete restrict,
  absence_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_daily_student_date_unique unique (student_id, attendance_date),
  constraint attendance_daily_has_status check (check_in_at is not null or absence_category is not null),
  constraint attendance_daily_check_in_complete check (
    (
      check_in_at is null
      and check_in_status is null
      and check_in_method is null
      and check_in_recorded_by is null
      and check_in_qr_token_id is null
    )
    or
    (
      check_in_at is not null
      and check_in_status is not null
      and check_in_method is not null
      and check_in_recorded_by is not null
      and (
        (check_in_method = 'qr' and check_in_qr_token_id is not null)
        or (check_in_method = 'manual' and check_in_qr_token_id is null)
      )
    )
  ),
  constraint attendance_daily_check_out_complete check (
    (
      check_out_at is null
      and check_out_method is null
      and check_out_recorded_by is null
      and check_out_qr_token_id is null
    )
    or
    (
      check_out_at is not null
      and check_in_at is not null
      and check_out_at >= check_in_at
      and check_out_method is not null
      and check_out_recorded_by is not null
      and (
        (check_out_method = 'qr' and check_out_qr_token_id is not null)
        or (check_out_method = 'manual' and check_out_qr_token_id is null)
      )
    )
  ),
  constraint attendance_daily_absence_complete check (
    (
      absence_category is null
      and absence_note is null
      and absence_recorded_by is null
      and absence_recorded_at is null
    )
    or
    (
      absence_category is not null
      and absence_recorded_by is not null
      and absence_recorded_at is not null
      and check_in_at is null
      and check_out_at is null
    )
  )
);

create index attendance_daily_date_idx on public.attendance_daily (attendance_date);
create index attendance_daily_student_date_idx on public.attendance_daily (student_id, attendance_date desc);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger people_set_updated_at
before update on public.people
for each row execute function private.set_updated_at();

create trigger attendance_settings_set_updated_at
before update on public.attendance_settings
for each row execute function private.set_updated_at();

create trigger attendance_daily_set_updated_at
before update on public.attendance_daily
for each row execute function private.set_updated_at();

-- Security-definer helpers avoid recursive RLS lookups on the people table.
-- They expose only the caller's role/person ID and use a fixed empty search path.
create function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.people as p
  where p.auth_user_id = (select auth.uid())
    and p.is_active
  limit 1;
$$;

create function private.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.people as p
  where p.auth_user_id = (select auth.uid())
    and p.is_active
  limit 1;
$$;

revoke all on function private.current_user_role() from public;
revoke all on function private.current_person_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.current_person_id() to authenticated;

create function public.mark_own_password_changed()
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with changed as (
    update public.people
    set must_change_password = false
    where auth_user_id = (select auth.uid())
      and is_active
    returning id
  )
  select exists(select 1 from changed);
$$;

revoke all on function public.mark_own_password_changed() from public;
revoke all on function public.mark_own_password_changed() from anon;
grant execute on function public.mark_own_password_changed() to authenticated;

alter table public.people enable row level security;
alter table public.attendance_settings enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.attendance_daily enable row level security;

revoke all on table public.people from anon, authenticated;
revoke all on table public.attendance_settings from anon, authenticated;
revoke all on table public.qr_tokens from anon, authenticated;
revoke all on table public.attendance_daily from anon, authenticated;

grant select (
  id,
  auth_user_id,
  login_id,
  full_name,
  role,
  nis,
  nisn,
  class_name,
  claimed_at,
  must_change_password,
  is_active,
  created_at,
  updated_at
) on public.people to authenticated;

grant select on public.attendance_settings to authenticated;
grant update (
  timezone,
  qr_lifetime_seconds,
  official_start_time,
  on_time_cutoff,
  late_attendance_allowed,
  monday_checkout_minimum,
  tuesday_checkout_minimum,
  wednesday_checkout_minimum,
  thursday_checkout_minimum,
  friday_checkout_minimum,
  updated_by
) on public.attendance_settings to authenticated;

grant select (
  id,
  token_type,
  created_by,
  created_at,
  expires_at,
  is_active,
  deactivated_at
) on public.qr_tokens to authenticated;

grant select on public.attendance_daily to authenticated;

create policy people_select_by_role
on public.people
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select private.current_user_role()) = 'admin'
  or (
    (select private.current_user_role()) = 'teacher'
    and role = 'student'
  )
);

create policy attendance_settings_select_authenticated
on public.attendance_settings
for select
to authenticated
using ((select auth.uid()) is not null);

create policy attendance_settings_update_admin
on public.attendance_settings
for update
to authenticated
using ((select private.current_user_role()) = 'admin')
with check ((select private.current_user_role()) = 'admin');

create policy qr_tokens_select_staff
on public.qr_tokens
for select
to authenticated
using ((select private.current_user_role()) in ('admin', 'teacher'));

create policy attendance_daily_select_by_role
on public.attendance_daily
for select
to authenticated
using (
  (select private.current_user_role()) in ('admin', 'teacher')
  or student_id = (select private.current_person_id())
);

comment on column public.people.claim_code_digest is
  'Server-only HMAC-SHA256 digest. This column is deliberately not granted to authenticated clients.';

comment on table public.attendance_daily is
  'One row per student per local school date. Writes are reserved for future controlled database functions.';

comment on table public.qr_tokens is
  'Stores only QR token hashes. Raw tokens must never be stored here.';
