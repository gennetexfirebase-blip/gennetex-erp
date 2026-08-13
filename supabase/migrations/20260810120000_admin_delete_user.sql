-- ============================================================================
-- Хэрэглэгч устгах эрх — сервер талд хэрэгжүүлсэн
-- ============================================================================
--
-- Дүрэм:
--   • superadmin  → ажилтан болон админыг устгана
--   • admin       → ЗӨВХӨН ажилтныг устгана
--   • admin       → superadmin-ийг устгаж ЧАДАХГҮЙ
--   • admin       → өөр админыг устгаж ЧАДАХГҮЙ
--   • хэн ч       → өөрийгөө устгаж ЧАДАХГҮЙ
--   • сүүлчийн superadmin-ийг устгаж ЧАДАХГҮЙ (систем эзэнгүй үлдэхээс сэргийлнэ)
--
-- ⚠️ ЯАГААД SQL ТАЛД ХИЙХ ЁСТОЙ ВЭ:
--    Апп-ын anon key нь нийтэд ил байдаг. Зөвхөн React талд "энэ товчийг
--    нуулаа" гэж шалгавал, хүсэлтийг гараар зохиож дамжуулах боломжтой.
--    Тиймээс эрхийн шалгалт ЗААВАЛ энд, security definer функц дотор байна.
-- ============================================================================

create or replace function public.admin_delete_user(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id      uuid := auth.uid();
  actor_role    text;
  target_role   text;
  target_email  text;
  superadmins   int;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Дуудаж буй хүний эрх
  select role into actor_role from public.profiles where id = actor_id;
  if actor_role is null then
    raise exception 'no_profile';
  end if;
  if actor_role not in ('admin', 'superadmin') then
    raise exception 'forbidden';
  end if;

  -- Өөрийгөө устгахыг хориглоно
  if actor_id = target_id then
    raise exception 'cannot_delete_self';
  end if;

  -- Устгах гэж буй хүний эрх
  select role, email into target_role, target_email
  from public.profiles where id = target_id;
  if target_role is null then
    raise exception 'target_not_found';
  end if;

  -- Энгийн админ зөвхөн ажилтныг устгана
  if actor_role = 'admin' and target_role <> 'employee' then
    raise exception 'forbidden_target';
  end if;

  -- Сүүлчийн superadmin-ийг устгахыг хориглоно
  if target_role = 'superadmin' then
    select count(*) into superadmins
    from public.profiles where role = 'superadmin';
    if superadmins <= 1 then
      raise exception 'last_superadmin';
    end if;
  end if;

  -- Зөвшөөрлийн жагсаалтаас идэвхгүй болгоно — эс бөгөөс дахин нэвтэрч,
  -- профайл нь автоматаар дахин үүснэ.
  update public.authorized_users
     set active = false
   where linked_user_id = target_id
      or lower(trim(email)) = lower(trim(coalesce(target_email, '')));

  -- auth.users устгахад profiles нь on delete cascade-аар дагаж устана
  -- (profiles.id → auth.users(id) on delete cascade).
  delete from auth.users where id = target_id;

  return jsonb_build_object(
    'deleted', target_id,
    'role', target_role,
    'email', target_email,
    'by', actor_id
  );
end;
$$;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant  execute on function public.admin_delete_user(uuid) to authenticated;


-- ============================================================================
-- Хүлээгдэж буй зөвшөөрлийг цуцлах
-- ============================================================================
-- admin_list_authorized_users нь Google-ээр хараахан нэвтрээгүй хүнийг
-- id = 'pending:<email>' гэж буцаадаг. Тэдэнд auth.users мөр байхгүй тул
-- admin_delete_user ажиллахгүй — зөвшөөрлийн жагсаалтаас нь хасах хэрэгтэй.

create or replace function public.admin_revoke_authorization(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id    uuid := auth.uid();
  actor_role  text;
  target      public.authorized_users%rowtype;
  norm_email  text := lower(trim(p_email));
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select role into actor_role from public.profiles where id = actor_id;
  if actor_role not in ('admin', 'superadmin') then
    raise exception 'forbidden';
  end if;

  select * into target from public.authorized_users where email = norm_email;
  if target.email is null then
    raise exception 'target_not_found';
  end if;

  -- Аль хэдийн нэвтэрсэн бол энэ функц биш, admin_delete_user ашиглана
  if target.linked_user_id is not null then
    raise exception 'already_linked';
  end if;

  -- Энгийн админ зөвхөн ажилтны зөвшөөрлийг цуцална
  if actor_role = 'admin' and target.role <> 'employee' then
    raise exception 'forbidden_target';
  end if;

  update public.authorized_users set active = false where email = norm_email;

  return jsonb_build_object('revoked', norm_email, 'by', actor_id);
end;
$$;

revoke execute on function public.admin_revoke_authorization(text) from public, anon;
grant  execute on function public.admin_revoke_authorization(text) to authenticated;


-- ============================================================================
-- Эрх солих — мөн адил сервер талд хамгаална
-- ============================================================================
-- superadmin эрх олгох/хураахыг зөвхөн superadmin хийнэ.
-- Энгийн админ зөвхөн 'employee' эрх онооно.

create or replace function public.admin_set_user_role(target_id uuid, new_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id    uuid := auth.uid();
  actor_role  text;
  target_role text;
  superadmins int;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;
  if new_role not in ('employee', 'admin', 'superadmin') then
    raise exception 'invalid_role';
  end if;

  select role into actor_role from public.profiles where id = actor_id;
  if actor_role not in ('admin', 'superadmin') then
    raise exception 'forbidden';
  end if;

  select role into target_role from public.profiles where id = target_id;
  if target_role is null then
    raise exception 'target_not_found';
  end if;

  -- Энгийн админ: зөвхөн ажилтныг, зөвхөн ажилтан эрх рүү
  if actor_role = 'admin' and (target_role <> 'employee' or new_role <> 'employee') then
    raise exception 'forbidden_target';
  end if;

  -- Сүүлчийн superadmin өөрийгөө бууруулахыг хориглоно
  if target_role = 'superadmin' and new_role <> 'superadmin' then
    select count(*) into superadmins from public.profiles where role = 'superadmin';
    if superadmins <= 1 then
      raise exception 'last_superadmin';
    end if;
  end if;

  update public.profiles set role = new_role where id = target_id;
  update public.authorized_users set role = new_role where linked_user_id = target_id;

  return jsonb_build_object('id', target_id, 'role', new_role, 'by', actor_id);
end;
$$;

revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
grant  execute on function public.admin_set_user_role(uuid, text) to authenticated;
