-- ---------------------------------------------------------------------------
-- Ажилтан бүртгэх эрхийг хэлтсээр хязгаарлах
-- ---------------------------------------------------------------------------
--
-- АСУУДАЛ:
--   `admin_authorize_gmail` нь хэлтсийн шалгалттай боловч ЗӨВХӨН тухайн
--   хүнд хэлтэс оноогдсон үед ажилладаг байв:
--
--       if actor_dept is not null then ... end if;
--
--   Хэлтэс оноогоогүй админ нь энэ шалгалтыг бүхэлд нь ТОЙРЧ, дурын
--   хэлтэст, эсвэл хэлтэсгүйгээр ажилтан нэмж чаддаг байсан. Өөрөөр
--   хэлбэл хамгаалалт нь оноолгүй үлдсэн хүн дээр огт үйлчлэхгүй.
--
--   Мөн `has_permission('employees')` эрх байсан ч энэ функц түүнийг
--   огт шалгадаггүй байв — эрхийг унтраасан ч ажилтан нэмэгдсээр байна.
--
-- ШИНЭ ДҮРЭМ:
--   • Хөгжүүлэгч (superadmin) — хязгааргүй, дурын хэлтэст нэмнэ
--   • Бусад бүгд:
--       1. `employees` эрхтэй байх ЁСТОЙ  (хөгжүүлэгч олгоно)
--       2. хэлтэст харьяалагдсан байх ЁСТОЙ (хөгжүүлэгч оноож өгнө)
--       3. зөвхөн ӨӨРИЙН хэлтэст, зөвхөн `employee` эрхээр нэмнэ
--
-- ⚠️ ЭНЭ НЬ ЗАН ТӨЛӨВИЙГ ӨӨРЧИЛНӨ:
--    Одоо хэлтэс оноогоогүй, эсвэл `employees` эрхгүй админ ажилтан
--    нэмэх боломжгүй болно. Хөгжүүлэгч эхлээд хэлтэс болон эрхийг нь
--    оноож өгөх шаардлагатай. Энэ нь зориудын — эрхийг нэг цэгээс
--    удирдана.
-- ---------------------------------------------------------------------------

create or replace function public.admin_authorize_gmail(
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
  is_dev           boolean := public.is_superadmin();
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

  if is_dev then
    -- Хөгжүүлэгч — хязгааргүй. Хэлтэс заагаагүй бол хэлтэсгүй нэмнэ.
    null;
  else
    -- ЭРХ: `employees` эрхийг хөгжүүлэгч олгосон байх ёстой.
    if not public.has_permission('employees') then
      raise exception 'permission_denied';
    end if;

    -- ЭРХ ОЛГОХ ДҮРЭМ: зөвхөн энгийн ажилтан нэмнэ.
    -- Ахлах/менежер/админ эрхийг зөвхөн хөгжүүлэгч олгоно.
    if safe_role <> 'employee' then
      raise exception 'role_forbidden';
    end if;

    -- ХАРЬЯАЛАЛ: хэлтэсгүй хүн ажилтан нэмэхгүй.
    -- Урьд нь энэ тохиолдолд шалгалт бүхэлдээ алгасагддаг байв.
    if actor_dept is null then
      raise exception 'department_required';
    end if;

    -- Зөвхөн ӨӨРИЙН хэлтэст.
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
-- Ажилтныг хасах нь мөн адил хамрах хүрээтэй байх ЁСТОЙ.
--
-- Нэмэх эрхийг хэлтсээр хязгаарлаад хасах эрхийг нээлттэй үлдээвэл
-- хамгаалалт утгагүй болно — энгийн админ өөр хэлтсийн ажилтныг
-- цуцалж чадах хэвээр байна. `admin_revoke_authorization` дээр
-- хэлтсийн шалгалт огт байгаагүй.
-- ---------------------------------------------------------------------------
create or replace function public.admin_revoke_authorization(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id    uuid := auth.uid();
  actor_role  text;
  actor_dept  uuid;
  target      public.authorized_users%rowtype;
  norm_email  text := lower(trim(p_email));
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

  -- Аль хэдийн нэвтэрсэн бол энэ функц биш, admin_delete_user ашиглана
  if target.linked_user_id is not null then
    raise exception 'already_linked';
  end if;

  if not public.is_superadmin() then
    if not public.has_permission('employees') then
      raise exception 'permission_denied';
    end if;

    -- Энгийн админ зөвхөн ажилтны зөвшөөрлийг цуцална
    if target.role <> 'employee' then
      raise exception 'forbidden_target';
    end if;

    -- ЗӨВХӨН ӨӨРИЙН хэлтэс
    if actor_dept is null then
      raise exception 'department_required';
    end if;
    if target.department_id is distinct from actor_dept then
      raise exception 'department_forbidden';
    end if;
  end if;

  update public.authorized_users set active = false where email = norm_email;

  return jsonb_build_object('revoked', norm_email, 'by', actor_id);
end;
$$;

revoke execute on function public.admin_revoke_authorization(text) from public, anon;
grant  execute on function public.admin_revoke_authorization(text) to authenticated;
