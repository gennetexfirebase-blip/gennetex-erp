-- ============================================================================
-- Хэлтэс · Ахлах ба Менежер эрх · нарийвчилсан зөвшөөрөл
-- ============================================================================
--
-- ЮУ НЭМЭГДЭЖ БАЙНА:
--   1. `departments` — хэлтэс. Хоёр төрөлтэй: байгууллага (org) ба өрх (household).
--   2. `profiles.department_id`, `authorized_users.department_id`,
--      `inventory.department_id` — хүн ба бараа/багажийг хэлтэст хамааруулна.
--   3. `ahlah` (Ахлах) ба `menejer` (Менежер) эрх — ажилтнаас дээш,
--      админаас доош. Менежер нь хэлтсийн УДИРДАГЧ (хэлтсийн админ),
--      ахлах нь түүний доор багаа хариуцна.
--   4. `profiles.permissions` jsonb — хөгжүүлэгч хүн тус бүрийн эрхийг
--      нэг бүрчлэн нээх/хаах.
--
-- ЗАРЧИМ — ХЭН ХЭНИЙГ НЭМЭХ ВЭ:
--   • ХӨГЖҮҮЛЭГЧ (sysadmin) — хэлтсийг үүсгэж, тэр хэлтсийн МЕНЕЖЕР
--     (хэлтсийн админ) болон АХЛАХыг томилно. Өөр хэн ч ахлах, менежер,
--     админ эрхтэй хүн нэмж чадахгүй.
--   • МЕНЕЖЕР / АХЛАХ — зөвхөн ӨӨРИЙН ХЭЛТСИЙН ажилтныг нэмнэ, хасна.
--
-- ХЭЛТСИЙН ХАМРАХ ХҮРЭЭ:
--   • superadmin                       → бүгдийг харна, бүгдийг хийнэ
--   • хэлтэсгүй admin                  → бүгдийг харна (компанийн админ)
--   • хэлтэстэй admin/menejer/ahlah    → ЗӨВХӨН өөрийн хэлтсийн хүн, бараа, багаж
--   • ажилтан                          → удирдлагын жагсаалт огт харагдахгүй
--
-- ⚠️ `role_rank` ТООН УТГЫГ БУУЛГАХГҮЙ:
--   Одоо байгаа функцууд `>= 1` (агуулах, хайрцаг) ба `>= 3` (цалин,
--   устгах, app release) гэсэн босго ашигладаг. Шинэ утгууд:
--     ahlah = 1, menejer = 2
--     >= 1 → ахлах, менежер агуулахаа удирдана      ✅ хүссэн үр дүн
--     >= 3 → тэд цалин, системийн устгал руу орохгүй ✅ хүссэн үр дүн
--   Тэдний ажилтан нэмэх/хасах нь доорх ХЭЛТСЭЭР ХЯЗГААРЛАСАН функцээр
--   явна, ерөнхий `>= 3` босгыг доошлуулахгүй.
--
-- ХАМААРАЛ: 20260811120000_simplify_roles.sql, migration_gmail_auth.sql,
--           20260810120100_roles_expand.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Хэлтсийн хүснэгт
-- ---------------------------------------------------------------------------
create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- 'org'       → Байгууллага
  -- 'household' → Өрх
  kind       text not null default 'org' check (kind in ('org', 'household')),
  note       text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

-- Нэг төрөл дотор ижил нэр давхардуулахгүй (том/жижиг үсэг үл харгалзана).
create unique index if not exists departments_kind_name_uidx
  on public.departments (kind, lower(name));

create index if not exists departments_kind_idx on public.departments (kind, active);

-- ---------------------------------------------------------------------------
-- 2. Хамаарлын баганууд
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists department_id uuid references public.departments (id) on delete set null;

alter table public.authorized_users
  add column if not exists department_id uuid references public.departments (id) on delete set null;

-- `department_id is null` = НИЙТИЙН бараа/багаж. Бүх хэлтэс харна.
alter table public.inventory
  add column if not exists department_id uuid references public.departments (id) on delete set null;

create index if not exists profiles_department_idx  on public.profiles (department_id);
create index if not exists inventory_department_idx on public.inventory (department_id);

-- ---------------------------------------------------------------------------
-- 3. Хүн тус бүрийн нарийвчилсан эрх
-- ---------------------------------------------------------------------------
-- Жишээ: {"employees.manage": true, "payroll.view": false}
-- Утга байхгүй бол эрхийн ТҮВШНИЙ анхны утга үйлчилнэ (клиент тал:
-- src/lib/permissions.js). Зөвхөн хөгжүүлэгч бичнэ — доорх RPC-ээр.
alter table public.profiles
  add column if not exists permissions jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 4. `ahlah` (Ахлах) ба `menejer` (Менежер) эрх
-- ---------------------------------------------------------------------------
-- 20260811120000_simplify_roles.sql нь `ahlah`-г `admin` руу нийлүүлж,
-- CHECK хязгаарлалтыг 3 утгаар хаасан. Одоо 5 түвшин болгоно:
--
--   employee   Ажилтан      үндсэн эрх
--   ahlah      Ахлах        багийнхаа ажилтныг хариуцна
--   menejer    Менежер      ХЭЛТСИЙН УДИРДАГЧ — ахлах, ажилтнаа хариуцна
--   admin      Админ        компанийн хэмжээний удирдлага
--   superadmin Хөгжүүлэгч   систем, эрх олгох
--
-- ⚠️ Хуучин өгөгдлийг БУЦААХГҮЙ: тэр migration аль хэдийн `ahlah` хүмүүсийг
--    `admin` болгосон бөгөөд хэн нь анх ахлах байсныг мэдэх арга байхгүй.
--    Хэрэгтэй хүмүүсийг аппаас нь дахин томилно.

alter table public.profiles          drop constraint if exists profiles_role_check;
alter table public.authorized_users  drop constraint if exists authorized_users_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('employee', 'ahlah', 'menejer', 'admin', 'superadmin'));

alter table public.authorized_users
  add constraint authorized_users_role_check
  check (role in ('employee', 'ahlah', 'menejer', 'admin', 'superadmin'));

create or replace function public.role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p_role, ''))
    when 'superadmin' then 5
    when 'admin'      then 3
    -- Менежер = хэлтсийн удирдагч, Ахлах = түүний доор баг хариуцна.
    -- Хоёулаа `>= 1` шалгалтад тэнцэж (агуулах), `>= 3`-д тэнцэхгүй
    -- (цалин, системийн устгал).
    when 'menejer'    then 2
    when 'ahlah'      then 1
    -- Хуучин албан тушаал-эрхүүд (өгөгдөлд үлдсэн байж болзошгүй)
    when 'zahiral'    then 3
    when 'nyrav'      then 3
    else 0
  end;
$$;

grant execute on function public.role_rank(text) to authenticated, anon;

create or replace function public.assert_valid_role(p_role text)
returns text
language plpgsql
immutable
as $$
begin
  if lower(coalesce(p_role, '')) not in ('employee', 'ahlah', 'menejer', 'admin', 'superadmin') then
    raise exception 'invalid_role: % (зөвшөөрөгдөх: employee, ahlah, menejer, admin, superadmin)', p_role;
  end if;
  return lower(p_role);
end;
$$;

grant execute on function public.assert_valid_role(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Туслах функцууд
-- ---------------------------------------------------------------------------

create or replace function public.my_department()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.department_id from public.profiles p where p.id = auth.uid();
$$;

grant execute on function public.my_department() to authenticated;

/**
 * Тухайн хэлтсийн өгөгдөлд хандах эрхтэй эсэх.
 *
 *   superadmin        → үргэлж тийм
 *   хэлтэсгүй хэрэглэгч → тийм (компанийн хэмжээний админ, хуучин үйлдэл)
 *   хэлтэстэй         → зөвхөн ӨӨРИЙН хэлтэс
 *   p_dept is null    → нийтийн өгөгдөл, бүгд хандана
 */
create or replace function public.dept_in_scope(p_dept uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_dept is null
    or public.is_superadmin()
    or public.my_department() is null
    or p_dept = public.my_department();
$$;

grant execute on function public.dept_in_scope(uuid) to authenticated;

/** Ажилтан удирдах эрхтэй эсэх — ахлах, менежер, админ, хөгжүүлэгч. */
create or replace function public.can_manage_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_rank() >= 1;
$$;

grant execute on function public.can_manage_staff() to authenticated;

/**
 * Хөгжүүлэгчийн ТУСГАЙЛАН нээсэн эрх (`profiles.permissions`) шалгана.
 *
 * Эрхийн ТҮВШИН хүрэхгүй ч хөгжүүлэгч хүн тус бүр дээр эрх нээж болно
 * (жишээ нь тодорхой нэг админд хэлтэс үүсгэх эрх өгөх). Хөгжүүлэгч өөрөө
 * үргэлж тийм.
 */
create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin()
    or coalesce(
      (select (p.permissions ->> p_key)::boolean
         from public.profiles p
        where p.id = auth.uid()),
      false
    );
$$;

grant execute on function public.has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. departments — RLS
-- ---------------------------------------------------------------------------
alter table public.departments enable row level security;

-- Харах: нэвтэрсэн бүх хүн (хэлтсийн нэрийг профайл дээр харуулна).
drop policy if exists "departments_select" on public.departments;
create policy "departments_select" on public.departments
  for select to authenticated
  using (true);

-- Үүсгэх/засах/устгах: ЗӨВХӨН ХӨГЖҮҮЛЭГЧ (sysadmin).
--
-- Хэлтэс бол эрхийн хил — түүнийг үүсгэх, тэр хэлтсийн менежерийг
-- томилохыг нэг л газраас (хөгжүүлэгч) хийнэ. Менежер, ахлах нь
-- зөвхөн ӨӨРИЙН хэлтэст ажилтнаа нэмнэ.
--
-- Шаардлагатай бол хөгжүүлэгч тодорхой нэг хүнд `departments` эрхийг
-- тусгайлан нээж өгч болно (`profiles.permissions`).
drop policy if exists "departments_write" on public.departments;
create policy "departments_write" on public.departments
  for all to authenticated
  using (public.has_permission('departments'))
  with check (public.has_permission('departments'));

grant select on public.departments to authenticated;
grant insert, update, delete on public.departments to authenticated;

-- ---------------------------------------------------------------------------
-- 7. inventory — хэлтсээр хязгаарлах
-- ---------------------------------------------------------------------------
-- migration_inventory_admin_only_issue.sql нь бичих эрхийг агуулахын
-- эрхтэйгээр хязгаарласан. Энд дээр нь ХЭЛТСИЙН хамрах хүрээг нэмнэ.
alter table public.inventory enable row level security;

drop policy if exists "inventory_all"    on public.inventory;
drop policy if exists "inventory_select" on public.inventory;
create policy "inventory_select" on public.inventory
  for select to authenticated
  using (public.dept_in_scope(department_id));

drop policy if exists "inventory_write" on public.inventory;
create policy "inventory_write" on public.inventory
  for all to authenticated
  using (public.can_manage_inventory() and public.dept_in_scope(department_id))
  with check (public.can_manage_inventory() and public.dept_in_scope(department_id));

-- ---------------------------------------------------------------------------
-- 8. Ажилтны жагсаалт — хэлтсээр шүүнэ
-- ---------------------------------------------------------------------------
-- `create or replace` нь буцаах төрлийг өөрчилж чадахгүй тул эхлээд drop.
drop function if exists public.admin_list_authorized_users();

create function public.admin_list_authorized_users()
returns table (
  record_id text,
  user_id uuid,
  email text,
  name text,
  last_name text,
  "position" text,   -- PostgreSQL-ийн нөөцлөгдсөн үг тул хашилттай
  phone text,
  address text,
  role text,
  registered boolean,
  created_at timestamptz,
  avatar_url text,
  latitude double precision,
  longitude double precision,
  last_seen timestamptz,
  -- ↓ шинээр нэмэгдсэн
  department_id uuid,
  department_name text,
  department_kind text,
  permissions jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_rank int;
  actor_dept uuid;
begin
  -- ⚠️ Хүснэгтийг ЗААВАЛ ХОЧООР тодотгоно (`p.role`). `returns table` дэх
  --    нэрс нь гаралтын параметр болдог тул тодотголгүй бичвэл PostgreSQL
  --    хоёрдмол утгатай гэж үзэж функцийг унагаана.
  select p.role, p.department_id
    into actor_role, actor_dept
  from public.profiles p where p.id = auth.uid();

  actor_rank := public.role_rank(actor_role);
  -- Ахлах, менежер ч ажилтнуудаа хардаг — зөвхөн ӨӨРИЙН хэлтсийнхээ.
  if actor_rank < 1 then
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
    a.created_at,
    p.avatar_url,
    p.latitude,
    p.longitude,
    p.last_seen,
    coalesce(p.department_id, a.department_id),
    d.name,
    d.kind,
    coalesce(p.permissions, '{}'::jsonb)
  from public.authorized_users a
  left join public.profiles p    on p.id = a.linked_user_id
  left join public.departments d on d.id = coalesce(p.department_id, a.department_id)
  where a.active
    -- Зэрэглэл: өөрөөсөө доошхыг л харна (хөгжүүлэгч бүгдийг).
    and (actor_role = 'superadmin' or public.role_rank(a.role) < actor_rank)
    -- Хэлтэс: харьяалалтай хүн зөвхөн өөрийн хэлтсийнхнийг харна.
    and (
      actor_role = 'superadmin'
      or actor_dept is null
      or coalesce(p.department_id, a.department_id) = actor_dept
    )
  order by a.created_at;
end;
$$;

revoke execute on function public.admin_list_authorized_users() from public, anon;
grant  execute on function public.admin_list_authorized_users() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Gmail зөвшөөрөх — хэлтэстэй нь
-- ---------------------------------------------------------------------------
-- Шинэ параметр нэмэхийн тулд хуучин 7-параметрт хувилбарыг устгана.
-- Хоёулаа зэрэг оршвол 7 нэртэй аргументаар дуудахад PostgreSQL аль
-- функцийг сонгохоо мэдэхгүй (`ambiguous`) алдаа өгнө.
drop function if exists public.admin_authorize_gmail(text, text, text, text, text, text, text);

create function public.admin_authorize_gmail(
  p_email text,
  p_name text,
  p_last_name text default null,
  p_position text default null,
  p_phone text default null,
  p_address text default null,
  p_role text default 'employee',
  p_department_id uuid default null
)
returns public.authorized_users
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role       text;
  actor_rank       int;
  actor_dept       uuid;
  normalized_email text := lower(trim(coalesce(p_email, '')));
  safe_role        text := lower(coalesce(p_role, 'employee'));
  safe_dept        uuid := p_department_id;
  existing_user_id uuid;
  result           public.authorized_users%rowtype;
begin
  select p.role, p.department_id
    into actor_role, actor_dept
  from public.profiles p where p.id = auth.uid();

  actor_rank := public.role_rank(actor_role);
  if actor_rank < 1 then
    raise exception 'forbidden';
  end if;

  if normalized_email = '' or position('@' in normalized_email) <= 1 then
    raise exception 'invalid_email';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'name_required';
  end if;
  if safe_role not in ('employee', 'ahlah', 'menejer', 'admin', 'superadmin') then
    raise exception 'invalid_role';
  end if;

  -- ЭРХ ОЛГОХ ДҮРЭМ: админ ч, ахлах ч ЗӨВХӨН ажилтан нэмнэ.
  -- Ахлах/админ/хөгжүүлэгч эрхийг зөвхөн хөгжүүлэгч олгоно.
  if actor_role <> 'superadmin' and safe_role <> 'employee' then
    raise exception 'role_forbidden';
  end if;

  -- ХЭЛТСИЙН ДҮРЭМ: харьяалалтай хүн зөвхөн ӨӨРИЙН хэлтэст нэмнэ.
  if actor_dept is not null then
    if safe_dept is null then
      safe_dept := actor_dept;
    elsif safe_dept <> actor_dept then
      raise exception 'department_forbidden';
    end if;
  end if;

  if safe_dept is not null
     and not exists (select 1 from public.departments d where d.id = safe_dept) then
    raise exception 'department_not_found';
  end if;

  select u.id into existing_user_id
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;

  insert into public.authorized_users (
    email, linked_user_id, name, last_name, position, phone, address,
    role, department_id, active, added_by
  ) values (
    normalized_email,
    existing_user_id,
    trim(p_name),
    nullif(trim(coalesce(p_last_name, '')), ''),
    nullif(trim(coalesce(p_position, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    safe_role,
    safe_dept,
    true,
    auth.uid()
  )
  on conflict (email) do update set
    linked_user_id = coalesce(public.authorized_users.linked_user_id, excluded.linked_user_id),
    name           = excluded.name,
    last_name      = excluded.last_name,
    position       = excluded.position,
    phone          = excluded.phone,
    address        = excluded.address,
    role           = excluded.role,
    department_id  = excluded.department_id,
    active         = true,
    updated_at     = now()
  returning * into result;

  -- Аль хэдийн нэвтэрсэн хүн бол профайл дээр нь хэлтсийг нь тавина.
  if result.linked_user_id is not null then
    update public.profiles p
       set department_id = result.department_id
     where p.id = result.linked_user_id;
  end if;

  return result;
end;
$$;

revoke execute on function public.admin_authorize_gmail(text, text, text, text, text, text, text, uuid) from public, anon;
grant  execute on function public.admin_authorize_gmail(text, text, text, text, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Хэлтэс оноох
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_department(
  target_id uuid,
  p_department_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id    uuid := auth.uid();
  actor_role  text;
  actor_rank  int;
  actor_dept  uuid;
  target_role text;
  target_email text;
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;

  select p.role, p.department_id into actor_role, actor_dept
  from public.profiles p where p.id = actor_id;
  if actor_role is null then raise exception 'no_profile'; end if;

  actor_rank := public.role_rank(actor_role);
  if actor_rank < 1 then raise exception 'forbidden'; end if;

  select p.role, p.email into target_role, target_email
  from public.profiles p where p.id = target_id;
  if target_role is null then raise exception 'target_not_found'; end if;

  -- Өөрөөсөө дээш/тэнцүү зэрэглэлтэй хүнийг зөөхгүй.
  if actor_role <> 'superadmin'
     and public.role_rank(target_role) >= actor_rank then
    raise exception 'forbidden_target';
  end if;

  -- Харьяалалтай удирдагч зөвхөн ӨӨРИЙН хэлтэс рүү зөөнө / хэлтсээсээ хасна.
  if actor_dept is not null
     and p_department_id is not null
     and p_department_id <> actor_dept then
    raise exception 'department_forbidden';
  end if;

  if p_department_id is not null
     and not exists (select 1 from public.departments d where d.id = p_department_id) then
    raise exception 'department_not_found';
  end if;

  update public.profiles p
     set department_id = p_department_id
   where p.id = target_id;

  update public.authorized_users a
     set department_id = p_department_id, updated_at = now()
   where a.linked_user_id = target_id
      or lower(trim(a.email)) = lower(trim(coalesce(target_email, '')));

  return jsonb_build_object('id', target_id, 'department_id', p_department_id, 'by', actor_id);
end;
$$;

revoke execute on function public.admin_set_user_department(uuid, uuid) from public, anon;
grant  execute on function public.admin_set_user_department(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Нарийвчилсан эрх тохируулах — ЗӨВХӨН хөгжүүлэгч
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_permissions(
  target_id uuid,
  p_permissions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(coalesce(p_permissions, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_permissions';
  end if;

  update public.profiles p
     set permissions = coalesce(p_permissions, '{}'::jsonb)
   where p.id = target_id;

  if not found then raise exception 'target_not_found'; end if;

  return jsonb_build_object('id', target_id, 'permissions', coalesce(p_permissions, '{}'::jsonb));
end;
$$;

revoke execute on function public.admin_set_user_permissions(uuid, jsonb) from public, anon;
grant  execute on function public.admin_set_user_permissions(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Устгах / зөвшөөрөл цуцлах — ахлахад хэлтсийнх нь хүрээнд нээх
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
  actor_rank   int;
  actor_dept   uuid;
  target_role  text;
  target_dept  uuid;
  target_email text;
  superadmins  int;
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;

  select p.role, p.department_id into actor_role, actor_dept
  from public.profiles p where p.id = actor_id;
  if actor_role is null then raise exception 'no_profile'; end if;

  actor_rank := public.role_rank(actor_role);
  -- Ахлах, менежер ажилтнаа хасаж чадна — доор ХЭЛТСЭЭР нь хязгаарлана.
  if actor_rank < 1 then raise exception 'forbidden'; end if;

  if actor_id = target_id then raise exception 'cannot_delete_self'; end if;

  select p.role, p.email, p.department_id
    into target_role, target_email, target_dept
  from public.profiles p where p.id = target_id;
  if target_role is null then raise exception 'target_not_found'; end if;

  -- ЗӨВХӨН өөрөөсөө доош зэрэглэлтэйг устгана.
  if public.role_rank(target_role) >= actor_rank and actor_role <> 'superadmin' then
    raise exception 'forbidden_target';
  end if;

  -- Харьяалалтай удирдагч зөвхөн ӨӨРИЙН хэлтсийн хүнийг устгана.
  if actor_dept is not null and coalesce(target_dept, actor_dept) <> actor_dept then
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


create or replace function public.admin_revoke_authorization(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id   uuid := auth.uid();
  actor_role text;
  actor_rank int;
  actor_dept uuid;
  target     public.authorized_users%rowtype;
  norm_email text := lower(trim(p_email));
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;

  select p.role, p.department_id into actor_role, actor_dept
  from public.profiles p where p.id = actor_id;

  actor_rank := public.role_rank(actor_role);
  if actor_rank < 1 then raise exception 'forbidden'; end if;

  select * into target from public.authorized_users where email = norm_email;
  if target.email is null then raise exception 'target_not_found'; end if;

  -- Аль хэдийн нэвтэрсэн бол энэ функц биш, admin_delete_user ашиглана
  if target.linked_user_id is not null then raise exception 'already_linked'; end if;

  -- Зөвхөн өөрөөсөө доош зэрэглэлтэйг цуцална
  if actor_role <> 'superadmin'
     and public.role_rank(target.role) >= actor_rank then
    raise exception 'forbidden_target';
  end if;

  if actor_dept is not null and coalesce(target.department_id, actor_dept) <> actor_dept then
    raise exception 'forbidden_target';
  end if;

  update public.authorized_users set active = false where email = norm_email;

  return jsonb_build_object('revoked', norm_email, 'by', actor_id);
end;
$$;

revoke execute on function public.admin_revoke_authorization(text) from public, anon;
grant  execute on function public.admin_revoke_authorization(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Эрх солих — `ahlah`, `menejer`-г зөвшөөрөгдөх утгад нэмэх
-- ---------------------------------------------------------------------------
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
  if new_role not in ('employee', 'ahlah', 'menejer', 'admin', 'superadmin') then
    raise exception 'invalid_role';
  end if;

  select p.role into actor_role from public.profiles p where p.id = actor_id;
  -- Эрх солих нь удирдлагын үйлдэл хэвээр — ахлах эрх солихгүй.
  if public.role_rank(actor_role) < 3 then raise exception 'forbidden'; end if;

  select p.role into target_role from public.profiles p where p.id = target_id;
  if target_role is null then raise exception 'target_not_found'; end if;

  -- ⚠️ УДИРДАХ ЭРХИЙГ ЗӨВХӨН ХӨГЖҮҮЛЭГЧ ОЛГОНО.
  --    Ахлах, менежер, админ, хөгжүүлэгч эрхийг хөгжүүлэгч л томилно.
  --    Бусад нь зөвхөн "Ажилтан" болгож буулгаж чадна. Ингэснээр админ
  --    өөртэйгөө дүйцэх эрхтэй хүн үржүүлэх зам хаагдана.
  if actor_role <> 'superadmin' then
    if new_role <> 'employee' then
      raise exception 'role_forbidden';
    end if;
    if public.role_rank(target_role) >= public.role_rank(actor_role) then
      raise exception 'forbidden_target';
    end if;
  end if;

  if target_role = 'superadmin' and new_role <> 'superadmin' then
    select count(*) into superadmins from public.profiles where role = 'superadmin';
    if superadmins <= 1 then raise exception 'last_superadmin'; end if;
  end if;

  update public.profiles          set role = new_role where id = target_id;
  update public.authorized_users  set role = new_role where linked_user_id = target_id;

  return jsonb_build_object('id', target_id, 'role', new_role, 'by', actor_id);
end;
$$;

revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
grant  execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Анх нэвтрэхэд хэлтсийг профайл руу зөөх
-- ---------------------------------------------------------------------------
create or replace function public.claim_authorized_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  account  auth.users%rowtype;
  approved public.authorized_users%rowtype;
  result   public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into account from auth.users where id = uid;
  select * into approved
  from public.authorized_users
  where email = lower(trim(account.email))
    and active;

  if not found then
    raise exception 'gmail_not_authorized';
  end if;

  insert into public.profiles (
    id, email, name, last_name, role, position, phone, address,
    department_id, must_change_password
  ) values (
    uid,
    approved.email,
    approved.name,
    approved.last_name,
    approved.role,
    approved.position,
    approved.phone,
    approved.address,
    approved.department_id,
    false
  )
  on conflict (id) do update set
    email         = excluded.email,
    name          = coalesce(public.profiles.name, excluded.name),
    last_name     = coalesce(public.profiles.last_name, excluded.last_name),
    position      = coalesce(public.profiles.position, excluded.position),
    phone         = coalesce(public.profiles.phone, excluded.phone),
    address       = coalesce(public.profiles.address, excluded.address),
    role          = approved.role,
    -- Хэлтсийн эх сурвалж нь `authorized_users` (админ тэндээс оноодог).
    -- Хоосон байвал профайл дээрхийг хэвээр үлдээнэ.
    department_id = coalesce(approved.department_id, public.profiles.department_id),
    must_change_password = false
  returning * into result;

  update public.authorized_users
  set linked_user_id = uid, updated_at = now()
  where email = approved.email;

  return result;
end;
$$;

revoke execute on function public.claim_authorized_profile() from public, anon;
grant  execute on function public.claim_authorized_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- 15. Багана түвшний хамгаалалт
-- ---------------------------------------------------------------------------
-- 20260811110100_profiles_column_grants.sql нь `role`, `email` баганыг
-- хэрэглэгчийн шууд UPDATE-аас хаасан. Шинэ хоёр багана нь мөн адил
-- эмзэг: `department_id` (өөрийгөө өөр хэлтэс рүү зөөх) ба `permissions`
-- (өөртөө эрх нэмэх). Тиймээс хамгаалагдсан жагсаалтад оруулна.
do $$
declare
  protected text[] := array['id', 'role', 'email', 'created_at', 'department_id', 'permissions'];
  cols text;
begin
  revoke update on public.profiles from authenticated;

  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and not (column_name = any(protected));

  if cols is null then
    raise exception 'profiles хүснэгт олдсонгүй';
  end if;

  execute format('grant update (%s) on public.profiles to authenticated', cols);
  raise notice 'profiles: update эрх дараах баганууд дээр олгогдлоо — %', cols;
end;
$$;

notify pgrst, 'reload schema';
