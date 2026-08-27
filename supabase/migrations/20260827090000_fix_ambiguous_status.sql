-- ============================================================================
-- ЗАСВАР — column reference "status" is ambiguous
-- ============================================================================
--
-- АСУУДАЛ:
--   `fetch_department_attendance_today` ба `fetch_attendance_summary` хоёр нь
--   `returns table (... status text)` гэж зарласан. PostgreSQL-д `returns
--   table`-ийн баганын нэрс нь функц дотор ГАРАЛТЫН ХУВЬСАГЧ болдог тул
--   доторх
--
--       where status = 'approved'      -- leave_requests.status гэсэн санаа
--
--   гэсэн тодотголгүй бичлэг нь тэр гаралтын хувьсагчтай зөрчилдөж
--       ERROR: column reference "status" is ambiguous
--   өгч, ирцийн жагсаалт ОГТ ачаалагдахгүй байв.
--
-- ЗАСВАР:
--   CTE доторх бүх баганыг хүснэгтийн хочоор тодотгоно (`lr.status`).
--   Ижил эрсдэлтэй `user_id`, `date_from`, `date_to`-г мөн тодотгов.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Өдрийн ирцийн жагсаалт (админ)
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
    select p.id, p.name, p.avatar_url, p.department_id, d.name as department_name
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where (p_department_id is null or p.department_id = p_department_id)
      and (
        public.dept_in_scope(p.department_id)
        or exists (select 1 from att t where t.user_id_text = p.id::text)
      )
  ),
  shifts as (
    select s.user_id, s.start_time, s.end_time
    from public.employee_shifts s
    where s.shift_date = p_date
  ),
  rest_days as (
    select b.user_id, b.day_of_week from public.employee_break_schedules b
  ),
  leaves as (
    -- ⚠️ `lr.` тодотгол ЗААВАЛ — эс бөгөөс гаралтын `status`-тай зөрчилдөнө.
    select lr.user_id, lr.kind
    from public.leave_requests lr
    where lr.status = 'approved'
      and p_date between lr.date_from and lr.date_to
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
      when exists (
        select 1 from rest_days rd
        where rd.user_id = emp.id
          and rd.day_of_week = extract(isodow from p_date)::smallint
      ) then 'rest'
      else cs.status
    end
  from emp
  left join shifts sh on sh.user_id = emp.id
  left join att on att.user_id_text = emp.id::text
  left join leaves lv on lv.user_id = emp.id
  left join lateral public.compute_attendance_status(
    att.check_in_at, att.check_out_at, sh.start_time, sh.end_time
  ) cs on true
  order by (att.check_in_at is null), emp.name;
end;
$$;

revoke execute on function public.fetch_department_attendance_today(uuid, date) from public, anon;
grant  execute on function public.fetch_department_attendance_today(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ажилтны хугацааны дүн (ажилтан + админ)
-- ---------------------------------------------------------------------------
create or replace function public.fetch_attendance_summary(
  p_employee_id uuid,
  p_start date,
  p_end date
)
returns table (
  work_date date,
  shift_start text,
  shift_end text,
  location_name text,
  is_rest_day boolean,
  is_leave boolean,
  leave_kind text,
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
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_employee_id <> auth.uid() and not public.is_admin_user() then
    raise exception 'forbidden';
  end if;

  return query
  with days as (
    select generate_series(p_start, p_end, interval '1 day')::date as work_date
  ),
  shifts as (
    select s.shift_date, s.start_time, s.end_time, l.name as location_name
    from public.employee_shifts s
    left join public.attendance_locations l on l.id = s.location_id
    where s.user_id = p_employee_id
      and s.shift_date between p_start and p_end
  ),
  rest_days as (
    select b.day_of_week
    from public.employee_break_schedules b
    where b.user_id = p_employee_id
  ),
  leaves as (
    select lr.date_from, lr.date_to, lr.kind
    from public.leave_requests lr
    where lr.user_id = p_employee_id
      and lr.status = 'approved'
      and lr.date_to >= p_start and lr.date_from <= p_end
  ),
  att as (
    select
      (a.created_at at time zone 'Asia/Ulaanbaatar')::date as work_date,
      max(a.created_at) filter (where a.type = 'check_in')  as check_in_at,
      max(a.created_at) filter (where a.type = 'check_out') as check_out_at,
      bool_or(a.is_remote) as is_remote
    from public.attendance a
    where a.staff_id = p_employee_id::text
      and a.status <> 'rejected'
      and (a.created_at at time zone 'Asia/Ulaanbaatar')::date between p_start and p_end
    group by 1
  )
  select
    d.work_date,
    sh.start_time,
    sh.end_time,
    sh.location_name,
    exists (
      select 1 from rest_days rd
      where rd.day_of_week = extract(isodow from d.work_date)::smallint
    ),
    exists (select 1 from leaves lv where d.work_date between lv.date_from and lv.date_to),
    (select lv.kind from leaves lv where d.work_date between lv.date_from and lv.date_to limit 1),
    att.check_in_at,
    att.check_out_at,
    coalesce(att.is_remote, false),
    cs.late_minutes,
    cs.early_leave_minutes,
    cs.worked_minutes,
    case
      when exists (select 1 from leaves lv where d.work_date between lv.date_from and lv.date_to) then 'leave'
      when exists (
        select 1 from rest_days rd
        where rd.day_of_week = extract(isodow from d.work_date)::smallint
      ) then 'rest'
      when att.check_in_at is null and d.work_date > (now() at time zone 'Asia/Ulaanbaatar')::date then 'upcoming'
      else cs.status
    end
  from days d
  left join shifts sh on sh.shift_date = d.work_date
  left join att on att.work_date = d.work_date
  left join lateral public.compute_attendance_status(
    att.check_in_at, att.check_out_at, sh.start_time, sh.end_time
  ) cs on true
  order by d.work_date;
end;
$$;

revoke execute on function public.fetch_attendance_summary(uuid, date, date) from public, anon;
grant  execute on function public.fetch_attendance_summary(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
