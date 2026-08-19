-- ---------------------------------------------------------------------------
-- Ажлаас гаргах / буцааж авах
-- ---------------------------------------------------------------------------
--
-- ШААРДЛАГА:
--   Ажилтныг ажлаас гаргахад устгахгүй, "Ажлаас гарсан" хэсэгт шилжинэ.
--   Дахин ажилд орвол "Буцааж авах" дарахад БҮХ өмнөх өгөгдөл нь хэвээр
--   сэргэнэ. Ажлаас гарсан үед тэр хүн апп руу нэвтэрч чадахгүй.
--
-- ЯАГААД БАЙГАА ФУНКЦ ХАНГАЛТГҮЙ ВЭ:
--   `admin_revoke_authorization` нь `linked_user_id is not null` үед
--   `already_linked` алдаа шидэж зогсдог. Өөрөөр хэлбэл НЭГ Ч УДАА
--   нэвтэрсэн ажилтныг ажлаас гаргаж чадахгүй — яг л ажиллаж байсан
--   хүмүүсийг. Тиймээс тусдаа функц хэрэгтэй.
--
-- НЭВТРЭЛТ ХЭРХЭН ХААГДДАГ ВЭ:
--   `claim_authorized_profile` нь `authorized_users.active` шалгадаг
--   бөгөөд идэвхгүй үед `gmail_not_authorized` шидэнэ. Тэр функц нэвтрэх
--   бүрд ажилладаг тул `active = false` болмогц нэвтрэх боломжгүй болно.
--
-- ӨГӨГДӨЛ ЯАГААД АЛДАГДАХГҮЙ ВЭ:
--   Зөвхөн `active` тугийг л сольж байна. `profiles`, ирц, байршил,
--   багажны олголт зэрэг бүх түүх хөндөгдөхгүй. Буцааж авахад тэр чигээр
--   нь сэргэнэ.
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_employment(
  p_email text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id   uuid := auth.uid();
  actor_role text;
  actor_dept uuid;
  target     public.authorized_users%rowtype;
  norm_email text := lower(trim(coalesce(p_email, '')));
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select role, department_id into actor_role, actor_dept
  from public.profiles where id = actor_id;

  if public.role_rank(actor_role) < 1 then
    raise exception 'forbidden';
  end if;

  select * into target from public.authorized_users where email = norm_email;
  if target.email is null then
    raise exception 'target_not_found';
  end if;

  -- Өөрийгөө ажлаас гаргах нь эргэж нэвтэрч чадахгүй болгоно.
  if target.linked_user_id = actor_id then
    raise exception 'cannot_change_self';
  end if;

  if not public.is_superadmin() then
    if not public.has_permission('employees') then
      raise exception 'permission_denied';
    end if;

    -- Энгийн админ зөвхөн ажилтныг ажлаас гаргана. Ахлах, менежер,
    -- админыг гаргах нь эрхийн хилийг давсан үйлдэл.
    if target.role <> 'employee' then
      raise exception 'forbidden_target';
    end if;

    if actor_dept is null then
      raise exception 'department_required';
    end if;
    if target.department_id is distinct from actor_dept then
      raise exception 'department_forbidden';
    end if;
  end if;

  update public.authorized_users
     set active = coalesce(p_active, false),
         updated_at = now()
   where email = norm_email;

  return jsonb_build_object(
    'email', norm_email,
    'active', coalesce(p_active, false),
    'by', actor_id
  );
end;
$$;

revoke execute on function public.admin_set_employment(text, boolean) from public, anon;
grant  execute on function public.admin_set_employment(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Жагсаалт нь ажлаас гарсан хүнийг МӨН буцаана
--
-- Урьд нь `where a.active` гэж шүүдэг байсан тул ажлаас гаргамагц тэр
-- хүн жагсаалтаас бүрмөсөн алга болж, буцааж авах ямар ч зам үлддэггүй
-- байв. Одоо `active` тугийг хамт буцаана — клиент тал нь идэвхтэй,
-- ажлаас гарсан гэж хоёр хэсэг болгож харуулна.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_list_authorized_users();

create function public.admin_list_authorized_users()
returns table (
  id text,
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
  -- ↓ шинэ: ажилд байгаа эсэх
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
