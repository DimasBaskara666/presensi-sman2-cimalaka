-- Student roster import foundation. This migration creates no Auth users and
-- deliberately keeps activation outside the import milestone.

alter table public.people
drop constraint people_account_state;

alter table public.people
add constraint people_account_state check (
  (
    role = 'student'
    and auth_user_id is null
    and claimed_at is null
  )
  or
  (
    auth_user_id is not null
    and claimed_at is not null
    and claim_code_digest is null
  )
);

alter table public.people
add constraint people_class_name_not_blank check (
  class_name is null or length(btrim(class_name)) > 0
);

alter table public.people
add constraint people_student_identity_complete check (
  role <> 'student'
  or (
    class_name is not null
    and (
      (nis is not null and login_id = nis)
      or (nisn is not null and login_id = nisn)
    )
  )
);

drop policy people_select_by_role on public.people;

create policy people_select_own_or_admin
on public.people
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select private.current_user_role()) = 'admin'
);

create function public.import_student_roster(p_students jsonb)
returns table (
  inserted_count integer,
  updated_count integer,
  unchanged_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_updated integer;
  v_unchanged integer;
begin
  if jsonb_typeof(p_students) <> 'array'
    or jsonb_array_length(p_students) = 0
    or jsonb_array_length(p_students) > 2000 then
    raise exception 'invalid_student_import_payload';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_students) as i(
      login_id text,
      full_name text,
      class_name text,
      nis text,
      nisn text
    )
    where i.login_id is null
      or i.login_id <> upper(btrim(i.login_id))
      or i.login_id !~ '^[A-Z0-9._-]{1,64}$'
      or i.full_name is null
      or length(btrim(i.full_name)) = 0
      or i.class_name is null
      or length(btrim(i.class_name)) = 0
      or ((i.nis is null)::integer + (i.nisn is null)::integer) <> 1
      or coalesce(i.nis, i.nisn) <> i.login_id
  ) then
    raise exception 'invalid_student_import_row';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_students) as i(login_id text)
    group by i.login_id
    having count(*) > 1
  ) then
    raise exception 'duplicate_student_import_id';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_students) as i(login_id text)
    join public.people as p on p.login_id = i.login_id
    where p.role <> 'student'
  ) then
    raise exception 'student_login_id_conflict';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_students) as i(login_id text, nis text, nisn text)
    join public.people as p on p.login_id = i.login_id
    where p.role = 'student'
      and (
        (i.nis is not null and p.nis is distinct from i.nis)
        or (i.nisn is not null and p.nisn is distinct from i.nisn)
      )
  ) then
    raise exception 'student_identity_type_conflict';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_students) as i(login_id text, nis text, nisn text)
    join public.people as p
      on (i.nis is not null and p.nis = i.nis)
      or (i.nisn is not null and p.nisn = i.nisn)
    where p.login_id <> i.login_id
  ) then
    raise exception 'student_school_id_conflict';
  end if;

  select count(*)::integer
  into v_inserted
  from jsonb_to_recordset(p_students) as i(login_id text)
  where not exists (
    select 1 from public.people as p where p.login_id = i.login_id
  );

  select count(*)::integer
  into v_updated
  from jsonb_to_recordset(p_students) as i(login_id text, full_name text, class_name text)
  join public.people as p on p.login_id = i.login_id and p.role = 'student'
  where p.full_name is distinct from btrim(i.full_name)
    or p.class_name is distinct from btrim(i.class_name);

  v_unchanged := jsonb_array_length(p_students) - v_inserted - v_updated;

  update public.people as p
  set
    full_name = btrim(i.full_name),
    class_name = btrim(i.class_name)
  from jsonb_to_recordset(p_students) as i(login_id text, full_name text, class_name text)
  where p.login_id = i.login_id
    and p.role = 'student'
    and (
      p.full_name is distinct from btrim(i.full_name)
      or p.class_name is distinct from btrim(i.class_name)
    );

  insert into public.people (
    login_id,
    full_name,
    role,
    nis,
    nisn,
    class_name,
    auth_user_id,
    claimed_at,
    claim_code_digest,
    must_change_password,
    is_active
  )
  select
    i.login_id,
    btrim(i.full_name),
    'student'::public.app_role,
    i.nis,
    i.nisn,
    btrim(i.class_name),
    null,
    null,
    null,
    false,
    true
  from jsonb_to_recordset(p_students) as i(
    login_id text,
    full_name text,
    class_name text,
    nis text,
    nisn text
  )
  where not exists (
    select 1 from public.people as p where p.login_id = i.login_id
  );

  return query select v_inserted, v_updated, v_unchanged;
end;
$$;

revoke all on function public.import_student_roster(jsonb) from public;
revoke all on function public.import_student_roster(jsonb) from anon;
revoke all on function public.import_student_roster(jsonb) from authenticated;
grant execute on function public.import_student_roster(jsonb) to service_role;

comment on function public.import_student_roster(jsonb) is
  'Imports validated Student roster rows only. It never accepts or changes Auth linkage, activation state, passwords, or active status.';
