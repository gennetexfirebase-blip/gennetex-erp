-- Жишээ харилцагч/ажилтны мэдээлэл бүрэн цэвэрлэх
-- Supabase SQL Editor дээр ажиллуулна

do $cleanup$
declare
  names text[] := array['Бат-Эрдэнэ', 'Бат Эрдэнэ', 'Оюунчимэг', 'Ганбаатар'];
begin
  -- Дуудлага (хүснэгт байвал)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'calls'
  ) then
    delete from public.calls where customer = any(names);
  end if;

  delete from public.visit_logs where customer = any(names);
  delete from public.staff where name = any(names);

  update public.vehicles set driver_name = null where driver_name = any(names);
  update public.trips set driver_name = null where driver_name = any(names);

  delete from public.attendance where staff_name = any(names);

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'stock_movements'
  ) then
    delete from public.stock_movements
    where user_name = any(names) or staff_name = any(names);
  end if;

  delete from public.vehicle_logs where user_name = any(names);
  delete from public.location_logs where user_name = any(names);
  delete from public.employee_reports where user_name = any(names);

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'employee_shifts'
  ) then
    delete from public.employee_shifts where user_name = any(names);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'employee_break_schedules'
  ) then
    delete from public.employee_break_schedules where user_name = any(names);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'face_enrollments'
  ) then
    delete from public.face_enrollments where user_name = any(names);
  end if;

  -- Жишээ ажилтны бүртгэл (auth + profile)
  delete from auth.users
  where id in (select id from public.profiles where name = any(names));
end $cleanup$;

notify pgrst, 'reload schema';
