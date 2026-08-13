-- Системийн админ нэвтэрэхгүй бол энэ файлыг Supabase SQL Editor дээр ажиллуулна.
-- Дараа нь: superadmin@gennetex.mn / SuperAdmin123!

create extension if not exists pgcrypto;

do $$
declare
  v_email text := 'superadmin@gennetex.mn';
  v_password text := 'SuperAdmin123!';
  v_name text := 'Системийн админ';
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = v_email;

  if v_uid is null then
    raise exception 'Хэрэглэгч олдсонгүй. Эхлээд seed_superadmin.sql ажиллуулна уу.';
  end if;

  update auth.users
     set encrypted_password = crypt(v_password, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('name', v_name, 'role', 'superadmin'),
         confirmation_token = coalesce(confirmation_token, ''),
         recovery_token = coalesce(recovery_token, ''),
         email_change = coalesce(email_change, ''),
         email_change_token_new = coalesce(email_change_token_new, ''),
         email_change_token_current = coalesce(email_change_token_current, ''),
         phone_change = coalesce(phone_change, ''),
         phone_change_token = coalesce(phone_change_token, ''),
         reauthentication_token = coalesce(reauthentication_token, ''),
         updated_at = now()
   where id = v_uid;

  insert into public.profiles (id, name, email, role)
  values (v_uid, v_name, v_email, 'superadmin')
  on conflict (id) do update
    set role = 'superadmin', name = excluded.name, email = excluded.email;

  raise notice 'Системийн админ бэлэн: % / %', v_email, v_password;
end $$;

select id, email, role from public.profiles where email = 'superadmin@gennetex.mn';
