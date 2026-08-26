-- ============================================================================
-- ЗАСВАР — Ирц бүртгүүлсэн хүмүүс АДМИНД ХАРАГДАХГҮЙ байсныг зассан
-- ============================================================================
--
-- АСУУДАЛ 1 — RLS дээрх төрлийн зөрчил (үндсэн шалтгаан):
--   `public.attendance.staff_id` нь `text` төрөлтэй, харин `auth.uid()` нь
--   `uuid`. PostgreSQL-д `text = uuid` ОПЕРАТОР БАЙХГҮЙ тул
--   20260821110100_personal_data_scoping.sql доторх
--
--       using (staff_id = auth.uid() or public.is_admin_user())
--
--   нөхцөл нь алдаа өгч, ирцийн мөрүүд ОГТ уншигдахгүй болж байв.
--   Үүнээс болж админ вэб болон админ эрхийн апп дээр "ирц бүртгэгдээгүй"
--   мэт харагдаж байсан.
--
--   ⚠️ `or` нь заримдаа богино холболт хийж (is_admin_user() эхэлж үнэн
--   болвол) алдаа гарахгүй өнгөрдөг тул алдаа нь ТОГТМОЛ БУС илэрдэг —
--   яг ийм алдааг олоход хүндрэлтэй болгодог.
--
--   ЗАСВАР: харьцуулалтыг `auth.uid()::text` болгож нэг төрөлд оруулна.
--
-- АСУУДАЛ 2 — ирцтэй атлаа жагсаалтад ордоггүй хүн:
--   `fetch_department_attendance_today` нь ажилтны жагсаалтаа зөвхөн
--   `profiles`-оос гаргаад, дээр нь `dept_in_scope()` шүүлт хийдэг байв.
--   Иймд хэлтэст хамааралгүй / өөр хэлтсийн хүн ирцээ бүртгүүлсэн ч
--   ХАРАГДАХГҮЙ өнгөрдөг байв. Одоо тухайн өдөр ИРЦТЭЙ хүн бүрийг
--   заавал жагсаалтад оруулна.
--
-- ШАЛГАХ:
--   1. Ажилтнаар ирц бүртгүүлэх
--   2. Админаар нэвтэрч Ирц хэсгийг харах → тэр хүн жагсаалтад байх ёстой
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. attendance RLS — төрлийн cast засвар
-- ---------------------------------------------------------------------------
drop policy if exists "attendance_read"   on public.attendance;
create policy "attendance_read" on public.attendance
  for select to authenticated
  using (staff_id = auth.uid()::text or public.is_admin_user());

drop policy if exists "attendance_insert" on public.attendance;
create policy "attendance_insert" on public.attendance
  for insert to authenticated
  with check (staff_id = auth.uid()::text or public.is_admin_user());

-- Зөвшөөрөх/татгалзах нь админы ажил хэвээр.
drop policy if exists "attendance_update" on public.attendance;
create policy "attendance_update" on public.attendance
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- 2. Өдрийн ирцийн жагсаалт — ирцтэй хүнийг ЗААВАЛ оруулна
-- ---------------------------------------------------------------------------
create or replace function public.fetch_department_attendance_today(
  p_department_id uuid default null,
  p_date date default (now() at time zone 'Asia/Ulaanbaatar')::date
)
returns table (
  employee_id uuid,
  employee_name text,
  avatar_url text,
  department_id uuid,
  department_name text,
  shift_start text,
  shift_end text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  is_remote boolean,
  late_minutes int,
  early_leave_minutes int,
  worked_minutes int,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if not public.dept_in_scope(p_department_id) then raise exception 'forbidden'; end if;

  return query
  with att as (
    select
      a.staff_id as user_id_text,
      max(a.created_at) filter (where a.type = 'check_in')  as check_in_at,
      max(a.created_at) filter (where a.type = 'check_out') as check_out_at,
      bool_or(a.is_remote) as is_remote
    from public.attendance a
    where a.status <> 'rejected'
      and (a.created_at at time zone 'Asia/Ulaanbaatar')::date = p_date
    group by 1
  ),
  emp as (
    -- ⚠️ ЭРХЭЭР ШҮҮХГҮЙ: өмнө нь `superadmin`-г хасдаг байсан тул
    -- систем админ / хөгжүүлэгч ирцээ бүртгүүлсэн ч бусад админд
    -- ОГТ харагддаггүй байв. Ирц бол эрхээс үл хамаарах бүртгэл тул
    -- бүх хүнийг оруулна.
    select p.id, p.name, p.avatar_url, p.department_id, d.name as department_name
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where (p_department_id is null or p.department_id = p_department_id)
      and (
        -- Хэлтсийн хамрах хүрээнд байгаа хүн, ЭСВЭЛ
        public.dept_in_scope(p.department_id)
        -- тухайн өдөр ирцээ бүртгүүлсэн хүн (хамрах хүрээнээс үл хамааран
        -- админ ирцийг нь харах ёстой — эс бөгөөс бүртгэл алга болно).
        or exists (select 1 from att where att.user_id_text = p.id::text)
      )
  ),
  shifts as (
    select s.user_id, s.start_time, s.end_time
    from public.employee_shifts s
    where s.shift_date = p_date
  ),
  rest_days as (
    select user_id, day_of_week from public.employee_break_schedules
  ),
  leaves as (
    select user_id, kind from public.leave_requests
    where status = 'approved' and p_date between date_from and date_to
  )
  select
    emp.id,
    emp.name,
    emp.avatar_url,
    emp.department_id,
    emp.department_name,
    sh.start_time,
    sh.end_time,
    att.check_in_at,
    att.check_out_at,
    coalesce(att.is_remote, false),
    cs.late_minutes,
    cs.early_leave_minutes,
    cs.worked_minutes,
    case
      when lv.user_id is not null then 'leave'
      when emp.id in (select user_id from rest_days where day_of_week = extract(isodow from p_date)::smallint) then 'rest'
      else cs.status
    end
  from emp
  left join shifts sh on sh.user_id = emp.id
  left join att on att.user_id_text = emp.id::text
  left join leaves lv on lv.user_id = emp.id
  left join lateral public.compute_attendance_status(
    att.check_in_at, att.check_out_at, sh.start_time, sh.end_time
  ) cs on true
  -- Ирсэн хүн эхэндээ, дараа нь нэрийн дарааллаар.
  order by (att.check_in_at is null), emp.name;
end;
$$;

revoke execute on function public.fetch_department_attendance_today(uuid, date) from public, anon;
grant  execute on function public.fetch_department_attendance_today(uuid, date) to authenticated;

notify pgrst, 'reload schema';
