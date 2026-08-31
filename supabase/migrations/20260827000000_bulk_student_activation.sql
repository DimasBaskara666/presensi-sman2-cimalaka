-- Bulk Student Activation Preparation
-- Sets or replaces claim_code_digest only for active, unclaimed Student records.
-- Plaintext codes are never accepted by or stored in PostgreSQL.

create function public.prepare_bulk_student_activations(
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid_bulk_activation_items';
  end if;

  with item_rows as (
    select
      upper(btrim(item ->> 'login_id')) as login_id,
      item ->> 'claim_code_digest' as claim_code_digest
    from jsonb_array_elements(p_items) as item
  ),
  validated as (
    select login_id, claim_code_digest
    from item_rows
    where login_id is not null
      and login_id ~ '^[A-Z0-9._-]{1,64}$'
      and claim_code_digest is not null
      and claim_code_digest ~ '^[a-f0-9]{64}$'
  ),
  updated as (
    update public.people as p
    set claim_code_digest = v.claim_code_digest
    from validated as v
    where p.login_id = v.login_id
      and p.role = 'student'
      and p.is_active
      and p.auth_user_id is null
      and p.claimed_at is null
    returning p.id
  )
  select count(*) into v_count from updated;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.prepare_bulk_student_activations(jsonb) from public;
revoke all on function public.prepare_bulk_student_activations(jsonb) from anon;
revoke all on function public.prepare_bulk_student_activations(jsonb) from authenticated;
grant execute on function public.prepare_bulk_student_activations(jsonb) to service_role;

comment on function public.prepare_bulk_student_activations(jsonb) is
  'Sets or replaces claim_code_digest in bulk only for active, unclaimed Student records.';
