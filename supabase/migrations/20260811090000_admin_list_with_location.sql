-- ============================================================================
-- Админы ажилтны жагсаалтад байршил нэмэх
-- ============================================================================
--
-- АЛДАА: admin-web-ийн "Real-time байршил" газрын зураг ХООСОН байсан.
--
-- ШАЛТГААН: admin-web нь ажилтнуудаа `admin_list_authorized_users()`-ээс
--   авдаг болсон (өмнө нь `profiles`-оос шууд уншдаг байв). Тэр функц нь
--   зөвхөн бүртгэлийн талбаруудыг буцаадаг — `latitude`, `longitude`,
--   `last_seen`, `avatar_url` БАЙХГҮЙ. Газрын зураг нь
--   `w.latitude != null` гэж шүүдэг тул БҮХ ажилтан шүүгдэж хаягдаж,
--   нэг ч тэмдэг гарахгүй байв. Мөн ажилтны зураг ч алга болсон.
--
-- ЗАСВАР: дутуу 4 баганыг нэмнэ.
--
-- ⚠️ `create or replace function` нь буцаах ТӨРЛИЙГ өөрчилж чадахгүй тул
--    эхлээд drop хийх ёстой. Функцийг зөвхөн admin-web дуудна.
-- ============================================================================

drop function if exists public.admin_list_authorized_users();

create or replace function public.admin_list_authorized_users()
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
  -- ↓ шинээр нэмэгдсэн
  avatar_url text,
  latitude double precision,
  longitude double precision,
  last_seen timestamptz
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
  -- ⚠️ Хүснэгтийг ЗААВАЛ ХОЧООР тодотгоно (`p.role`). `returns table` дэх
  --    нэрс нь гаралтын параметр болдог тул тодотголгүй бичвэл PostgreSQL
  --    хоёрдмол утгатай гэж үзэж функцийг унагаана — үр дүнд нь ажилтны
  --    жагсаалт хоосон харагдана.
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
    a.created_at,
    p.avatar_url,
    p.latitude,
    p.longitude,
    p.last_seen
  from public.authorized_users a
  left join public.profiles p on p.id = a.linked_user_id
  where a.active
    and (actor_role = 'superadmin' or public.role_rank(a.role) < actor_rank)
  order by a.created_at;
end;
$$;

revoke execute on function public.admin_list_authorized_users() from public, anon;
grant  execute on function public.admin_list_authorized_users() to authenticated;
