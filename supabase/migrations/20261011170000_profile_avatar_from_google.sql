-- Профайл зураггүй хүнд Google бүртгэлийн зургийг нь тавина. Апп даяар
-- (чат, ажилтны жагсаалт, байршил, сургалт) нэрийн үсгийн оронд зураг гарна.
-- Хэрэглэгч өөрөө зураг оруулсан бол хөндөхгүй.

update public.profiles p
   set avatar_url = coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
  from auth.users u
 where u.id = p.id
   and nullif(btrim(p.avatar_url), '') is null
   and nullif(btrim(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')), '') is not null;

create or replace function public.profile_avatar_from_google()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_pic text;
begin
  if nullif(btrim(new.avatar_url), '') is null then
    select nullif(btrim(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')), '')
      into v_pic from auth.users u where u.id = new.id;
    if v_pic is not null then new.avatar_url := v_pic; end if;
  end if;
  return new;
end;
$$;

revoke all on function public.profile_avatar_from_google() from public, anon, authenticated;

drop trigger if exists profiles_avatar_from_google on public.profiles;
create trigger profiles_avatar_from_google
  before insert or update of avatar_url on public.profiles
  for each row execute function public.profile_avatar_from_google();
