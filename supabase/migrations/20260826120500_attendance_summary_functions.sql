-- ============================================================================
-- ИРЦИЙН ТӨЛӨВ/ХУГАЦААНЫ НЭГДСЭН ТООЦООЛОЛ (server-side, нэг эх сурвалж)
-- ============================================================================
-- Яагаад: Admin dashboard-ийн summary card (Бүгд/Ирсэн/Хоцорсон/Тасалсан)
-- болон Employee-ийн сарын дэлгэрэнгүй хоёулаа ижил хоцролт/эрт явсан/
-- ажилласан минутын тооцоог ашиглах ёстой. UI тус тусдаа дахин бодохгүй.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Нэг өдрийн ирц + хуваариас хоцролт/эрт явсан/ажилласан минут гаргах
-- ---------------------------------------------------------------------------
create or replace function public.compute_attendance_status(
  p_check_in  timestamptz,
  p_check_out timestamptz,
  p_shift_start text,   -- 'HH:MM' эсвэл NULL
  p_shift_end   text,
  p_tz text default 'Asia/Ulaanbaatar'
)
returns table (
  late_minutes int,
  early_leave_minutes int,
  worked_minutes int,
  status text
)
language plpgsql
stable
as $$
declare
  d date;
  expected_start timestamptz;
  expected_end   timestamptz;
  late int := 0;
  early int := 0;
  worked int := null;
  st text;
begin
  d := coalesce((p_check_in at time zone p_tz)::date, (p_check_out at time zone p_tz)::date, current_date);

  if p_shift_start is not null and p_shift_start <> '' then
    expected_start := (d::text || ' ' || p_shift_start)::timestamp at time zone p_tz;
  end if;
  if p_shift_end is not null and p_shift_end <> '' then
    expected_end := (d::text || ' ' || p_shift_end)::timestamp at time zone p_tz;
  end if;

  if p_check_in is not null and expected_start is not null and p_check_in > expected_start then
    late := round(extract(epoch from (p_check_in - expected_start)) / 60)::int;
  end if;

  if p_check_out is not null and expected_end is not null and p_check_out < expected_end then
    early := round(extract(epoch from (expected_end - p_check_out)) / 60)::int;
  end if;

  if p_check_in is not null and p_check_out is not null then
    worked := round(extract(epoch from (p_check_out - p_check_in)) / 60)::int;
  end if;

  -- ⚠️ ХУВААРЬГҮЙ ӨДРИЙГ "ТАСАЛСАН" ГЭЖ ҮЗЭХГҮЙ.
  --
  -- Энэ системд хуваарь нь ажилтан бүрт ӨДӨР ТУТАМ гараар оногддог
  -- (`employee_shifts`). Тиймээс хуваарь оноогоогүй өдөр нь "ажиллах
  -- ёстой байсан" гэсэн үг БИШ. Хуваарьгүй өдрийг таслалт гэж тоолвол
  -- админы "Тасалсан" тоо болон ажилтны сарын дүн бодит бус болно.
  if p_check_in is null then
    if expected_start is null then
      st := 'not_scheduled';   -- хуваарьгүй бөгөөд ирээгүй → тооцохгүй
    else
      st := 'absent';          -- хуваарьтай атлаа ирээгүй → тасалсан
    end if;
  elsif late > 0 then
    st := 'late';
  elsif early > 0 then
    st := 'early_leave';
  else
    st := 'on_time';
  end if;

  return query select late, early, worked, st;
end;
$$;

grant execute on function public.compute_attendance_status(timestamptz, timestamptz, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Нэг ажилтны сар/хугацааны дэлгэрэнгүй (Employee monthly summary/history)
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
    select day_of_week from public.employee_break_schedules where user_id = p_employee_id
  ),
  leaves as (
    select date_from, date_to, kind
    from public.leave_requests
    where user_id = p_employee_id
      and status = 'approved'
      and date_to >= p_start and date_from <= p_end
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
    (extract(isodow from d.work_date)::smallint in (select day_of_week from rest_days)) as is_rest_day,
    exists (select 1 from leaves lv where d.work_date between lv.date_from and lv.date_to) as is_leave,
    (select lv.kind from leaves lv where d.work_date between lv.date_from and lv.date_to limit 1) as leave_kind,
    att.check_in_at,
    att.check_out_at,
    coalesce(att.is_remote, false),
    (cs.late_minutes),
    (cs.early_leave_minutes),
    (cs.worked_minutes),
    case
      when exists (select 1 from leaves lv where d.work_date between lv.date_from and lv.date_to) then 'leave'
      when (extract(isodow from d.work_date)::smallint in (select day_of_week from rest_days)) then 'rest'
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

-- ---------------------------------------------------------------------------
-- 3. Тухайн өдрийн бүх ажилтны ирц (Admin dashboard)
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
  with emp as (
    -- ⚠️ ЗӨВХӨН `superadmin` (хөгжүүлэгч)-ийг хасна.
    --
    -- Өмнө нь `role in ('employee','ahlah','menejer')` гэж шүүдэг байсан
    -- тул АДМИН эрхтэй ажилчид жагсаалтад ОГТ ОРДОГГҮЙ байв — админ ч
    -- ирцээ бүртгүүлдэг тул тэднийг ч харуулах ёстой.
    select p.id, p.name, p.avatar_url, p.department_id, d.name as department_name
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where coalesce(p.role, 'employee') <> 'superadmin'
      and (p_department_id is null or p.department_id = p_department_id)
      and public.dept_in_scope(p.department_id)
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
  ),
  att as (
    select
      a.staff_id as user_id_text,
      max(a.created_at) filter (where a.type = 'check_in')  as check_in_at,
      max(a.created_at) filter (where a.type = 'check_out') as check_out_at,
      bool_or(a.is_remote) as is_remote
    from public.attendance a
    where a.status <> 'rejected'
      and (a.created_at at time zone 'Asia/Ulaanbaatar')::date = p_date
    group by 1
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
  order by emp.name;
end;
$$;

revoke execute on function public.fetch_department_attendance_today(uuid, date) from public, anon;
grant  execute on function public.fetch_department_attendance_today(uuid, date) to authenticated;

notify pgrst, 'reload schema';
