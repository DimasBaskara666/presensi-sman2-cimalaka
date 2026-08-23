-- Allow trusted server-only account provisioning without weakening application RLS.
grant select, insert on table public.people to service_role;
