-- Company-wide business rules and one operational alert feed.

create table if not exists public.company_settings (
  singleton boolean primary key default true check (singleton),
  work_start_time time not null default '09:00',
  late_grace_minutes integer not null default 0 check (late_grace_minutes between 0 and 120),
  default_min_stock numeric not null default 5 check (default_min_stock >= 0),
  reminder_days integer[] not null default array[30, 7, 1],
  low_stock_alert_enabled boolean not null default true,
  training_alert_enabled boolean not null default true,
  vehicle_alert_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.company_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.company_settings enable row level security;
revoke all on public.company_settings from public, anon;
grant select on public.company_settings to authenticated;

drop policy if exists company_settings_read on public.company_settings;
create policy company_settings_read on public.company_settings
  for select to authenticated using (true);

create or replace function public.get_company_settings()
returns public.company_settings
language sql
stable
security definer
set search_path = ''
as $$
  select s from public.company_settings s where s.singleton = true;
$$;

revoke all on function public.get_company_settings() from public, anon;
grant execute on function public.get_company_settings() to authenticated;

create or replace function public.update_company_settings(
  p_work_start_time time,
  p_late_grace_minutes integer,
  p_default_min_stock numeric,
  p_reminder_days integer[],
  p_low_stock_alert_enabled boolean,
  p_training_alert_enabled boolean,
  p_vehicle_alert_enabled boolean
)
returns public.company_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.company_settings%rowtype;
begin
  if not public.is_admin_user() then
    raise exception 'permission_denied';
  end if;
  if p_work_start_time is null then raise exception 'work_start_time_required'; end if;
  if coalesce(p_late_grace_minutes, -1) not between 0 and 120 then
    raise exception 'invalid_late_grace_minutes';
  end if;
  if coalesce(p_default_min_stock, -1) < 0 then raise exception 'invalid_min_stock'; end if;
  if p_reminder_days is null or cardinality(p_reminder_days) = 0
     or exists (select 1 from unnest(p_reminder_days) d where d < 0 or d > 365) then
    raise exception 'invalid_reminder_days';
  end if;

  insert into public.company_settings (
    singleton, work_start_time, late_grace_minutes, default_min_stock, reminder_days,
    low_stock_alert_enabled, training_alert_enabled, vehicle_alert_enabled,
    updated_at, updated_by
  ) values (
    true, p_work_start_time, p_late_grace_minutes, p_default_min_stock,
    (select array_agg(distinct d order by d desc) from unnest(p_reminder_days) d),
    coalesce(p_low_stock_alert_enabled, true),
    coalesce(p_training_alert_enabled, true),
    coalesce(p_vehicle_alert_enabled, true),
    now(), auth.uid()
  )
  on conflict (singleton) do update set
    work_start_time = excluded.work_start_time,
    late_grace_minutes = excluded.late_grace_minutes,
    default_min_stock = excluded.default_min_stock,
    reminder_days = excluded.reminder_days,
    low_stock_alert_enabled = excluded.low_stock_alert_enabled,
    training_alert_enabled = excluded.training_alert_enabled,
    vehicle_alert_enabled = excluded.vehicle_alert_enabled,
    updated_at = now(),
    updated_by = auth.uid()
  returning * into result;

  -- Future schedules follow the company rule; historical schedules remain unchanged.
  update public.employee_shifts
     set start_time = to_char(p_work_start_time, 'HH24:MI')
   where shift_date >= (now() at time zone 'Asia/Ulaanbaatar')::date;

  return result;
end;
$$;

revoke all on function public.update_company_settings(
  time, integer, numeric, integer[], boolean, boolean, boolean
) from public, anon;
grant execute on function public.update_company_settings(
  time, integer, numeric, integer[], boolean, boolean, boolean
) to authenticated;

create or replace function public.get_operational_alerts()
returns table (
  alert_type text,
  severity text,
  title text,
  detail text,
  due_date date,
  entity_id text,
  days_remaining integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg public.company_settings%rowtype;
  today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
  max_days integer;
begin
  if not public.is_admin_user() then
    raise exception 'permission_denied';
  end if;
  select * into cfg from public.company_settings where singleton = true;
  max_days := coalesce((select max(d) from unnest(cfg.reminder_days) d), 30);

  return query
  select
    'low_stock'::text,
    case when coalesce(i.quantity, 0) <= 0 then 'danger' else 'warning' end,
    i.name::text,
    format('Үлдэгдэл %s %s · доод хэмжээ %s',
      coalesce(i.quantity, 0), coalesce(i.unit, 'ширхэг'),
      coalesce(i.min_stock, cfg.default_min_stock))::text,
    null::date,
    i.id::text,
    null::integer
  from public.inventory i
  where cfg.low_stock_alert_enabled
    and coalesce(i.quantity, 0) <= coalesce(i.min_stock, cfg.default_min_stock)

  union all

  select
    'training'::text,
    case when t.due_date < today then 'danger'
         when t.due_date <= today + 1 then 'danger' else 'warning' end,
    t.training_name::text,
    format('%s · %s', t.employee_email,
      case when t.due_date < today then 'хугацаа хэтэрсэн'
           else t.due_date::text || ' хүртэл' end)::text,
    t.due_date,
    t.id::text,
    (t.due_date - today)::integer
  from public.employee_training_assignments t
  where cfg.training_alert_enabled
    and t.status = 'required'
    and t.due_date is not null
    and t.due_date <= today + max_days

  union all

  select
    'vehicle_inspection'::text,
    case when v.inspection_expiry < today then 'danger'
         when v.inspection_expiry <= today + 1 then 'danger' else 'warning' end,
    (v.plate_number || ' · Техникийн үзлэг')::text,
    case when v.inspection_expiry < today then 'Хугацаа хэтэрсэн'
         else v.inspection_expiry::text || ' хүртэл' end,
    v.inspection_expiry,
    v.vehicle_id::text,
    (v.inspection_expiry - today)::integer
  from public.vehicle_compliance_snapshots v
  where cfg.vehicle_alert_enabled
    and v.inspection_expiry is not null
    and v.inspection_expiry <= today + max_days

  union all

  select
    'vehicle_insurance'::text,
    case when v.insurance_expiry < today then 'danger'
         when v.insurance_expiry <= today + 1 then 'danger' else 'warning' end,
    (v.plate_number || ' · Даатгал')::text,
    case when v.insurance_expiry < today then 'Хугацаа хэтэрсэн'
         else v.insurance_expiry::text || ' хүртэл' end,
    v.insurance_expiry,
    v.vehicle_id::text,
    (v.insurance_expiry - today)::integer
  from public.vehicle_compliance_snapshots v
  where cfg.vehicle_alert_enabled
    and v.insurance_expiry is not null
    and v.insurance_expiry <= today + max_days

  order by severity asc, days_remaining asc nulls first, alert_type, title;
end;
$$;

revoke all on function public.get_operational_alerts() from public, anon;
grant execute on function public.get_operational_alerts() to authenticated;

-- Attendance status now reads the editable company rule.
create or replace function public.compute_attendance_status(
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_shift_start text,
  p_shift_end text,
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
set search_path = ''
as $$
declare
  d date;
  cfg public.company_settings%rowtype;
  expected_start timestamptz;
  expected_end timestamptz;
  late int := 0;
  early int := 0;
  worked int := null;
  st text;
begin
  select * into cfg from public.company_settings where singleton = true;
  d := coalesce(
    (p_check_in at time zone p_tz)::date,
    (p_check_out at time zone p_tz)::date,
    (now() at time zone p_tz)::date
  );
  expected_start := (d + coalesce(cfg.work_start_time, '09:00'::time)) at time zone p_tz;
  if p_shift_end is not null and p_shift_end <> '' then
    expected_end := (d::text || ' ' || p_shift_end)::timestamp at time zone p_tz;
  end if;
  if p_check_in is not null
     and p_check_in >= expected_start + make_interval(mins => coalesce(cfg.late_grace_minutes, 0) + 1) then
    late := floor(extract(epoch from (p_check_in - expected_start)) / 60)::int;
  end if;
  if p_check_out is not null and expected_end is not null and p_check_out < expected_end then
    early := round(extract(epoch from (expected_end - p_check_out)) / 60)::int;
  end if;
  if p_check_in is not null and p_check_out is not null then
    worked := round(extract(epoch from (p_check_out - p_check_in)) / 60)::int;
  end if;
  if p_check_in is null then
    st := case when p_shift_start is null or p_shift_start = '' then 'not_scheduled' else 'absent' end;
  elsif late > 0 then st := 'late';
  elsif early > 0 then st := 'early_leave';
  else st := 'on_time';
  end if;
  return query select late, early, worked, st;
end;
$$;

grant execute on function public.compute_attendance_status(
  timestamptz, timestamptz, text, text, text
) to authenticated;

notify pgrst, 'reload schema';
