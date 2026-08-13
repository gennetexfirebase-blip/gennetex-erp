-- ============================================================
-- Gennetex ERP — Анхны АДМИН хэрэглэгч үүсгэх SQL (засварласан)
-- ============================================================
-- Ажиллуулах: Supabase Dashboard -> SQL Editor -> энэ файлыг Run хийнэ.
-- УРЬДЧИЛСАН НӨХЦӨЛ: schema.sql-ийг НЭГ УДАА ажиллуулсан байх ёстой.
--
-- Нэвтрэх мэдээлэл (дараа нь заавал соль):
--   Имэйл:    admin@gennetex.mn
--   Нууц үг:  Admin123!
--
-- ЧУХАЛ: GoTrue нь token баганууд NULL байвал login дээр 500 (unexpected_failure)
-- өгдөг тул тэдгээрийг '' (хоосон мөр)-өөр бөглөнө.
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
  v_email text := 'admin@gennetex.mn';
  v_password text := 'Admin123!';
  v_name text := 'Админ';
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = v_email;

  if v_uid is null then
    v_uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('name', v_name, 'role', 'admin'),
      now(), now(),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email),
      'email', now(), now(), now()
    );

    raise notice 'Админ үүслээ: %', v_email;
  else
    -- Аль хэдийн байгаа хэрэглэгчийн нууц үг + token баганыг засах
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           raw_user_meta_data = raw_user_meta_data
             || jsonb_build_object('name', v_name, 'role', 'admin'),
           updated_at = now()
     where id = v_uid;
    raise notice 'Хэрэглэгч шинэчлэгдлээ: %', v_email;
  end if;

  -- Бүх хэрэглэгчийн NULL token баганыг засах (login 500-аас сэргийлнэ)
  update auth.users
     set confirmation_token = coalesce(confirmation_token, ''),
         recovery_token = coalesce(recovery_token, ''),
         email_change = coalesce(email_change, ''),
         email_change_token_new = coalesce(email_change_token_new, ''),
         email_change_token_current = coalesce(email_change_token_current, ''),
         phone_change = coalesce(phone_change, ''),
         phone_change_token = coalesce(phone_change_token, ''),
         reauthentication_token = coalesce(reauthentication_token, '');

  -- profiles дээр эрхийг админ болгох
  insert into public.profiles (id, name, email, role)
  values (v_uid, v_name, v_email, 'admin')
  on conflict (id) do update set role = 'admin';
end $$;

-- Шалгах:
-- select id, email, role from public.profiles where email = 'admin@gennetex.mn';
