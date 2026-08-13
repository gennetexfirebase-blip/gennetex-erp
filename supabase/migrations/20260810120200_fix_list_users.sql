-- ============================================================================
-- ЗАСВАР: admin_list_authorized_users хоёрдмол утгаас болж унаж байсан
-- ============================================================================
--
-- Өмнөх migration-д `select role into actor_role from public.profiles ...`
-- гэж бичсэн. Гэтэл `returns table (... role text ...)` нь `role`-ыг
-- ГАРАЛТЫН ПАРАМЕТР болгодог тул PostgreSQL дараах алдаа шидэж, функц
-- бүхэлдээ унадаг байв:
--
--   column reference "role" is ambiguous
--
-- Үр дүнд нь апп дээр "Ажилчид" болон "Ажилтан бүртгэх" хэсэг ХООСОН
-- харагдаж байсан.
--
-- Засвар: хүснэгтийг хочоор тодотгоно (`p.role`) — эх функц ингэж бичсэн байв.
-- ============================================================================

create or replace function public.admin_list_authorized_users()
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
  -- Хүснэгтийг ЗААВАЛ хочоор тодотгоно — дээрх тайлбарыг үзнэ үү.
  select p.role into actor_role from public.profiles p where p.id = auth.uid();
  actor_rank := public.role_rank(actor_role);

  -- Удирдлагын эрх = админаас дээш (admin=3, zahiral=4, superadmin=5)
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
    coalesce(p."position", a."position"),
    coalesce(p.phone, a.phone),
    coalesce(p.address, a.address),
    a.role,
    a.linked_user_id is not null,
    a.created_at
  from public.authorized_users a
  left join public.profiles p on p.id = a.linked_user_id
  where a.active
    -- Хөгжүүлэгч БҮГДИЙГ харна (өөр хөгжүүлэгчдийг ч).
    -- Бусад нь зөвхөн өөрөөсөө доош зэрэглэлтэйг.
    and (actor_role = 'superadmin' or public.role_rank(a.role) < actor_rank)
  order by a.created_at;
end;
$$;

revoke execute on function public.admin_list_authorized_users() from public, anon;
grant  execute on function public.admin_list_authorized_users() to authenticated;

notify pgrst, 'reload schema';
