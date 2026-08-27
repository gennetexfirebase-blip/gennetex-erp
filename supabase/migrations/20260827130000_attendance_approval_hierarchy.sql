-- ============================================================================
-- Ирц зөвшөөрөх ЭРХИЙН ШАТЛАЛ
-- ============================================================================
--
-- ДҮРЭМ:
--   1. Энгийн ажилтан зайнаас бүртгүүлбэл → `pending`, админ зөвшөөрнө.
--   2. Энгийн АДМИН зайнаас бүртгүүлбэл → мөн `pending`, гэхдээ түүнийг
--      зөвхөн ХӨГЖҮҮЛЭГЧ (superadmin) зөвшөөрнө. Админ өөрийгөө ч,
--      өөр админыг ч зөвшөөрөхгүй.
--   3. ХӨГЖҮҮЛЭГЧ (superadmin) хаанаас ч бүртгүүлнэ — зөвшөөрөл шаардахгүй,
--      шууд `approved`.
--
-- ЯАГААД TRIGGER ВЭ:
--   Төлөвийг клиент тал илгээдэг байсан тул хэн ч `status='approved'`
--   гэж явуулаад геофенсийг тойрч гарах боломжтой байв. Одоо серверийн
--   тал ЭЦСИЙН шийдвэрийг гаргана — клиентээс юу ирснээс үл хамаарна.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Оруулах үед төлөвийг албадан тогтооно
-- ---------------------------------------------------------------------------
create or replace function public.enforce_attendance_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_role text;
begin
  select p.role into owner_role
  from public.profiles p
  where p.id::text = new.staff_id;

  if coalesce(owner_role, 'employee') = 'superadmin' then
    -- Хөгжүүлэгч — байршлаас үл хамааран шууд баталгаажна.
    new.status := 'approved';
  elsif coalesce(new.is_remote, false) then
    -- Бусад бүх хүн зайнаас бүртгүүлбэл ЗААВАЛ зөвшөөрөл хүлээнэ.
    new.status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_status_guard on public.attendance;
create trigger attendance_status_guard
  before insert on public.attendance
  for each row
  execute function public.enforce_attendance_status();

-- ---------------------------------------------------------------------------
-- 2. Зөвшөөрөх / татгалзах — эрхийн шатлалтай
-- ---------------------------------------------------------------------------
create or replace function public.admin_decide_attendance(
  p_attendance_id uuid,
  p_status text
)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id    uuid := auth.uid();
  actor_role  text;
  target_role text;
  row_before  public.attendance%rowtype;
  result      public.attendance%rowtype;
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'invalid_status'; end if;

  select p.role into actor_role from public.profiles p where p.id = actor_id;
  if public.role_rank(actor_role) < 3 then raise exception 'forbidden'; end if;

  select * into row_before from public.attendance where id = p_attendance_id;
  if row_before.id is null then raise exception 'not_found'; end if;

  select p.role into target_role
  from public.profiles p
  where p.id::text = row_before.staff_id;

  -- ⚠️ ӨӨРӨӨСӨӨ ДЭЭШ буюу ТЭНЦҮҮ эрхтэй хүний ирцийг зөвшөөрөхгүй.
  --    Админ өөр админыг (мөн өөрийгөө) баталгаажуулж чадахгүй —
  --    зөвхөн хөгжүүлэгч л түүнийг хийнэ. Ингэснээр админ өөрийн
  --    зайнаас бүртгэсэн ирцээ өөрөө батлах зам хаагдана.
  if actor_role <> 'superadmin'
     and public.role_rank(coalesce(target_role, 'employee')) >= public.role_rank(actor_role) then
    raise exception 'forbidden_target';
  end if;

  update public.attendance
     set status = p_status
   where id = p_attendance_id
  returning * into result;

  insert into public.activity_logs (user_id, user_name, action, screen, detail)
  values (
    actor_id,
    (select p.name from public.profiles p where p.id = actor_id),
    'attendance',
    'AttendanceApproval',
    format('Ирц #%s → %s (%s)', p_attendance_id, p_status, coalesce(row_before.staff_name, '—'))
  );

  return result;
end;
$$;

revoke execute on function public.admin_decide_attendance(uuid, text) from public, anon;
grant  execute on function public.admin_decide_attendance(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Шууд UPDATE-ийг хаана — шийдвэр зөвхөн дээрх RPC-ээр гарна
-- ---------------------------------------------------------------------------
-- Өмнө нь `attendance_update` нь `is_admin_user()`-д бүрэн эрх өгдөг
-- байсан тул админ өөрийн ирцээ шууд `approved` болгож чаддаг байв.
drop policy if exists "attendance_update" on public.attendance;
create policy "attendance_update" on public.attendance
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

notify pgrst, 'reload schema';
