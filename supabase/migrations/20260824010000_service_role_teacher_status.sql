-- Allow trusted Admin actions to activate or deactivate Teacher profiles only.
grant update (is_active) on table public.people to service_role;
