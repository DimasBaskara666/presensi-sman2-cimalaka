-- Narrow Teacher-only roster reader for the manual attendance UI.
-- The Student import milestone intentionally keeps direct people-table roster
-- reads hidden from Teachers, so this function exposes only operational fields.

create function public.get_teacher_attendance_roster()
returns table (
  id uuid,
  login_id text,
  full_name text,
  class_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select private.current_user_role()) is distinct from 'teacher' then
    raise exception 'attendance_teacher_required';
  end if;

  return query
  select p.id, p.login_id, p.full_name, p.class_name
  from public.people as p
  where p.role = 'student'
    and p.is_active
    and p.class_name is not null
    and length(btrim(p.class_name)) > 0
  order by p.class_name, p.login_id;
end;
$$;

revoke all on function public.get_teacher_attendance_roster()
from public, anon, service_role;
grant execute on function public.get_teacher_attendance_roster()
to authenticated;

comment on function public.get_teacher_attendance_roster() is
  'Teacher-only active Student roster fields required by today''s manual attendance UI.';

