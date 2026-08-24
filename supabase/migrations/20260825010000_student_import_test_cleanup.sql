-- Narrow cleanup support for the live Student-import integration test.
-- This function cannot delete claimed Students, ordinary roster rows, or
-- Students with attendance history.

create function public.cleanup_synthetic_student_import(
  p_prefix text,
  p_expected_count integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_count integer;
  v_deleted_count integer;
begin
  if p_prefix is null
    or p_prefix !~ '^ZST[A-Z0-9]{6,40}$'
    or p_expected_count is null
    or p_expected_count < 1
    or p_expected_count > 20 then
    raise exception 'invalid_synthetic_student_cleanup_request';
  end if;

  select count(*)::integer
  into v_candidate_count
  from public.people as p
  where p.login_id like p_prefix || '%'
    and p.role = 'student'
    and p.full_name like 'Synthetic Integration Student%'
    and p.auth_user_id is null
    and p.claimed_at is null
    and p.claim_code_digest is null
    and p.created_at >= now() - interval '1 day'
    and not exists (
      select 1
      from public.attendance_daily as a
      where a.student_id = p.id
    );

  if v_candidate_count <> p_expected_count then
    raise exception 'synthetic_student_cleanup_count_mismatch';
  end if;

  delete from public.people as p
  where p.login_id like p_prefix || '%'
    and p.role = 'student'
    and p.full_name like 'Synthetic Integration Student%'
    and p.auth_user_id is null
    and p.claimed_at is null
    and p.claim_code_digest is null
    and p.created_at >= now() - interval '1 day'
    and not exists (
      select 1
      from public.attendance_daily as a
      where a.student_id = p.id
    );

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> p_expected_count then
    raise exception 'synthetic_student_cleanup_delete_mismatch';
  end if;

  return v_deleted_count;
end;
$$;

revoke all on function public.cleanup_synthetic_student_import(text, integer) from public;
revoke all on function public.cleanup_synthetic_student_import(text, integer) from anon;
revoke all on function public.cleanup_synthetic_student_import(text, integer) from authenticated;
grant execute on function public.cleanup_synthetic_student_import(text, integer) to service_role;

comment on function public.cleanup_synthetic_student_import(text, integer) is
  'Deletes only fresh, unclaimed, attendance-free synthetic rows created by the Student-import integration test.';
