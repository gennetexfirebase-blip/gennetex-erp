-- ============================================================================
-- Эрхийн түвшинг 3 болгож хялбаршуулах
-- ============================================================================
--
-- ӨМНӨ: employee · nyrav · ahlah · admin · zahiral · superadmin  (6 түвшин)
-- ОДОО: employee · admin · superadmin                            (3 түвшин)
--
-- ШАЛТГААН:
--   `nyrav` (нярав), `ahlah` (ахлах), `zahiral` (захирал) нь ЭРХ биш,
--   АЛБАН ТУШААЛ юм. Тэдгээрийг эрхийн систем болгосноор:
--     • шинэ албан тушаал нэмэх бүрд эрхийн код дахин бичигдэнэ
--     • "нярав яагаад цалин харахгүй байна вэ" гэсэн будлиан үүснэ
--     • эрхийн шалгалт 6 өөр босготой болж алдаа гаргахад амархан
--   Албан тушаалыг `profiles.position` талбарт бичнэ — тэнд ямар ч
--   нэр байж болно, эрхэд нөлөөлөхгүй.
--
-- ⚠️ ЧУХАЛ ЗАРЧИМ — ТООН УТГЫГ ХЭВЭЭР ҮЛДЭЭВ:
--   Одоо байгаа функцууд `role_rank(...) >= 1` болон `>= 3` гэсэн
--   босго ашигладаг (box_*, account_deletion, admin_list_*, г.м).
--   Хэрэв шинэ шаталбарыг 0/1/2 болговол `>= 3` шалгалт хэнд ч
--   тохирохгүй болж БҮХ админы функц эвдэрнэ.
--
--   Тиймээс `admin` = 3, `superadmin` = 5 хэвээр үлдээж, зөвхөн
--   хуучин 3 нэрийг `admin`-ы түвшин рүү буулгав. Ингэснээр:
--     >= 1  → админ ба хөгжүүлэгч   (агуулах, хайрцаг)
--     >= 3  → админ ба хөгжүүлэгч   (ажилтан, цалин)
--   хоёулаа зөв ажиллана, нэг ч функц гар хүрэх шаардлагагүй.
-- ============================================================================

create or replace function public.role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p_role, ''))
    when 'superadmin' then 5
    when 'admin'      then 3
    -- Хуучин албан тушаал-эрхүүд — админтай ижил түвшин
    when 'zahiral'    then 3
    when 'ahlah'      then 3
    when 'nyrav'      then 3
    else 0
  end;
$$;

grant execute on function public.role_rank(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Өгөгдлийг шилжүүлэх
-- ---------------------------------------------------------------------------
-- Хуучин утгатай хэрэглэгчид үлдвэл клиент тал (`normalizeRole`) тэднийг
-- админ гэж үзэх боловч өгөгдлийн санд өөр утга байх нь дараа нь
-- будлиан үүсгэнэ. Нэг эх сурвалж руу авчирна.

do $$
declare
  v_profiles int;
  v_authorized int;
begin
  -- Эрхийн CHECK хязгаарлалт байвал эхлээд түр авна — эс тэгвээс
  -- шинэчлэлт хязгаарлалтад тулгарч унана.
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.authorized_users drop constraint if exists authorized_users_role_check;

  update public.profiles
     set role = 'admin'
   where role in ('nyrav', 'ahlah', 'zahiral');
  get diagnostics v_profiles = row_count;

  update public.authorized_users
     set role = 'admin'
   where role in ('nyrav', 'ahlah', 'zahiral');
  get diagnostics v_authorized = row_count;

  raise notice 'profiles: % мөр, authorized_users: % мөр админ болов', v_profiles, v_authorized;
end;
$$;

-- Одоо зөвхөн 3 утга зөвшөөрнө — буруу утга орохоос сэргийлнэ.
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('employee', 'admin', 'superadmin'));

alter table public.authorized_users
  add constraint authorized_users_role_check
  check (role in ('employee', 'admin', 'superadmin'));

-- ---------------------------------------------------------------------------
-- Хөгжүүлэгчийн эрхийг хамгийн дээд болгох
-- ---------------------------------------------------------------------------
-- `superadmin` нь бүх зүйлийг хийх ёстой: эрх олгох, устгах, бүх өгөгдөл
-- харах. Доорх функц нь дурын шалгалтад ашиглагдана.

create or replace function public.is_superadmin(p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = coalesce(p_user, auth.uid())
      and p.role = 'superadmin'
  );
$$;

grant execute on function public.is_superadmin(uuid) to authenticated;

-- `admin_set_user_role` нь зөвхөн 3 утгыг хүлээж авна.
-- Хуучин нэр илгээвэл ойлгомжтой алдаа өгнө — чимээгүй буруу эрх
-- олгохоос хамаагүй дээр.
create or replace function public.assert_valid_role(p_role text)
returns text
language plpgsql
immutable
as $$
begin
  if lower(coalesce(p_role, '')) not in ('employee', 'admin', 'superadmin') then
    raise exception 'invalid_role: % (зөвшөөрөгдөх: employee, admin, superadmin)', p_role;
  end if;
  return lower(p_role);
end;
$$;

grant execute on function public.assert_valid_role(text) to authenticated;
