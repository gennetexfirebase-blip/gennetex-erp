-- ---------------------------------------------------------------------------
-- Ажлаас гаргах эрхийн дүрэм
-- ---------------------------------------------------------------------------
--
-- ШААРДЛАГА:
--   • Хөгжүүлэгч  — бүгдийг ажлаас гаргаж, устгана
--   • Админ       — админ ба ажилтныг гаргана, ХӨГЖҮҮЛЭГЧИЙГ БОЛОХГҮЙ
--   • Хэн ч       — ӨӨРИЙГӨӨ гаргахгүй (хөгжүүлэгч ч мөн адил)
--
-- ЯАГААД ӨӨРЧЛӨВ:
--   Өмнөх хувилбар нь энгийн админд ЗӨВХӨН `employee` эрхтэй хүнийг
--   зөвшөөрдөг байв. Тиймээс админ өөр админыг ажлаас гаргаж чадахгүй
--   байсан.
--
-- ХЭЛТСИЙН ХИЛ ЯАГААД ЗӨВХӨН АЖИЛТАНД ВЭ:
--   Ажилтан хэлтэст харьяалагддаг тул "өөрийн хэлтсийн ажилтан" гэсэн
--   хил утга учиртай. Харин админ, менежер зэрэг удирдлагад ихэвчлэн
--   хэлтэс оноогддоггүй — тэдэнд хэлтсийн шалгалт тавибал ямар ч админ
--   өөр админыг гаргаж чадахгүй болно.
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
  actor_rank int;
  actor_dept uuid;
  target     public.authorized_users%rowtype;
  norm_email text := lower(trim(coalesce(p_email, '')));
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select role, department_id into actor_role, actor_dept
  from public.profiles where id = actor_id;

  actor_rank := public.role_rank(actor_role);
  if actor_rank < 1 then
    raise exception 'forbidden';
  end if;

  select * into target from public.authorized_users where email = norm_email;
  if target.email is null then
    raise exception 'target_not_found';
  end if;

  -- ӨӨРИЙГӨӨ гаргахгүй — хөгжүүлэгч ч мөн адил. Гаргавал эргэж нэвтэрч
  -- чадахгүй болж, өөр хөгжүүлэгчгүй бол систем удирдлагагүй үлдэнэ.
  if target.linked_user_id = actor_id then
    raise exception 'cannot_change_self';
  end if;

  if not public.is_superadmin() then
    if not public.has_permission('employees') then
      raise exception 'permission_denied';
    end if;

    -- ХӨГЖҮҮЛЭГЧИЙГ хэн ч гаргахгүй — зөвхөн өөр хөгжүүлэгч.
    if target.role = 'superadmin' then
      raise exception 'forbidden_target';
    end if;

    if target.role = 'employee' then
      -- Ажилтан хэлтэст харьяалагддаг — зөвхөн өөрийн хэлтсийнхийг.
      if actor_dept is null then
        raise exception 'department_required';
      end if;
      if target.department_id is distinct from actor_dept then
        raise exception 'department_forbidden';
      end if;
    else
      -- Удирдлага (ахлах, менежер, админ) — зөвхөн админ болон дээш нь.
      if actor_rank < 3 then
        raise exception 'forbidden_target';
      end if;
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
