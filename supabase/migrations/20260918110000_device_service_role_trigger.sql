-- Supabase exposes the JWT role through auth.role() for both legacy and
-- current PostgREST request claim formats.
create or replace function public.protect_device_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  if new.status is distinct from old.status then
    if auth.role() = 'service_role' then
      return new;
    end if;
    select p.role into actor_role from public.profiles p where p.id = auth.uid();
    if coalesce(actor_role, '') <> 'superadmin' then
      raise exception 'device_status_denied';
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
