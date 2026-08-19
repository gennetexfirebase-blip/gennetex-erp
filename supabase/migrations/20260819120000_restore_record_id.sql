-- ---------------------------------------------------------------------------
-- `admin_list_authorized_users` — `record_id` баганын нэрийг СЭРГЭЭНЭ
-- ---------------------------------------------------------------------------
--
-- ⚠️ РЕГРЕСС:
--   20260819100000_employment_status.sql дотор функцийг дахин үүсгэхдээ
--   эхний баганыг `record_id` -> `id` гэж САНАМСАРГҮЙ нэрлэсэн байв.
--
--   Клиентүүд `record_id`-г уншдаг:
--     src/services/authService.js:157   id: item.record_id
--     admin-web/index.html:824          id: w.record_id
--
--   Тиймээс мөр бүрийн `id` нь `undefined` болж, дараах зүйл эвдэрсэн:
--     • `editId` хоосон -> засах цонхны "Ажлын байдал" блок харагдахгүй
--     • `canDeleteProfile` -> false -> устгах товч гарахгүй
--     • FlatList-ийн keyExtractor хоосон -> "unique key" анхааруулга
--
--   Клиентийг өөрчлөхийн оронд баганын нэрийг сэргээх нь зөв: хуучин
--   хувилбар суулгасан утаснууд ч мөн адил `record_id` хүлээж байгаа.
--   Багана нэрлэх нь ГЭРЭЭ — түүнийг өөрчлөхөд бүх хэрэглэгч эвдэрнэ.
--
-- `active` багана хэвээр үлдэнэ (ажлаас гарсан эсэх).
-- ---------------------------------------------------------------------------

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
  pin_set_at timestamptz,
  pin_reset_required boolean,
  active boolean
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
    coalesce(p.pin_reset_required, false),
    coalesce(a.active, false)
  from public.authorized_users a
  left join public.profiles p    on p.id = a.linked_user_id
  left join public.departments d on d.id = coalesce(p.department_id, a.department_id)
  where (actor_role = 'superadmin' or public.role_rank(a.role) < actor_rank)
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
