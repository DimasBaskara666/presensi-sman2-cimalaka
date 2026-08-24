-- Attendance Core database and transaction layer.
-- Live attendance timestamps are captured in PostgreSQL. Browser roles retain
-- no direct INSERT, UPDATE, or DELETE privileges on attendance tables.

alter table public.attendance_daily
add column student_login_id_snapshot text,
add column student_full_name_snapshot text,
add column student_class_name_snapshot text;

update public.attendance_daily as a
set
  student_login_id_snapshot = p.login_id,
  student_full_name_snapshot = p.full_name,
  student_class_name_snapshot = p.class_name
from public.people as p
where p.id = a.student_id;

do $$
begin
  if exists (
    select 1
    from public.attendance_daily
    where student_login_id_snapshot is null
      or student_full_name_snapshot is null
      or student_class_name_snapshot is null
  ) then
    raise exception 'attendance_snapshot_backfill_failed';
  end if;
end;
$$;

alter table public.attendance_daily
alter column student_login_id_snapshot set not null,
alter column student_full_name_snapshot set not null,
alter column student_class_name_snapshot set not null,
add constraint attendance_daily_snapshot_not_blank check (
  length(btrim(student_login_id_snapshot)) > 0
  and length(btrim(student_full_name_snapshot)) > 0
  and length(btrim(student_class_name_snapshot)) > 0
),
add constraint attendance_daily_absence_note_valid check (
  absence_note is null
  or (length(btrim(absence_note)) > 0 and length(absence_note) <= 500)
);

create function private.set_attendance_student_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.login_id, p.full_name, p.class_name
  into
    new.student_login_id_snapshot,
    new.student_full_name_snapshot,
    new.student_class_name_snapshot
  from public.people as p
  where p.id = new.student_id
    and p.role = 'student';

  if new.student_login_id_snapshot is null
    or new.student_full_name_snapshot is null
    or new.student_class_name_snapshot is null then
    raise exception 'attendance_student_not_found';
  end if;
  return new;
end;
$$;

revoke all on function private.set_attendance_student_snapshot() from public;

create trigger attendance_daily_set_student_snapshot
before insert on public.attendance_daily
for each row execute function private.set_attendance_student_snapshot();

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance_daily (id) on delete restrict,
  corrected_by uuid not null references public.people (id) on delete restrict,
  corrected_at timestamptz not null default clock_timestamp(),
  reason text not null,
  before_data jsonb not null,
  after_data jsonb not null,
  constraint attendance_corrections_reason_valid check (
    length(btrim(reason)) > 0 and length(reason) <= 500
  ),
  constraint attendance_corrections_before_object check (jsonb_typeof(before_data) = 'object'),
  constraint attendance_corrections_after_object check (jsonb_typeof(after_data) = 'object')
);

create index attendance_corrections_attendance_idx
on public.attendance_corrections (attendance_id, corrected_at desc);

alter table public.attendance_corrections enable row level security;
revoke all on table public.attendance_corrections from anon, authenticated;
grant select on table public.attendance_corrections to authenticated;

create policy attendance_corrections_select_admin
on public.attendance_corrections
for select
to authenticated
using ((select private.current_user_role()) = 'admin');

alter table public.attendance_settings
add constraint attendance_settings_timezone_not_blank check (length(btrim(timezone)) > 0),
add constraint attendance_settings_checkout_after_cutoff check (
  monday_checkout_minimum > on_time_cutoff
  and tuesday_checkout_minimum > on_time_cutoff
  and wednesday_checkout_minimum > on_time_cutoff
  and thursday_checkout_minimum > on_time_cutoff
  and friday_checkout_minimum > on_time_cutoff
);

drop policy attendance_settings_update_admin on public.attendance_settings;
revoke update on table public.attendance_settings from authenticated;
revoke update (
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
) on table public.attendance_settings from authenticated;

create function public.update_attendance_schedule(
  p_timezone text,
  p_official_start_time time,
  p_on_time_cutoff time,
  p_late_attendance_allowed boolean,
  p_monday_checkout_minimum time,
  p_tuesday_checkout_minimum time,
  p_wednesday_checkout_minimum time,
  p_thursday_checkout_minimum time,
  p_friday_checkout_minimum time
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'attendance_admin_required';
  end if;
  v_actor_id := private.current_person_id();

  if p_timezone is null
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
    or p_official_start_time is null
    or p_on_time_cutoff is null
    or p_late_attendance_allowed is null
    or p_monday_checkout_minimum is null
    or p_tuesday_checkout_minimum is null
    or p_wednesday_checkout_minimum is null
    or p_thursday_checkout_minimum is null
    or p_friday_checkout_minimum is null
    or p_official_start_time > p_on_time_cutoff
    or p_monday_checkout_minimum <= p_on_time_cutoff
    or p_tuesday_checkout_minimum <= p_on_time_cutoff
    or p_wednesday_checkout_minimum <= p_on_time_cutoff
    or p_thursday_checkout_minimum <= p_on_time_cutoff
    or p_friday_checkout_minimum <= p_on_time_cutoff then
    raise exception 'invalid_attendance_schedule';
  end if;

  update public.attendance_settings
  set
    timezone = p_timezone,
    official_start_time = p_official_start_time,
    on_time_cutoff = p_on_time_cutoff,
    late_attendance_allowed = p_late_attendance_allowed,
    monday_checkout_minimum = p_monday_checkout_minimum,
    tuesday_checkout_minimum = p_tuesday_checkout_minimum,
    wednesday_checkout_minimum = p_wednesday_checkout_minimum,
    thursday_checkout_minimum = p_thursday_checkout_minimum,
    friday_checkout_minimum = p_friday_checkout_minimum,
    updated_by = v_actor_id
  where id = 1;
  return found;
end;
$$;

revoke all on function public.update_attendance_schedule(
  text, time, time, boolean, time, time, time, time, time
) from public, anon;
grant execute on function public.update_attendance_schedule(
  text, time, time, boolean, time, time, time, time, time
) to authenticated;

create function private.apply_attendance_check_in(
  p_student_id uuid,
  p_event_at timestamptz,
  p_method public.attendance_method,
  p_actor_id uuid,
  p_qr_token_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.attendance_settings%rowtype;
  v_attendance_date date;
  v_local_time time;
  v_iso_day integer;
  v_status public.attendance_status;
  v_attendance_id uuid;
  v_existing public.attendance_daily%rowtype;
begin
  if p_student_id is null or p_event_at is null or p_actor_id is null or p_method is null then
    raise exception 'invalid_attendance_check_in';
  end if;
  if (p_method = 'manual' and p_qr_token_id is not null)
    or (p_method = 'qr' and p_qr_token_id is null) then
    raise exception 'invalid_attendance_method_provenance';
  end if;
  if not exists (
    select 1 from public.people
    where id = p_student_id and role = 'student' and is_active
  ) or not exists (
    select 1 from public.people where id = p_actor_id and is_active
  ) then
    raise exception 'attendance_person_not_eligible';
  end if;

  select * into strict v_settings from public.attendance_settings where id = 1;
  v_attendance_date := (p_event_at at time zone v_settings.timezone)::date;
  v_local_time := (p_event_at at time zone v_settings.timezone)::time;
  v_iso_day := extract(isodow from v_attendance_date)::integer;

  if v_iso_day in (6, 7) then raise exception 'attendance_weekend_rejected'; end if;
  if v_local_time < v_settings.official_start_time then
    raise exception 'attendance_before_entry_time';
  end if;
  if v_local_time <= v_settings.on_time_cutoff then
    v_status := 'on_time';
  elsif v_settings.late_attendance_allowed then
    v_status := 'late';
  else
    raise exception 'late_attendance_not_allowed';
  end if;

  insert into public.attendance_daily (
    student_id,
    attendance_date,
    check_in_at,
    check_in_status,
    check_in_method,
    check_in_recorded_by,
    check_in_qr_token_id
  ) values (
    p_student_id,
    v_attendance_date,
    p_event_at,
    v_status,
    p_method,
    p_actor_id,
    p_qr_token_id
  )
  on conflict (student_id, attendance_date) do nothing
  returning id into v_attendance_id;

  if v_attendance_id is not null then return v_attendance_id; end if;

  select * into strict v_existing
  from public.attendance_daily
  where student_id = p_student_id and attendance_date = v_attendance_date
  for update;

  if v_existing.check_in_at is not null then return v_existing.id; end if;
  if v_existing.absence_category is null then raise exception 'invalid_attendance_state'; end if;

  update public.attendance_daily
  set
    check_in_at = p_event_at,
    check_in_status = v_status,
    check_in_method = p_method,
    check_in_recorded_by = p_actor_id,
    check_in_qr_token_id = p_qr_token_id,
    absence_category = null,
    absence_note = null,
    absence_recorded_by = null,
    absence_recorded_at = null
  where id = v_existing.id;
  return v_existing.id;
end;
$$;

revoke all on function private.apply_attendance_check_in(
  uuid, timestamptz, public.attendance_method, uuid, uuid
) from public;

create function private.apply_attendance_absence(
  p_student_id uuid,
  p_category public.absence_category,
  p_note text,
  p_recorded_at timestamptz,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_attendance_date date;
  v_iso_day integer;
  v_note text;
  v_attendance_id uuid;
  v_existing public.attendance_daily%rowtype;
begin
  if p_student_id is null or p_category is null or p_recorded_at is null or p_actor_id is null then
    raise exception 'invalid_attendance_absence';
  end if;
  v_note := nullif(btrim(p_note), '');
  if v_note is not null and length(v_note) > 500 then
    raise exception 'attendance_note_too_long';
  end if;
  if not exists (
    select 1 from public.people
    where id = p_student_id and role = 'student' and is_active
  ) or not exists (
    select 1 from public.people where id = p_actor_id and is_active
  ) then
    raise exception 'attendance_person_not_eligible';
  end if;

  select timezone into strict v_timezone from public.attendance_settings where id = 1;
  v_attendance_date := (p_recorded_at at time zone v_timezone)::date;
  v_iso_day := extract(isodow from v_attendance_date)::integer;
  if v_iso_day in (6, 7) then raise exception 'attendance_weekend_rejected'; end if;

  insert into public.attendance_daily (
    student_id,
    attendance_date,
    absence_category,
    absence_note,
    absence_recorded_by,
    absence_recorded_at
  ) values (
    p_student_id,
    v_attendance_date,
    p_category,
    v_note,
    p_actor_id,
    p_recorded_at
  )
  on conflict (student_id, attendance_date) do nothing
  returning id into v_attendance_id;

  if v_attendance_id is not null then return v_attendance_id; end if;

  select * into strict v_existing
  from public.attendance_daily
  where student_id = p_student_id and attendance_date = v_attendance_date
  for update;

  if v_existing.check_in_at is not null then
    raise exception 'attendance_presence_exists';
  end if;
  if v_existing.absence_category = p_category
    and v_existing.absence_note is not distinct from v_note then
    return v_existing.id;
  end if;

  update public.attendance_daily
  set
    absence_category = p_category,
    absence_note = v_note,
    absence_recorded_by = p_actor_id,
    absence_recorded_at = p_recorded_at
  where id = v_existing.id;
  return v_existing.id;
end;
$$;

revoke all on function private.apply_attendance_absence(
  uuid, public.absence_category, text, timestamptz, uuid
) from public;

create function private.apply_attendance_check_out(
  p_student_id uuid,
  p_event_at timestamptz,
  p_method public.attendance_method,
  p_actor_id uuid,
  p_qr_token_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.attendance_settings%rowtype;
  v_attendance_date date;
  v_local_time time;
  v_iso_day integer;
  v_checkout_minimum time;
  v_existing public.attendance_daily%rowtype;
begin
  if p_student_id is null or p_event_at is null or p_actor_id is null or p_method is null then
    raise exception 'invalid_attendance_check_out';
  end if;
  if (p_method = 'manual' and p_qr_token_id is not null)
    or (p_method = 'qr' and p_qr_token_id is null) then
    raise exception 'invalid_attendance_method_provenance';
  end if;
  if not exists (
    select 1 from public.people
    where id = p_student_id and role = 'student' and is_active
  ) or not exists (
    select 1 from public.people where id = p_actor_id and is_active
  ) then
    raise exception 'attendance_person_not_eligible';
  end if;

  select * into strict v_settings from public.attendance_settings where id = 1;
  v_attendance_date := (p_event_at at time zone v_settings.timezone)::date;
  v_local_time := (p_event_at at time zone v_settings.timezone)::time;
  v_iso_day := extract(isodow from v_attendance_date)::integer;

  if v_iso_day in (6, 7) then raise exception 'attendance_weekend_rejected'; end if;
  v_checkout_minimum := case v_iso_day
    when 1 then v_settings.monday_checkout_minimum
    when 2 then v_settings.tuesday_checkout_minimum
    when 3 then v_settings.wednesday_checkout_minimum
    when 4 then v_settings.thursday_checkout_minimum
    when 5 then v_settings.friday_checkout_minimum
  end;
  if v_local_time < v_checkout_minimum then
    raise exception 'attendance_checkout_too_early';
  end if;

  select * into v_existing
  from public.attendance_daily
  where student_id = p_student_id and attendance_date = v_attendance_date
  for update;

  if not found or v_existing.check_in_at is null then
    raise exception 'attendance_check_in_required';
  end if;
  if v_existing.absence_category is not null then
    raise exception 'attendance_absence_exists';
  end if;
  if v_existing.check_out_at is not null then return v_existing.id; end if;
  if p_event_at < v_existing.check_in_at then
    raise exception 'attendance_checkout_before_check_in';
  end if;

  update public.attendance_daily
  set
    check_out_at = p_event_at,
    check_out_method = p_method,
    check_out_recorded_by = p_actor_id,
    check_out_qr_token_id = p_qr_token_id
  where id = v_existing.id;
  return v_existing.id;
end;
$$;

revoke all on function private.apply_attendance_check_out(
  uuid, timestamptz, public.attendance_method, uuid, uuid
) from public;

create function public.record_manual_check_in(p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_role public.app_role;
begin
  v_role := private.current_user_role();
  if v_role is null or v_role not in ('admin', 'teacher') then
    raise exception 'attendance_staff_required';
  end if;
  v_actor_id := private.current_person_id();
  return private.apply_attendance_check_in(
    p_student_id,
    clock_timestamp(),
    'manual',
    v_actor_id,
    null
  );
end;
$$;

create function public.record_manual_absence(
  p_student_id uuid,
  p_category public.absence_category,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_role public.app_role;
begin
  v_role := private.current_user_role();
  if v_role is null or v_role not in ('admin', 'teacher') then
    raise exception 'attendance_staff_required';
  end if;
  v_actor_id := private.current_person_id();
  return private.apply_attendance_absence(
    p_student_id,
    p_category,
    p_note,
    clock_timestamp(),
    v_actor_id
  );
end;
$$;

create function public.record_manual_check_out(p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_role public.app_role;
begin
  v_role := private.current_user_role();
  if v_role is null or v_role not in ('admin', 'teacher') then
    raise exception 'attendance_staff_required';
  end if;
  v_actor_id := private.current_person_id();
  return private.apply_attendance_check_out(
    p_student_id,
    clock_timestamp(),
    'manual',
    v_actor_id,
    null
  );
end;
$$;

revoke all on function public.record_manual_check_in(uuid) from public, anon;
revoke all on function public.record_manual_absence(uuid, public.absence_category, text) from public, anon;
revoke all on function public.record_manual_check_out(uuid) from public, anon;
grant execute on function public.record_manual_check_in(uuid) to authenticated;
grant execute on function public.record_manual_absence(uuid, public.absence_category, text) to authenticated;
grant execute on function public.record_manual_check_out(uuid) to authenticated;

create function public.correct_attendance(
  p_student_id uuid,
  p_attendance_date date,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_absence_category public.absence_category,
  p_absence_note text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_now timestamptz := clock_timestamp();
  v_settings public.attendance_settings%rowtype;
  v_iso_day integer;
  v_local_check_in_time time;
  v_local_check_out_time time;
  v_checkout_minimum time;
  v_check_in_status public.attendance_status;
  v_absence_note text;
  v_reason text;
  v_existing public.attendance_daily%rowtype;
  v_after public.attendance_daily%rowtype;
  v_before_data jsonb := '{}'::jsonb;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'attendance_admin_required';
  end if;
  v_actor_id := private.current_person_id();
  v_reason := btrim(p_reason);
  v_absence_note := nullif(btrim(p_absence_note), '');

  if p_student_id is null
    or p_attendance_date is null
    or v_reason is null
    or length(v_reason) = 0
    or length(v_reason) > 500
    or (v_absence_note is not null and length(v_absence_note) > 500)
    or not exists (
      select 1 from public.people where id = p_student_id and role = 'student'
    ) then
    raise exception 'invalid_attendance_correction';
  end if;

  select * into strict v_settings from public.attendance_settings where id = 1;
  v_iso_day := extract(isodow from p_attendance_date)::integer;
  if v_iso_day in (6, 7) then raise exception 'attendance_weekend_rejected'; end if;
  if p_attendance_date > (v_now at time zone v_settings.timezone)::date then
    raise exception 'attendance_future_date_rejected';
  end if;
  if p_check_in_at > v_now or p_check_out_at > v_now then
    raise exception 'attendance_future_timestamp_rejected';
  end if;

  if (p_check_in_at is null) = (p_absence_category is null) then
    raise exception 'attendance_presence_or_absence_required';
  end if;

  if p_check_in_at is not null then
    if v_absence_note is not null then raise exception 'absence_note_without_absence'; end if;
    if (p_check_in_at at time zone v_settings.timezone)::date <> p_attendance_date then
      raise exception 'attendance_check_in_date_mismatch';
    end if;
    v_local_check_in_time := (p_check_in_at at time zone v_settings.timezone)::time;
    if v_local_check_in_time < v_settings.official_start_time then
      raise exception 'attendance_before_entry_time';
    end if;
    if v_local_check_in_time <= v_settings.on_time_cutoff then
      v_check_in_status := 'on_time';
    elsif v_settings.late_attendance_allowed then
      v_check_in_status := 'late';
    else
      raise exception 'late_attendance_not_allowed';
    end if;

    if p_check_out_at is not null then
      if (p_check_out_at at time zone v_settings.timezone)::date <> p_attendance_date then
        raise exception 'attendance_check_out_date_mismatch';
      end if;
      if p_check_out_at < p_check_in_at then
        raise exception 'attendance_checkout_before_check_in';
      end if;
      v_local_check_out_time := (p_check_out_at at time zone v_settings.timezone)::time;
      v_checkout_minimum := case v_iso_day
        when 1 then v_settings.monday_checkout_minimum
        when 2 then v_settings.tuesday_checkout_minimum
        when 3 then v_settings.wednesday_checkout_minimum
        when 4 then v_settings.thursday_checkout_minimum
        when 5 then v_settings.friday_checkout_minimum
      end;
      if v_local_check_out_time < v_checkout_minimum then
        raise exception 'attendance_checkout_too_early';
      end if;
    end if;
  elsif p_check_out_at is not null then
    raise exception 'attendance_checkout_without_check_in';
  end if;

  select * into v_existing
  from public.attendance_daily
  where student_id = p_student_id and attendance_date = p_attendance_date
  for update;

  if found then
    v_before_data := to_jsonb(v_existing);
    if p_check_in_at is not null then
      update public.attendance_daily
      set
        check_in_at = p_check_in_at,
        check_in_status = v_check_in_status,
        check_in_method = case
          when v_existing.check_in_at is not null then v_existing.check_in_method
          else 'manual'::public.attendance_method
        end,
        check_in_recorded_by = case
          when v_existing.check_in_at is not null then v_existing.check_in_recorded_by
          else v_actor_id
        end,
        check_in_qr_token_id = case
          when v_existing.check_in_at is not null then v_existing.check_in_qr_token_id
          else null
        end,
        check_out_at = p_check_out_at,
        check_out_method = case
          when p_check_out_at is null then null
          when v_existing.check_out_at is not null then v_existing.check_out_method
          else 'manual'::public.attendance_method
        end,
        check_out_recorded_by = case
          when p_check_out_at is null then null
          when v_existing.check_out_at is not null then v_existing.check_out_recorded_by
          else v_actor_id
        end,
        check_out_qr_token_id = case
          when p_check_out_at is not null and v_existing.check_out_at is not null
            then v_existing.check_out_qr_token_id
          else null
        end,
        absence_category = null,
        absence_note = null,
        absence_recorded_by = null,
        absence_recorded_at = null
      where id = v_existing.id
      returning * into v_after;
    else
      update public.attendance_daily
      set
        check_in_at = null,
        check_in_status = null,
        check_in_method = null,
        check_in_recorded_by = null,
        check_in_qr_token_id = null,
        check_out_at = null,
        check_out_method = null,
        check_out_recorded_by = null,
        check_out_qr_token_id = null,
        absence_category = p_absence_category,
        absence_note = v_absence_note,
        absence_recorded_by = case
          when v_existing.absence_category is not null then v_existing.absence_recorded_by
          else v_actor_id
        end,
        absence_recorded_at = case
          when v_existing.absence_category is not null then v_existing.absence_recorded_at
          else v_now
        end
      where id = v_existing.id
      returning * into v_after;
    end if;
  elsif p_check_in_at is not null then
    insert into public.attendance_daily (
      student_id,
      attendance_date,
      check_in_at,
      check_in_status,
      check_in_method,
      check_in_recorded_by,
      check_out_at,
      check_out_method,
      check_out_recorded_by
    ) values (
      p_student_id,
      p_attendance_date,
      p_check_in_at,
      v_check_in_status,
      'manual',
      v_actor_id,
      p_check_out_at,
      case when p_check_out_at is not null then 'manual'::public.attendance_method end,
      case when p_check_out_at is not null then v_actor_id end
    )
    returning * into v_after;
  else
    insert into public.attendance_daily (
      student_id,
      attendance_date,
      absence_category,
      absence_note,
      absence_recorded_by,
      absence_recorded_at
    ) values (
      p_student_id,
      p_attendance_date,
      p_absence_category,
      v_absence_note,
      v_actor_id,
      v_now
    )
    returning * into v_after;
  end if;

  insert into public.attendance_corrections (
    attendance_id,
    corrected_by,
    reason,
    before_data,
    after_data
  ) values (
    v_after.id,
    v_actor_id,
    v_reason,
    v_before_data,
    to_jsonb(v_after)
  );
  return v_after.id;
end;
$$;

revoke all on function public.correct_attendance(
  uuid, date, timestamptz, timestamptz, public.absence_category, text, text
) from public, anon;
grant execute on function public.correct_attendance(
  uuid, date, timestamptz, timestamptz, public.absence_category, text, text
) to authenticated;

create function public.cleanup_synthetic_attendance_core(
  p_student_login_id text,
  p_attendance_dates date[],
  p_expected_count integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_candidate_count integer;
  v_deleted_count integer;
begin
  if p_student_login_id is null
    or p_student_login_id !~ '^ZST[A-Z0-9._-]{3,61}$'
    or p_attendance_dates is null
    or cardinality(p_attendance_dates) < 1
    or cardinality(p_attendance_dates) > 20
    or array_position(p_attendance_dates, null) is not null
    or p_expected_count is null
    or p_expected_count < 0
    or p_expected_count > 20 then
    raise exception 'invalid_synthetic_attendance_cleanup_request';
  end if;

  select id into v_student_id
  from public.people
  where login_id = p_student_login_id
    and role = 'student'
    and (
      full_name like 'Synthetic Development Student%'
      or full_name like 'Synthetic Integration Student Attendance%'
    );
  if v_student_id is null then raise exception 'synthetic_attendance_student_not_found'; end if;

  if exists (
    select 1 from public.attendance_daily
    where student_id = v_student_id
      and attendance_date = any(p_attendance_dates)
      and (check_in_method = 'qr' or check_out_method = 'qr')
  ) then
    raise exception 'synthetic_attendance_cleanup_qr_rejected';
  end if;

  select count(*)::integer into v_candidate_count
  from public.attendance_daily
  where student_id = v_student_id and attendance_date = any(p_attendance_dates);
  if v_candidate_count <> p_expected_count then
    raise exception 'synthetic_attendance_cleanup_count_mismatch';
  end if;

  delete from public.attendance_corrections
  where attendance_id in (
    select id from public.attendance_daily
    where student_id = v_student_id and attendance_date = any(p_attendance_dates)
  );

  delete from public.attendance_daily
  where student_id = v_student_id and attendance_date = any(p_attendance_dates);
  get diagnostics v_deleted_count = row_count;
  if v_deleted_count <> p_expected_count then
    raise exception 'synthetic_attendance_cleanup_delete_mismatch';
  end if;
  return v_deleted_count;
end;
$$;

revoke all on function public.cleanup_synthetic_attendance_core(text, date[], integer)
from public, anon, authenticated;
grant execute on function public.cleanup_synthetic_attendance_core(text, date[], integer)
to service_role;

revoke insert, update, delete on table public.attendance_daily from anon, authenticated;
revoke all on table public.attendance_daily from service_role;
revoke insert, update, delete on table public.attendance_corrections from anon, authenticated;
revoke all on table public.attendance_corrections from service_role;

comment on table public.attendance_corrections is
  'Admin-only immutable before/after audit records for attendance corrections.';

comment on function public.record_manual_check_in(uuid) is
  'Records or idempotently returns today''s manual check-in using PostgreSQL clock time.';

comment on function public.record_manual_absence(uuid, public.absence_category, text) is
  'Records or updates today''s manual absence for authenticated staff using PostgreSQL clock time.';

comment on function public.record_manual_check_out(uuid) is
  'Records today''s manual checkout using PostgreSQL clock time after the configured weekday minimum.';

comment on function public.correct_attendance(
  uuid, date, timestamptz, timestamptz, public.absence_category, text, text
) is
  'Admin-only audited attendance correction. Status and schedule validation remain database-derived.';
