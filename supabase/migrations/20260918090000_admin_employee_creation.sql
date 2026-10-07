-- Allow regular admins to add employees across the organization, including
-- admins without an assigned department. Keep employee permission, role and
-- department restrictions for managers and team leads.
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

    -- Админ нь байгууллагын бүх хэлтсийн ажилтныг бүртгэнэ.
    -- Ахлах/менежерийн хувьд хэлтсийн хязгаарлалт хэвээр.
    if actor_rank >= 3 then
      if safe_dept is null then
        safe_dept := actor_dept;
      end if;
    else
      if actor_dept is null then
        raise exception 'department_required';
      end if;
      if safe_dept is null then
        safe_dept := actor_dept;
      elsif safe_dept <> actor_dept then
        raise exception 'department_forbidden';
      end if;
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

  -- An ordinary admin may add employees but must never overwrite the
  -- authorization or department of an existing manager/administrator.
  if not is_dev and (
    exists (
      select 1 from public.authorized_users au
      where au.email = normalized_email and au.role <> 'employee'
    ) or exists (
      select 1 from public.profiles p
      where p.id = existing_user_id and public.role_rank(p.role) > 0
    )
  ) then
    raise exception 'forbidden_target';
  end if;

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
