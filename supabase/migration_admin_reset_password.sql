-- Системийн админ (superadmin) бүх хэрэглэгчийн нууц үг солих
-- Supabase SQL Editor дээр ажиллуулна.

create extension if not exists pgcrypto;

create or replace function public.admin_reset_user_password(
  target_user_id uuid,
  new_password text,
  force_change boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_role text;
begin
  select role into actor_role from public.profiles where id = auth.uid();
  if coalesce(actor_role, '') <> 'superadmin' then
    raise exception 'forbidden';
  end if;

  if new_password is null or length(new_password) < 6 then
    raise exception 'password_too_short';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'user_not_found';
  end if;

  update auth.users
     set encrypted_password = crypt(new_password, gen_salt('bf')),
         updated_at = now()
   where id = target_user_id;

  update public.profiles
     set must_change_password = coalesce(force_change, true)
   where id = target_user_id;
end;
$$;

revoke all on function public.admin_reset_user_password(uuid, text, boolean) from public;
grant execute on function public.admin_reset_user_password(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
