-- ============================================================================
-- Төхөөрөмжийн PIN — ХӨГЖҮҮЛЭГЧИЙН ХЯНАЛТ
-- ============================================================================
--
-- ОДООГИЙН БАЙДАЛ:
--   4 оронтой PIN-ийн hash нь ЗӨВХӨН төхөөрөмж дээр (SecureStore) хадгалагдана.
--   Тиймээс офлайн ч нээгддэг, сервер рүү нууц үг явдаггүй.
--
-- АСУУДАЛ:
--   Хөгжүүлэгч (sysadmin) хэн PIN тохируулсныг, хэн мартсаныг харах арга
--   байхгүй байв. Ажилтан PIN-ээ мартвал апп-аа бүрэн устгахаас өөр зам
--   байхгүй болно.
--
-- ШИЙДЭЛ — НУУЦЫГ БИШ, ТӨЛӨВИЙГ хадгална:
--   • `pin_set_at`          — PIN хэзээ тохируулсан
--   • `pin_updated_at`      — сүүлд хэзээ солисон
--   • `pin_reset_required`  — хөгжүүлэгч "дахин тохируул" гэж тавьсан туг
--
--   ⚠️ PIN буюу түүний hash-ийг сервер рүү ХЭЗЭЭ Ч илгээхгүй. Хөгжүүлэгч
--      хэн нэгний PIN-ийг УНШИЖ чадахгүй — зөвхөн "дахин тохируулуул" гэж
--      шаардана. Ингэснээр хяналт бий болж, дүр эсгэх (impersonation)
--      боломж үүсэхгүй.
--
-- ХАМААРАЛ: 20260817090000_departments_manager_permissions.sql
-- ============================================================================

alter table public.profiles
  add column if not exists pin_set_at timestamptz,
  add column if not exists pin_updated_at timestamptz,
  add column if not exists pin_reset_required boolean not null default false;

-- ---------------------------------------------------------------------------
-- 1. Хэрэглэгч өөрийн PIN-ийн ТӨЛӨВийг мэдэгдэнэ
-- ---------------------------------------------------------------------------
-- Багана түвшинд `pin_*`-д шууд бичих эрх байхгүй (profiles column grants),
-- тиймээс энэ функцээр л шинэчилнэ. Функц нь ЗӨВХӨН дуудсан хүнийхээ
-- мөрийг засна — өөр хүнийхийг хөндөх аргагүй.
create or replace function public.set_my_pin_state(p_has_pin boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  if p_has_pin then
    update public.profiles p
       set pin_set_at = coalesce(p.pin_set_at, now()),
           pin_updated_at = now(),
           -- Шинэ PIN тавьсан тул шаардлага биелэгдлээ.
           pin_reset_required = false
     where p.id = uid;
  else
    update public.profiles p
       set pin_set_at = null,
           pin_updated_at = now()
     where p.id = uid;
  end if;

  return jsonb_build_object('id', uid, 'has_pin', p_has_pin);
end;
$$;

revoke execute on function public.set_my_pin_state(boolean) from public, anon;
grant  execute on function public.set_my_pin_state(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Өөрийн PIN-ийн бодлогыг унших
-- ---------------------------------------------------------------------------
-- Түгжээний дэлгэц нээгдэхэд "надаас PIN дахин тохируулахыг шаардсан уу"
-- гэдгийг асууна. `profiles`-оос шууд уншиж ч болох ч тусад нь функц
-- болгосон нь: RLS өөрчлөгдсөн ч түгжээний дэлгэц эвдрэхгүй байх.
create or replace function public.my_pin_policy()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reset_required', coalesce(p.pin_reset_required, false),
    'set_at', p.pin_set_at,
    'updated_at', p.pin_updated_at
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.my_pin_policy() from public, anon;
grant  execute on function public.my_pin_policy() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Хөгжүүлэгч PIN-ийг дахин тохируулахыг шаардана
-- ---------------------------------------------------------------------------
-- Ажилтан PIN-ээ мартсан, эсвэл утас нь бусдын гарт орсон үед хэрэглэнэ.
-- Дараагийн удаа апп нээхэд хуучин PIN устаж, шинийг үүсгүүлнэ.
create or replace function public.admin_require_pin_reset(target_id uuid, p_required boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;
  -- ЗӨВХӨН хөгжүүлэгч. Энэ бол бүх хэрэглэгчийг хамарсан хяналт тул
  -- хэлтсийн удирдлагад нээхгүй.
  if not public.is_superadmin() then raise exception 'forbidden'; end if;

  update public.profiles p
     set pin_reset_required = coalesce(p_required, true)
   where p.id = target_id;

  if not found then raise exception 'target_not_found'; end if;

  return jsonb_build_object('id', target_id, 'reset_required', coalesce(p_required, true), 'by', actor_id);
end;
$$;

revoke execute on function public.admin_require_pin_reset(uuid, boolean) from public, anon;
grant  execute on function public.admin_require_pin_reset(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Ажилтны жагсаалтад PIN-ийн төлөвийг нэмэх
-- ---------------------------------------------------------------------------
-- `create or replace` нь буцаах төрлийг өөрчилж чадахгүй тул drop хийнэ.
drop function if exists public.admin_list_authorized_users();

create function public.admin_list_authorized_users()
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
  created_at timestamptz,
  avatar_url text,
  latitude double precision,
  longitude double precision,
  last_seen timestamptz,
  department_id uuid,
  department_name text,
  department_kind text,
  permissions jsonb,
  -- ↓ шинээр нэмэгдсэн (PIN хяналт)
  pin_set_at timestamptz,
  pin_reset_required boolean
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
  select p.role, p.department_id
    into actor_role, actor_dept
  from public.profiles p where p.id = auth.uid();

  actor_rank := public.role_rank(actor_role);
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
    coalesce(p.permissions, '{}'::jsonb),
    p.pin_set_at,
    coalesce(p.pin_reset_required, false)
  from public.authorized_users a
  left join public.profiles p    on p.id = a.linked_user_id
  left join public.departments d on d.id = coalesce(p.department_id, a.department_id)
  where a.active
    and (actor_role = 'superadmin' or public.role_rank(a.role) < actor_rank)
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

notify pgrst, 'reload schema';
