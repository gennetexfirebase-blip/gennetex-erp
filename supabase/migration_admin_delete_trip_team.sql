-- Зөвхөн системийн админ (superadmin) хамт яваа баг / аяллыг устгана

create or replace function public.admin_delete_trip_team(target_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  select role into actor_role from public.profiles where id = auth.uid();
  if coalesce(actor_role, '') <> 'superadmin' then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.trips where id = target_trip_id) then
    raise exception 'trip_not_found';
  end if;

  begin
    delete from public.trip_passengers where trip_id = target_trip_id;
  exception when undefined_table then
    null;
  end;

  delete from public.field_site_sessions where trip_id = target_trip_id;
  delete from public.trips where id = target_trip_id;
end;
$$;

revoke all on function public.admin_delete_trip_team(uuid) from public;
grant execute on function public.admin_delete_trip_team(uuid) to authenticated;

notify pgrst, 'reload schema';
