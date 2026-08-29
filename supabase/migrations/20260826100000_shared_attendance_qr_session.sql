-- One shared school-wide QR attendance session. Staff display refreshes call
-- get_attendance_qr_session(), but PostgreSQL clock time decides whether the
-- current credential remains valid or must be rotated.

create extension if not exists pgcrypto with schema extensions;

-- Credentials created by the previous Admin-only implementation cannot be
-- recovered for a shared display, so close them during the migration.
update public.qr_tokens
set
  is_active = false,
  deactivated_at = coalesce(deactivated_at, clock_timestamp())
where token_type = 'attendance'
  and is_active;

alter table public.qr_tokens
add column attendance_session_id uuid,
add column display_token text,
add constraint qr_tokens_display_token_format check (
  display_token is null or display_token ~ '^qra_[A-Za-z0-9_-]{43}$'
),
add constraint qr_tokens_active_attendance_session_complete check (
  token_type <> 'attendance'
  or not is_active
  or (
    attendance_session_id is not null
    and display_token is not null
  )
);

-- Five minutes is the fixed school-wide rotation boundary. This field is not
-- browser-writable and remains available to describe the enforced lifetime.
update public.attendance_settings
set qr_lifetime_seconds = 300
where id = 1;

alter table public.attendance_settings
add constraint attendance_settings_qr_lifetime_five_minutes
check (qr_lifetime_seconds = 300);

revoke select (token_hash, attendance_session_id, display_token)
on table public.qr_tokens from anon, authenticated, service_role;

revoke all on function public.rotate_attendance_qr(text)
from public, anon, authenticated, service_role;
revoke all on function public.revoke_active_attendance_qr()
from public, anon, authenticated, service_role;
drop function public.rotate_attendance_qr(text);
drop function public.revoke_active_attendance_qr();

create function private.issue_shared_attendance_qr(
  p_session_id uuid,
  p_actor_id uuid,
  p_issued_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_token_id uuid;
begin
  if p_session_id is null
    or p_actor_id is null
    or p_issued_at is null
    or not exists (
      select 1
      from public.people as p
      where p.id = p_actor_id
        and p.role in ('admin', 'teacher')
        and p.is_active
    ) then
    raise exception 'invalid_attendance_qr_issue';
  end if;

  v_token := 'qra_' || translate(
    rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );

  insert into public.qr_tokens (
    token_hash,
    token_type,
    created_by,
    created_at,
    expires_at,
    is_active,
    attendance_session_id,
    display_token
  ) values (
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    'attendance',
    p_actor_id,
    p_issued_at,
    p_issued_at + interval '5 minutes',
    true,
    p_session_id,
    v_token
  )
  returning id into v_token_id;

  return v_token_id;
end;
$$;

revoke all on function private.issue_shared_attendance_qr(uuid, uuid, timestamptz)
from public, anon, authenticated, service_role;

create function public.start_attendance_qr_session()
returns table (
  session_active boolean,
  session_id uuid,
  token_id uuid,
  token_value text,
  created_at timestamptz,
  expires_at timestamptz,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_actor_id uuid;
  v_current public.qr_tokens%rowtype;
  v_session_id uuid;
  v_token_id uuid;
begin
  if (select private.current_user_role()) is distinct from 'admin'
    and (select private.current_user_role()) is distinct from 'teacher' then
    raise exception 'attendance_staff_required';
  end if;
  v_actor_id := private.current_person_id();

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('shared-school-attendance-qr-session')
  );

  select q.* into v_current
  from public.qr_tokens as q
  where q.token_type = 'attendance'
    and q.is_active
  for update;

  if found
    and v_current.expires_at > v_now
    and v_current.attendance_session_id is not null
    and v_current.display_token is not null then
    return query select
      true,
      v_current.attendance_session_id,
      v_current.id,
      v_current.display_token,
      v_current.created_at,
      v_current.expires_at,
      v_now;
    return;
  end if;

  if found then
    v_session_id := coalesce(v_current.attendance_session_id, gen_random_uuid());
    update public.qr_tokens
    set
      is_active = false,
      deactivated_at = coalesce(deactivated_at, v_now)
    where id = v_current.id;
  else
    v_session_id := gen_random_uuid();
  end if;

  v_token_id := private.issue_shared_attendance_qr(v_session_id, v_actor_id, v_now);
  return query
  select
    true,
    q.attendance_session_id,
    q.id,
    q.display_token,
    q.created_at,
    q.expires_at,
    v_now
  from public.qr_tokens as q
  where q.id = v_token_id;
end;
$$;

create function public.get_attendance_qr_session()
returns table (
  session_active boolean,
  session_id uuid,
  token_id uuid,
  token_value text,
  created_at timestamptz,
  expires_at timestamptz,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_actor_id uuid;
  v_current public.qr_tokens%rowtype;
  v_session_id uuid;
  v_token_id uuid;
begin
  if (select private.current_user_role()) is distinct from 'admin'
    and (select private.current_user_role()) is distinct from 'teacher' then
    raise exception 'attendance_staff_required';
  end if;
  v_actor_id := private.current_person_id();

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('shared-school-attendance-qr-session')
  );

  select q.* into v_current
  from public.qr_tokens as q
  where q.token_type = 'attendance'
    and q.is_active
  for update;

  if not found then
    return query select
      false,
      null::uuid,
      null::uuid,
      null::text,
      null::timestamptz,
      null::timestamptz,
      v_now;
    return;
  end if;

  if v_current.expires_at > v_now
    and v_current.attendance_session_id is not null
    and v_current.display_token is not null then
    return query select
      true,
      v_current.attendance_session_id,
      v_current.id,
      v_current.display_token,
      v_current.created_at,
      v_current.expires_at,
      v_now;
    return;
  end if;

  v_session_id := coalesce(v_current.attendance_session_id, gen_random_uuid());
  update public.qr_tokens
  set
    is_active = false,
    deactivated_at = coalesce(deactivated_at, v_now)
  where id = v_current.id;

  v_token_id := private.issue_shared_attendance_qr(v_session_id, v_actor_id, v_now);
  return query
  select
    true,
    q.attendance_session_id,
    q.id,
    q.display_token,
    q.created_at,
    q.expires_at,
    v_now
  from public.qr_tokens as q
  where q.id = v_token_id;
end;
$$;

create function public.stop_attendance_qr_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_changed integer;
begin
  if (select private.current_user_role()) is distinct from 'admin'
    and (select private.current_user_role()) is distinct from 'teacher' then
    raise exception 'attendance_staff_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('shared-school-attendance-qr-session')
  );
  update public.qr_tokens
  set
    is_active = false,
    deactivated_at = coalesce(deactivated_at, v_now)
  where token_type = 'attendance'
    and is_active;
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

revoke all on function public.start_attendance_qr_session()
from public, anon, service_role;
revoke all on function public.get_attendance_qr_session()
from public, anon, service_role;
revoke all on function public.stop_attendance_qr_session()
from public, anon, service_role;
grant execute on function public.start_attendance_qr_session() to authenticated;
grant execute on function public.get_attendance_qr_session() to authenticated;
grant execute on function public.stop_attendance_qr_session() to authenticated;

-- Keep the existing service-only test helper, but expiry must leave the
-- session active so the next staff refresh exercises database rotation.
create or replace function public.expire_synthetic_attendance_qr(p_token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_token_id is null then raise exception 'invalid_synthetic_qr_expiry_request'; end if;
  update public.qr_tokens as q
  set expires_at = v_now
  where q.id = p_token_id
    and q.token_type = 'attendance'
    and q.is_active
    and q.created_at < v_now
    and exists (
      select 1
      from public.people as p
      where p.id = q.created_by
        and p.role in ('admin', 'teacher')
    );
  if not found then raise exception 'synthetic_qr_expiry_target_not_found'; end if;
  return true;
end;
$$;

revoke all on function public.expire_synthetic_attendance_qr(uuid)
from public, anon, authenticated;
grant execute on function public.expire_synthetic_attendance_qr(uuid)
to service_role;

-- Shared-session tests may issue credentials as either staff role. The helper
-- remains constrained to the reserved synthetic Student and explicit IDs.
create or replace function public.cleanup_synthetic_student_qr(
  p_student_login_id text,
  p_attendance_date date,
  p_token_ids uuid[],
  p_expected_attendance_count integer,
  p_expected_token_count integer
)
returns table (attendance_deleted integer, tokens_deleted integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_attendance_candidates integer;
  v_token_candidates integer;
  v_attendance_deleted integer;
  v_tokens_deleted integer;
begin
  if p_student_login_id is null
    or p_attendance_date is null
    or p_token_ids is null
    or cardinality(p_token_ids) < 1
    or cardinality(p_token_ids) > 20
    or array_position(p_token_ids, null) is not null
    or p_expected_attendance_count is null
    or p_expected_attendance_count not between 0 and 1
    or p_expected_token_count is null
    or p_expected_token_count <> cardinality(p_token_ids) then
    raise exception 'invalid_synthetic_qr_cleanup_request';
  end if;

  select p.id into v_student_id
  from public.people as p
  where p.login_id = p_student_login_id
    and p.role = 'student'
    and p.auth_user_id is not null
    and p.full_name like 'Synthetic Development Student%';
  if v_student_id is null then raise exception 'synthetic_qr_student_not_found'; end if;

  select count(*)::integer into v_attendance_candidates
  from public.attendance_daily as a
  where a.student_id = v_student_id
    and a.attendance_date = p_attendance_date
    and (a.check_in_method = 'qr' or a.check_out_method = 'qr')
    and (a.check_in_qr_token_id = any(p_token_ids) or a.check_out_qr_token_id = any(p_token_ids));

  select count(*)::integer into v_token_candidates
  from public.qr_tokens as q
  where q.id = any(p_token_ids)
    and q.token_type = 'attendance'
    and exists (
      select 1
      from public.people as p
      where p.id = q.created_by
        and p.role in ('admin', 'teacher')
    );

  if v_attendance_candidates <> p_expected_attendance_count
    or v_token_candidates <> p_expected_token_count then
    raise exception 'synthetic_qr_cleanup_count_mismatch';
  end if;

  delete from public.attendance_corrections
  where attendance_id in (
    select a.id from public.attendance_daily as a
    where a.student_id = v_student_id and a.attendance_date = p_attendance_date
  );

  delete from public.attendance_daily as a
  where a.student_id = v_student_id
    and a.attendance_date = p_attendance_date
    and (a.check_in_method = 'qr' or a.check_out_method = 'qr')
    and (a.check_in_qr_token_id = any(p_token_ids) or a.check_out_qr_token_id = any(p_token_ids));
  get diagnostics v_attendance_deleted = row_count;

  delete from public.qr_tokens as q
  where q.id = any(p_token_ids) and q.token_type = 'attendance';
  get diagnostics v_tokens_deleted = row_count;

  if v_attendance_deleted <> p_expected_attendance_count
    or v_tokens_deleted <> p_expected_token_count then
    raise exception 'synthetic_qr_cleanup_delete_mismatch';
  end if;
  return query select v_attendance_deleted, v_tokens_deleted;
end;
$$;

revoke all on function public.cleanup_synthetic_student_qr(
  text, date, uuid[], integer, integer
) from public, anon, authenticated;
grant execute on function public.cleanup_synthetic_student_qr(
  text, date, uuid[], integer, integer
) to service_role;

comment on function public.start_attendance_qr_session() is
  'Starts or returns the one shared school-wide QR attendance session for authenticated staff.';
comment on function public.get_attendance_qr_session() is
  'Returns the shared QR and rotates it after the database-authoritative five-minute boundary.';
comment on function public.stop_attendance_qr_session() is
  'Stops the shared school-wide QR session so no attendance QR remains valid.';
comment on column public.qr_tokens.display_token is
  'Short-lived shared display credential; excluded from all direct browser and service-role table grants.';
