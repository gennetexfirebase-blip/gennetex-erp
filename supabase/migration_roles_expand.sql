-- ============================================================================
-- Эрхийн системийг өргөтгөх — Нярав, Ахлах, Захирал
-- ============================================================================
--
-- Одоо: employee | admin | superadmin
-- Болох: employee | nyrav | ahlah | admin | zahiral | superadmin
--
-- ЗЭРЭГЛЭЛ (том тоо = өндөр эрх):
--   0 employee    Ажилтан     үндсэн
--   1 nyrav       Нярав       агуулах — бараа, багаж
--   2 ahlah       Ахлах       багийн ирц, хүсэлт батална
--   3 admin       Админ       ажилтан, бүртгэл удирдана
--   4 zahiral     Захирал     бүх үйл ажиллагаа, цалин
--   5 superadmin  Хөгжүүлэгч  систем, эрх олгох
--
-- Дүрэм: хэрэглэгч ЗӨВХӨН өөрөөсөө доош зэрэглэлтэй хүнийг удирдана.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Багануудын хязгаарлалтыг өргөтгөх
-- ---------------------------------------------------------------------------

alter table public.authorized_users drop constraint if exists authorized_users_role_check;
alter table public.authorized_users
  add constraint authorized_users_role_check
  check (role in ('employee', 'nyrav', 'ahlah', 'admin', 'zahiral', 'superadmin'));

-- profiles.role-д хязгаарлалт байвал мөн адил
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check' and conrelid = 'public.profiles'::regclass
  ) then
    execute 'alter table public.profiles drop constraint profiles_role_check';
  end if;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('employee', 'nyrav', 'ahlah', 'admin', 'zahiral', 'superadmin'));


-- ---------------------------------------------------------------------------
-- 2. Зэрэглэл тооцох функц
-- ---------------------------------------------------------------------------
-- Эрхийн шалгалтыг нэг газар төвлөрүүлнэ. Шинэ эрх нэмэхэд зөвхөн үүнийг
-- засна — бүх policy, функцийг дахин бичихгүй.

create or replace function public.role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'superadmin' then 5
    when 'zahiral'    then 4
    when 'admin'      then 3
    when 'ahlah'      then 2
    when 'nyrav'      then 1
    else 0
  end;
$$;

grant execute on function public.role_rank(text) to authenticated, anon;


/** Дуудаж буй хэрэглэгчийн зэрэглэл. */
create or replace function public.my_rank()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.role_rank((select role from public.profiles where id = auth.uid()));
$$;

revoke execute on function public.my_rank() from public, anon;
grant  execute on function public.my_rank() to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Одоо байгаа шалгалтуудыг зэрэглэлд шилжүүлэх
-- ---------------------------------------------------------------------------

-- Удирдлагын эрх = админаас дээш (admin, zahiral, superadmin)
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.my_rank() >= 3;
$$;

revoke execute on function public.is_admin_user() from public, anon;
grant  execute on function public.is_admin_user() to authenticated;

-- Хүсэлт батлах эрх = ахлахаас дээш
create or replace function public.can_approve_requests()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.my_rank() >= 2;
$$;

revoke execute on function public.can_approve_requests() from public, anon;
grant  execute on function public.can_approve_requests() to authenticated;

-- Агуулах эрх = няраваас дээш
create or replace function public.can_manage_inventory()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.my_rank() >= 1;
$$;

revoke execute on function public.can_manage_inventory() from public, anon;
grant  execute on function public.can_manage_inventory() to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Устгах / эрх солих функцийг зэрэглэлээр шинэчлэх
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_user(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id     uuid := auth.uid();
  actor_role   text;
  target_role  text;
  target_email text;
  superadmins  int;
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;

  select role into actor_role from public.profiles where id = actor_id;
  if actor_role is null then raise exception 'no_profile'; end if;
  -- Устгах эрх нь админаас дээш
  if public.role_rank(actor_role) < 3 then raise exception 'forbidden'; end if;

  if actor_id = target_id then raise exception 'cannot_delete_self'; end if;

  select role, email into target_role, target_email
  from public.profiles where id = target_id;
  if target_role is null then raise exception 'target_not_found'; end if;

  -- ЗӨВХӨН өөрөөсөө доош зэрэглэлтэйг устгана.
  -- Хөгжүүлэгч л бусад хөгжүүлэгчийг устгаж чадна.
  if public.role_rank(target_role) >= public.role_rank(actor_role)
     and actor_role <> 'superadmin' then
    raise exception 'forbidden_target';
  end if;

  if target_role = 'superadmin' then
    select count(*) into superadmins from public.profiles where role = 'superadmin';
    if superadmins <= 1 then raise exception 'last_superadmin'; end if;
  end if;

  update public.authorized_users
     set active = false
   where linked_user_id = target_id
      or lower(trim(email)) = lower(trim(coalesce(target_email, '')));

  delete from auth.users where id = target_id;

  return jsonb_build_object('deleted', target_id, 'role', target_role, 'by', actor_id);
end;
$$;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant  execute on function public.admin_delete_user(uuid) to authenticated;


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
  if actor_id is null then raise exception 'not_authenticated'; end if;
  if new_role not in ('employee','nyrav','ahlah','admin','zahiral','superadmin') then
    raise exception 'invalid_role';
  end if;

  select role into actor_role from public.profiles where id = actor_id;
  if public.role_rank(actor_role) < 3 then raise exception 'forbidden'; end if;

  select role into target_role from public.profiles where id = target_id;
  if target_role is null then raise exception 'target_not_found'; end if;

  -- Өөрөөсөө дээш эрх олгож болохгүй, дээш зэрэглэлтэйг засаж ч болохгүй.
  if actor_role <> 'superadmin' then
    if public.role_rank(target_role) >= public.role_rank(actor_role)
       or public.role_rank(new_role) >= public.role_rank(actor_role) then
      raise exception 'forbidden_target';
    end if;
  end if;

  if target_role = 'superadmin' and new_role <> 'superadmin' then
    select count(*) into superadmins from public.profiles where role = 'superadmin';
    if superadmins <= 1 then raise exception 'last_superadmin'; end if;
  end if;

  update public.profiles set role = new_role where id = target_id;
  update public.authorized_users set role = new_role where linked_user_id = target_id;

  return jsonb_build_object('id', target_id, 'role', new_role, 'by', actor_id);
end;
$$;

revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
grant  execute on function public.admin_set_user_role(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Ажилтны жагсаалтыг зэрэглэлээр шүүх
-- ---------------------------------------------------------------------------
-- Өмнө нь "superadmin бол бүгд, бусад нь зөвхөн employee" гэсэн хатуу дүрэм
-- байсан. Одоо: өөрөөсөө доош зэрэглэлтэй хүмүүсийг харна.

create or replace function public.admin_list_authorized_users()
-- ⚠️ Гарын үсэг нь ЭХ функцтэй ЯГ таарах ёстой (migration_gmail_auth.sql:309).
--    `create or replace function` нь буцаах төрлийг өөрчилж чадахгүй.
--    Мөн `position` нь PostgreSQL-ийн нөөцлөгдсөн үг тул хашилттай бичнэ.
returns table (
  record_id text,
  user_id uuid,
  email text,
  name text,
  last_name text,
  "position" text,
  phone text,
  address text,
  role text,
  registered boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_rank int;
begin
  -- ⚠️ Хүснэгтийг ЗААВАЛ ХОЧООР тодотгоно (`p.role`).
  --    `returns table (... role text ...)` нь `role`, `email`, `name`,
  --    `phone`, `address`, `position` зэргийг ГАРАЛТЫН ПАРАМЕТР болгодог.
  --    Тодотголгүй `select role ...` бичвэл PostgreSQL хоёрдмол утгатай гэж
  --    үзэж функцийг бүхэлд нь унагаана — үр дүнд нь ажилтны жагсаалт
  --    хоосон харагдана.
  select p.role into actor_role from public.profiles p where p.id = auth.uid();
  actor_rank := public.role_rank(actor_role);
  if actor_rank < 3 then
    raise exception 'forbidden';
  end if;

  return query
  select
    coalesce(a.linked_user_id::text, 'pending:' || a.email),
    a.linked_user_id,
    a.email,
    coalesce(p.name, a.name),
    coalesce(p.last_name, a.last_name),
    coalesce(p.position, a.position),
    coalesce(p.phone, a.phone),
    coalesce(p.address, a.address),
    a.role,
    a.linked_user_id is not null,
    a.created_at
  from public.authorized_users a
  left join public.profiles p on p.id = a.linked_user_id
  where a.active
    and (actor_role = 'superadmin' or public.role_rank(a.role) < actor_rank)
  order by a.created_at;
end;
$$;

revoke execute on function public.admin_list_authorized_users() from public, anon;
grant  execute on function public.admin_list_authorized_users() to authenticated;

notify pgrst, 'reload schema';
