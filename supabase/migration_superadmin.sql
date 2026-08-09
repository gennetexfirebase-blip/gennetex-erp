-- Системийн админ (superadmin) — дээд эрх, ердийн админд харагдахгүй

-- profiles.role: 'employee' | 'admin' | 'superadmin'

create or replace function public.protect_employee_profile_fields()
returns trigger as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles where id = auth.uid();
  if user_role is null or user_role in ('admin', 'superadmin') then
    return new;
  end if;
  if new.name is distinct from old.name
     or new.last_name is distinct from old.last_name
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.position is distinct from old.position
     or new.phone is distinct from old.phone
     or new.address is distinct from old.address then
    raise exception 'profile_update_denied';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.protect_superadmin_profile()
returns trigger as $$
declare
  actor_role text;
begin
  select role into actor_role from public.profiles where id = auth.uid();

  if old.role = 'superadmin' and coalesce(actor_role, '') <> 'superadmin' then
    raise exception 'superadmin_protected';
  end if;

  if new.role = 'superadmin' and coalesce(actor_role, '') <> 'superadmin' then
    raise exception 'superadmin_role_denied';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_superadmin_profile on public.profiles;
create trigger protect_superadmin_profile
  before update on public.profiles
  for each row execute function public.protect_superadmin_profile();

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'superadmin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'superadmin')
    )
  );

notify pgrst, 'reload schema';
