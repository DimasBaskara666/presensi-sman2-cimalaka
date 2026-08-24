-- Student self-activation. Plaintext activation codes and passwords never
-- enter PostgreSQL. Only their HMAC digest and Supabase Auth's password hash
-- are persisted by their respective systems.

create function public.prepare_student_activation(
  p_login_id text,
  p_claim_code_digest text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
begin
  if p_login_id is null
    or p_login_id <> upper(btrim(p_login_id))
    or p_login_id !~ '^[A-Z0-9._-]{1,64}$'
    or p_claim_code_digest is null
    or p_claim_code_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_student_activation_preparation';
  end if;

  update public.people as p
  set claim_code_digest = p_claim_code_digest
  where p.login_id = p_login_id
    and p.role = 'student'
    and p.is_active
    and p.auth_user_id is null
    and p.claimed_at is null
  returning p.id into v_student_id;

  return v_student_id is not null;
end;
$$;

revoke all on function public.prepare_student_activation(text, text) from public;
revoke all on function public.prepare_student_activation(text, text) from anon;
revoke all on function public.prepare_student_activation(text, text) from authenticated;
grant execute on function public.prepare_student_activation(text, text) to service_role;

comment on function public.prepare_student_activation(text, text) is
  'Sets or replaces only an active, unclaimed Student activation-code digest. Plaintext codes are never accepted.';

create function private.link_student_activation_auth()
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

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'student_activation'
  where id = new.id;

  return new;
end;
$$;

revoke all on function private.link_student_activation_auth() from public;

create trigger link_student_activation_auth
after insert on auth.users
for each row
execute function private.link_student_activation_auth();

comment on function private.link_student_activation_auth() is
  'Atomically links only a matching active, unclaimed Student during trusted Auth creation and consumes the digest.';
