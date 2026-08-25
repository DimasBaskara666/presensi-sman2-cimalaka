-- Trusted Student QR boundary. Raw QR secrets never enter PostgreSQL: the
-- server hashes them before calling these functions.

create function public.rotate_attendance_qr(p_token_hash text)
returns table (
  id uuid,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_now timestamptz := clock_timestamp();
  v_lifetime_seconds integer;
  v_token_id uuid;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'attendance_admin_required';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'qr_token_hash_invalid';
  end if;

  v_actor_id := private.current_person_id();
  select s.qr_lifetime_seconds into strict v_lifetime_seconds
  from public.attendance_settings as s
  where s.id = 1;

  -- Serializes rotation independently of the partial unique index so two
  -- simultaneous Admin clicks cannot race between deactivate and insert.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('student-attendance-active-qr')
  );

  update public.qr_tokens
  set is_active = false,
      deactivated_at = coalesce(deactivated_at, v_now)
  where is_active;

  insert into public.qr_tokens (
    token_hash,
    token_type,
    created_by,
    created_at,
    expires_at,
    is_active
  ) values (
    p_token_hash,
    'attendance',
    v_actor_id,
    v_now,
    v_now + (v_lifetime_seconds * interval '1 second'),
    true
  )
  returning qr_tokens.id into v_token_id;

  return query
  select q.id, q.created_at, q.expires_at
  from public.qr_tokens as q
  where q.id = v_token_id;
end;
$$;

revoke all on function public.rotate_attendance_qr(text)
from public, anon, service_role;
grant execute on function public.rotate_attendance_qr(text)
to authenticated;

create function public.revoke_active_attendance_qr()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'attendance_admin_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('student-attendance-active-qr')
  );
  update public.qr_tokens
  set is_active = false,
      deactivated_at = coalesce(deactivated_at, clock_timestamp())
  where is_active;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function public.revoke_active_attendance_qr()
from public, anon, service_role;
grant execute on function public.revoke_active_attendance_qr()
to authenticated;

create function public.submit_student_qr_attendance(p_token_hash text)
returns table (
  action text,
  attendance_id uuid,
  occurred_at timestamptz,
  status public.attendance_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_student_id uuid;
  v_timezone text;
  v_attendance_date date;
  v_token public.qr_tokens%rowtype;
  v_existing public.attendance_daily%rowtype;
  v_attendance_id uuid;
begin
  if (select private.current_user_role()) is distinct from 'student' then
    raise exception 'attendance_student_required';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'qr_invalid';
  end if;

  v_student_id := private.current_person_id();
  if not exists (
    select 1
    from public.people as p
    where p.id = v_student_id
      and p.role = 'student'
      and p.is_active
      and p.auth_user_id = (select auth.uid())
  ) then
    raise exception 'attendance_account_inactive';
  end if;

  select q.* into v_token
  from public.qr_tokens as q
  where q.token_hash = p_token_hash
    and q.token_type = 'attendance'
  for share;

  if not found then raise exception 'qr_invalid'; end if;
  -- Expiry is checked before revocation so an expired-and-deactivated test
  -- token still reports the most useful safe reason.
  if v_token.expires_at <= v_now then raise exception 'qr_expired'; end if;
  if not v_token.is_active then raise exception 'qr_revoked'; end if;

  select s.timezone into strict v_timezone
  from public.attendance_settings as s
  where s.id = 1;
  v_attendance_date := (v_now at time zone v_timezone)::date;

  select a.* into v_existing
  from public.attendance_daily as a
  where a.student_id = v_student_id
    and a.attendance_date = v_attendance_date
  for update;

  if not found or v_existing.check_in_at is null then
    -- This deliberately reuses Attendance Core's existing absence-to-presence
    -- transition; no QR-specific transition is introduced here.
    v_attendance_id := private.apply_attendance_check_in(
      v_student_id,
      v_now,
      'qr',
      v_student_id,
      v_token.id
    );
    return query
    select 'check_in'::text, a.id, a.check_in_at, a.check_in_status
    from public.attendance_daily as a
    where a.id = v_attendance_id;
    return;
  end if;

  if v_existing.check_out_at is null then
    v_attendance_id := private.apply_attendance_check_out(
      v_student_id,
      v_now,
      'qr',
      v_student_id,
      v_token.id
    );
    return query
    select 'check_out'::text, a.id, a.check_out_at, a.check_in_status
    from public.attendance_daily as a
    where a.id = v_attendance_id;
    return;
  end if;

  return query
  select 'completed'::text, v_existing.id, v_existing.check_out_at, v_existing.check_in_status;
end;
$$;

revoke all on function public.submit_student_qr_attendance(text)
from public, anon, service_role;
grant execute on function public.submit_student_qr_attendance(text)
to authenticated;

-- Narrow service-role helpers exist only to make the dedicated live test
-- deterministic and recoverable without restoring broad table privileges.
create function public.expire_synthetic_attendance_qr(p_token_id uuid)
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
  set expires_at = v_now,
      is_active = false,
      deactivated_at = coalesce(q.deactivated_at, v_now)
  where q.id = p_token_id
    and q.token_type = 'attendance'
    and q.created_at < v_now
    and exists (
      select 1 from public.people as p
      where p.id = q.created_by and p.role = 'admin'
    );
  if not found then raise exception 'synthetic_qr_expiry_target_not_found'; end if;
  return true;
end;
$$;

revoke all on function public.expire_synthetic_attendance_qr(uuid)
from public, anon, authenticated;
grant execute on function public.expire_synthetic_attendance_qr(uuid)
to service_role;

create function public.cleanup_synthetic_student_qr(
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
      select 1 from public.people as p
      where p.id = q.created_by and p.role = 'admin'
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

revoke insert, update, delete on table public.qr_tokens from anon, authenticated;
revoke all on table public.qr_tokens from service_role;

comment on function public.rotate_attendance_qr(text) is
  'Admin-only active QR rotation. Accepts only a server-created SHA-256 digest.';
comment on function public.submit_student_qr_attendance(text) is
  'Student-only atomic QR validation and Attendance Core check-in/check-out boundary.';
