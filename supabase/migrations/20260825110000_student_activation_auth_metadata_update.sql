-- Supabase Auth may apply Admin API app_metadata after the initial auth.users
-- insert. Process the trusted activation marker on either lifecycle event.

drop trigger link_student_activation_auth on auth.users;

create or replace function private.link_student_activation_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_login_id text;
  v_claim_code_digest text;
  v_student_id uuid;
begin
  v_payload := new.raw_app_meta_data -> 'student_activation';
  if jsonb_typeof(v_payload) is distinct from 'object' then
    return new;
  end if;

  v_login_id := v_payload ->> 'login_id';
  v_claim_code_digest := v_payload ->> 'claim_code_digest';
  if v_login_id is null
    or v_login_id <> upper(btrim(v_login_id))
    or v_login_id !~ '^[A-Z0-9._-]{1,64}$'
    or v_claim_code_digest is null
    or v_claim_code_digest !~ '^[a-f0-9]{64}$'
    or new.email is null
    or split_part(lower(new.email), '@', 1) <> lower(v_login_id) then
    raise exception 'invalid_student_activation_auth_marker';
  end if;

  update public.people as p
  set
    auth_user_id = new.id,
    claimed_at = now(),
    claim_code_digest = null,
    must_change_password = false
  where p.login_id = v_login_id
    and p.role = 'student'
    and p.is_active
    and p.auth_user_id is null
    and p.claimed_at is null
    and p.claim_code_digest = v_claim_code_digest
  returning p.id into v_student_id;

  if v_student_id is null then
    raise exception 'student_activation_link_rejected';
  end if;

  if tg_op = 'UPDATE' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) - 'student_activation';
  else
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'student_activation'
    where id = new.id;
  end if;

  return new;
end;
$$;

create trigger link_student_activation_auth_insert
after insert on auth.users
for each row
execute function private.link_student_activation_auth();

create trigger link_student_activation_auth_metadata
before update of raw_app_meta_data on auth.users
for each row
execute function private.link_student_activation_auth();
