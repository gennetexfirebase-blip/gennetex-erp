-- hr.gennetex.com — энгийн админ зөвхөн ОВОГ, НЭР, УТАС солино.
-- Албан тушаал, хаяг, хэлтэс, имэйлийг зөвхөн системийн админ (superadmin) солино.

create or replace function public.admin_update_employee(
  p_email         text,
  p_name          text,
  p_last_name     text default null,
  p_phone         text default null,
  p_position      text default null,
  p_address       text default null,
  p_department_id uuid default null,
  p_new_email     text default null
)
returns public.authorized_users
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_rank  int;
  is_dev      boolean := public.is_superadmin();
  key_email   text := lower(trim(coalesce(p_email, '')));
  new_email   text := nullif(lower(trim(coalesce(p_new_email, ''))), '');
  target      public.authorized_users%rowtype;
  clean_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g'), '');
  v_position  text;
  v_address   text;
  v_dept      uuid;
  result      public.authorized_users%rowtype;
begin
  select public.role_rank(p.role) into actor_rank from public.profiles p where p.id = auth.uid();
  if coalesce(actor_rank, 0) < 3 and not is_dev then
    raise exception 'forbidden';
  end if;
  if not is_dev and coalesce((select (p.permissions ->> 'employees')::boolean from public.profiles p where p.id = auth.uid()), true) = false then
    raise exception 'permission_denied';
  end if;

  select * into target from public.authorized_users a where lower(a.email) = key_email;
  if not found then
    raise exception 'not_found';
  end if;
  if not is_dev and target.role = 'superadmin' then
    raise exception 'role_forbidden';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'name_required';
  end if;

  if is_dev then
    v_position := nullif(trim(coalesce(p_position, '')), '');
    v_address := nullif(trim(coalesce(p_address, '')), '');
    v_dept := p_department_id;
    if v_dept is not null and not exists (select 1 from public.departments d where d.id = v_dept) then
      raise exception 'department_not_found';
    end if;
    if new_email is not null and new_email <> key_email then
      if target.linked_user_id is not null then raise exception 'email_locked'; end if;
      if position('@' in new_email) <= 1 then raise exception 'invalid_email'; end if;
      if exists (select 1 from public.authorized_users a where lower(a.email) = new_email) then raise exception 'email_taken'; end if;
    else
      new_email := null;
    end if;
  else
    -- Энгийн админ: бусад талбар хуучнаараа үлдэнэ.
    v_position := target.position;
    v_address := target.address;
    v_dept := target.department_id;
    new_email := null;
  end if;

  if clean_phone is not null and exists (
    select 1 from public.profiles p
    where p.phone = clean_phone and p.id is distinct from target.linked_user_id
  ) then
    raise exception 'phone_taken';
  end if;

  update public.authorized_users a
     set name = trim(p_name),
         last_name = nullif(trim(coalesce(p_last_name, '')), ''),
         phone = clean_phone,
         position = v_position,
         address = v_address,
         department_id = v_dept,
         email = coalesce(new_email, a.email),
         updated_at = now()
   where lower(a.email) = key_email
  returning * into result;

  if target.linked_user_id is not null then
    if is_dev then
      update public.profiles p
         set name = trim(p_name), last_name = nullif(trim(coalesce(p_last_name, '')), ''), phone = clean_phone,
             position = v_position, address = v_address, department_id = v_dept
       where p.id = target.linked_user_id;
    else
      update public.profiles p
         set name = trim(p_name), last_name = nullif(trim(coalesce(p_last_name, '')), ''), phone = clean_phone
       where p.id = target.linked_user_id;
    end if;
  end if;

  return result;
end;
$$;

notify pgrst, 'reload schema';
