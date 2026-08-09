-- Нэвтрэхэд profiles мөр автоматаар үүсгэх / auth metadata-аас эрх синк хийх
-- (superadmin нэвтрэхэд profiles.role зөв болно)

create or replace function public.bootstrap_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  u record;
  meta_role text;
  row public.profiles;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select id, email, raw_user_meta_data into u from auth.users where id = uid;
  if not found then
    raise exception 'user_not_found';
  end if;

  meta_role := coalesce(u.raw_user_meta_data->>'role', 'employee');
  if meta_role not in ('employee', 'admin', 'superadmin') then
    meta_role := 'employee';
  end if;

  insert into public.profiles (id, name, email, role)
  values (
    uid,
    coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.email,
    meta_role
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name),
    role = case
      when public.profiles.role = 'superadmin' then 'superadmin'
      when excluded.role = 'superadmin' then 'superadmin'
      when excluded.role = 'admin' and public.profiles.role = 'employee' then 'admin'
      else public.profiles.role
    end
  returning * into row;

  return row;
end;
$$;

grant execute on function public.bootstrap_profile() to authenticated;

notify pgrst, 'reload schema';
