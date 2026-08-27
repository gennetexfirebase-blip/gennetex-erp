-- ============================================================================
-- Зайнаас бүртгүүлсэн ирц — АДМИНЫ ЗӨВШӨӨРӨЛ ХҮЛЭЭЖ БУЙГ ялгах
-- ============================================================================
--
-- ДҮРЭМ:
--   Ажилтан ирц бүртгэх бүсээс ГАДУУР бүртгүүлбэл тэр мөр нь `pending`
--   төлөвтэй үүснэ (клиент тал `attendanceService.insertAttendance`).
--   Админ зөвшөөрч байж л жинхэнэ ирцэд тооцогдоно.
--
-- АСУУДАЛ:
--   `fetch_department_attendance_today` нь `status <> 'rejected'` гэж
--   шүүдэг тул ХҮЛЭЭГДЭЖ БУЙ мөрийг ч зөвшөөрөгдсөнтэй адил тооцож,
--   ирсэн цагийг нь шууд харуулдаг байв. Админ аль нь баталгаажсан,
--   аль нь хүлээгдэж байгааг ялгаж чадахгүй.
--
-- ЗАСВАР:
--   `is_pending` талбар нэмнэ — тухайн өдрийн мөрүүдийн дунд
--   зөвшөөрөгдөөгүй (`pending`) нь байвал `true`. UI дээр ажилтны нэрийн
--   доор шар "Хүлээгдэж байна" гэж харуулна.
-- ============================================================================

-- ⚠️ `create or replace` нь буцаах ТӨРЛИЙГ өөрчилж чаддаггүй
-- (SQLSTATE 42P13). Шинэ багана нэмж байгаа тул эхлээд устгана.
drop function if exists public.fetch_department_attendance_today(uuid, date);

create function public.fetch_department_attendance_today(
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
  is_pending boolean,
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
      bool_or(a.is_remote) as is_remote,
      -- Админы шийдвэр хүлээж буй мөр байгаа эсэх.
      bool_or(a.status = 'pending') as is_pending
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
    coalesce(att.is_pending, false),
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

notify pgrst, 'reload schema';
