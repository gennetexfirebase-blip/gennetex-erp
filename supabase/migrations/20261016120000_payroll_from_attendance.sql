-- ============================================================================
-- sanhuu.gennetex.com — ирцээс цалин автоматаар тооцох
-- ============================================================================
--
--   Админ ажилтан бүрт өдрийн цалин, өдрийн ажлын цаг (дээд хязгаар), хоолны
--   мөнгийг оруулна (payroll_rates). Ажилтан апп-аар «Ирлээ» дармагц тухайн
--   өдрийн work_hour_entries мөр үүсч, 5 минут тутам ажилласан цаг нэмэгдэнэ;
--   «Явлаа» дарахад эцсийн цагаар тооцно.
--
--   ЗӨВХӨН ирц бүртгэх цэг дээр бүртгүүлсэн (attendance.status = 'approved')
--   ирэлтийг тооцно. Өөр байршилд бүртгүүлбэл (pending) цалин бодогдохгүй —
--   админ зөвшөөрвөл (approved болгоход) триггер дахин тооцно.
--
--   Цаг = (явсан − ирсэн) − үдийн 1 цаг (5 цагаас урт бол), өдрийн ажлын
--   цагаар дээд хязгаартай. Илүү цагийг хуучнаараа (хүсэлт → админ) тооцно.
--
--   Апп-ын «Миний цалин» дэлгэц work_hour_entries + payroll_summary-г уншдаг
--   тул апп шинэчлэхгүйгээр харагдана. Админ гараар засварласан мөрийг
--   (source = 'manual') автомат тооцоо дарж бичихгүй.
-- ============================================================================

-- ── Хүснэгтүүд (migration_payroll.sql ажиллаагүй сан дээр ч ажиллахаар) ──────
create table if not exists public.payroll_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text,
  daily_rate numeric not null default 0,
  overtime_multiplier numeric not null default 1.5,
  standard_hours numeric not null default 8,
  effective_from date not null default current_date,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz default now(),
  constraint payroll_rates_daily_rate_nonneg check (daily_rate >= 0),
  constraint payroll_rates_multiplier_valid check (overtime_multiplier >= 1),
  constraint payroll_rates_hours_valid check (standard_hours > 0 and standard_hours <= 24)
);
create unique index if not exists payroll_rates_user_date_uniq on public.payroll_rates (user_id, effective_from);

create table if not exists public.work_hour_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text,
  work_date date not null,
  regular_hours numeric not null default 0,
  overtime_hours numeric not null default 0,
  note text,
  source_request_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint work_hours_regular_valid check (regular_hours >= 0 and regular_hours <= 24),
  constraint work_hours_overtime_valid check (overtime_hours >= 0 and overtime_hours <= 24)
);
create unique index if not exists work_hour_entries_user_date_uniq on public.work_hour_entries (user_id, work_date);

alter table public.payroll_rates enable row level security;
alter table public.work_hour_entries enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'payroll_rates' and policyname = 'payroll_rates_read') then
    create policy "payroll_rates_read" on public.payroll_rates for select using (user_id = auth.uid() or public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'payroll_rates' and policyname = 'payroll_rates_write') then
    create policy "payroll_rates_write" on public.payroll_rates for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'work_hour_entries' and policyname = 'work_hours_read') then
    create policy "work_hours_read" on public.work_hour_entries for select using (user_id = auth.uid() or public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'work_hour_entries' and policyname = 'work_hours_write') then
    create policy "work_hours_write" on public.work_hour_entries for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
end $$;
grant select, insert, update, delete on public.payroll_rates, public.work_hour_entries to authenticated;

-- ── Шинэ баганууд ───────────────────────────────────────────────────────────
alter table public.payroll_rates add column if not exists meal_allowance numeric not null default 0;  -- өдрийн хоолны мөнгө ₮
alter table public.work_hour_entries add column if not exists source text not null default 'manual'; -- manual | attendance
alter table public.work_hour_entries add column if not exists check_in_at timestamptz;
alter table public.work_hour_entries add column if not exists check_out_at timestamptz;
alter table public.work_hour_entries add column if not exists is_open boolean not null default false;

-- ── Нэг ажилтны нэг өдрийг ирцээс тооцох ────────────────────────────────────
create or replace function public.payroll_sync_day(p_uid uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz constant text := 'Asia/Ulaanbaatar';
  day_start timestamptz := (p_date::timestamp at time zone tz);
  day_end timestamptz := ((p_date + 1)::timestamp at time zone tz);
  cin timestamptz;
  cout timestamptz;
  stop_at timestamptz;
  cap numeric;
  span numeric;
  hrs numeric;
  open_now boolean;
  nm text;
  existing public.work_hour_entries%rowtype;
begin
  if p_uid is null or p_date is null then return; end if;
  if not exists (select 1 from public.profiles p where p.id = p_uid) then return; end if;

  select * into existing from public.work_hour_entries w where w.user_id = p_uid and w.work_date = p_date;
  -- Админ гараар оруулсан/зассан мөрийг хөндөхгүй.
  if existing.id is not null and existing.source <> 'attendance' then return; end if;

  -- Зөвхөн зөвшөөрөгдсөн (ирцийн цэг дээрх эсвэл админ баталсан) ирэлт.
  select min(a.created_at) into cin from public.attendance a
  where a.staff_id = p_uid::text and a.type = 'check_in' and coalesce(a.status, 'approved') = 'approved'
    and a.created_at >= day_start and a.created_at < day_end;

  if cin is null then
    if existing.id is not null then delete from public.work_hour_entries w where w.id = existing.id; end if;
    return;
  end if;

  select max(a.created_at) into cout from public.attendance a
  where a.staff_id = p_uid::text and a.type = 'check_out' and coalesce(a.status, 'approved') <> 'rejected'
    and a.created_at > cin and a.created_at < day_end;

  open_now := cout is null and now() < day_end;
  -- Явсан цагаа бүртгүүлээгүй өнгөрсөн өдөр — тооцохгүй (0 цаг), админ засна.
  stop_at := coalesce(cout, case when open_now then now() else cin end);

  cap := coalesce((select r.standard_hours from public.payroll_rates r
                   where r.user_id = p_uid and r.effective_from <= p_date
                   order by r.effective_from desc limit 1), 8);
  span := greatest(0, extract(epoch from (stop_at - cin)) / 3600.0);
  hrs := span - case when span > 5 then 1 else 0 end;
  hrs := round(least(greatest(hrs, 0), cap, 24), 2);

  select trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')) into nm from public.profiles p where p.id = p_uid;

  insert into public.work_hour_entries
    (user_id, user_name, work_date, regular_hours, overtime_hours, note, source, check_in_at, check_out_at, is_open, updated_at)
  values (p_uid, nm, p_date, hrs, 0,
          case when open_now then 'Ирцээс · ажил дээр' when cout is null then 'Ирцээс · явсан цаг бүртгээгүй' else 'Ирцээс автоматаар' end,
          'attendance', cin, cout, open_now, now())
  on conflict (user_id, work_date) do update
    set regular_hours = excluded.regular_hours, user_name = excluded.user_name, note = excluded.note,
        check_in_at = excluded.check_in_at, check_out_at = excluded.check_out_at,
        is_open = excluded.is_open, updated_at = now()
    where public.work_hour_entries.source = 'attendance';
end;
$$;
revoke all on function public.payroll_sync_day(uuid, date) from public, anon, authenticated;

-- ── Ирц өөрчлөгдөх бүрт ───────────────────────────────────────────────────────
create or replace function public.payroll_on_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if r.staff_id ~ '^[0-9a-fA-F-]{36}$' then
    perform public.payroll_sync_day(r.staff_id::uuid, (r.created_at at time zone 'Asia/Ulaanbaatar')::date);
  end if;
  return null;
exception when others then
  -- Цалингийн тооцоо ирц бүртгэлийг хэзээ ч унагахгүй.
  raise warning 'payroll_on_attendance: %', sqlerrm;
  return null;
end;
$$;
revoke all on function public.payroll_on_attendance() from public, anon, authenticated;

drop trigger if exists attendance_payroll_sync on public.attendance;
create trigger attendance_payroll_sync
  after insert or update or delete on public.attendance
  for each row execute function public.payroll_on_attendance();

-- ── Ажил дээр байгаа хүмүүсийн цагийг 5 минут тутам ахиулна ─────────────────
create or replace function public.payroll_sync_open()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select w.user_id, w.work_date from public.work_hour_entries w
           where w.is_open and w.source = 'attendance' loop
    perform public.payroll_sync_day(r.user_id, r.work_date);
  end loop;
end;
$$;
revoke all on function public.payroll_sync_open() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'payroll-live';
    perform cron.schedule('payroll-live', '*/5 * * * *', 'select public.payroll_sync_open()');
  else
    raise notice 'pg_cron алга — ажил дээрх цаг зөвхөн ирц өөрчлөгдөхөд шинэчлэгдэнэ';
  end if;
end $$;

-- ── Энэ сарын өгөгдлийг нөхөж тооцно ─────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in select distinct a.staff_id, (a.created_at at time zone 'Asia/Ulaanbaatar')::date as d
           from public.attendance a
           where a.created_at >= date_trunc('month', now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar'
             and a.staff_id ~ '^[0-9a-fA-F-]{36}$' loop
    perform public.payroll_sync_day(r.staff_id::uuid, r.d);
  end loop;
end $$;

-- ── sanhuu.gennetex.com-ийн нэгтгэл ──────────────────────────────────────────
create or replace function public.sanhuu_payroll(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 400 then raise exception 'invalid_range'; end if;
  return jsonb_build_object(
    'employees', coalesce((select jsonb_agg(x order by x->>'department', x->>'name') from (
      select jsonb_build_object(
        'id', p.id, 'name', trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), 'position', p.position,
        'department', d.name, 'avatar_url', p.avatar_url,
        'rate', (select jsonb_build_object('daily_rate', r.daily_rate, 'standard_hours', r.standard_hours,
                                           'meal_allowance', r.meal_allowance, 'overtime_multiplier', r.overtime_multiplier,
                                           'effective_from', r.effective_from)
                 from public.payroll_rates r where r.user_id = p.id and r.effective_from <= p_to
                 order by r.effective_from desc limit 1)
      ) x
      from public.profiles p
      left join public.departments d on d.id = p.department_id
      where p.role is distinct from 'superadmin' and public.dept_in_scope(p.department_id)
    ) q), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'e', w.user_id, 'd', w.work_date, 'h', w.regular_hours, 'ot', w.overtime_hours, 'src', w.source,
        'in', w.check_in_at, 'out', w.check_out_at, 'open', w.is_open, 'note', w.note,
        'rate', r.daily_rate, 'std', r.standard_hours, 'meal', r.meal_allowance, 'mult', r.overtime_multiplier))
      from public.work_hour_entries w
      join public.profiles p on p.id = w.user_id
      left join lateral (select * from public.payroll_rates pr where pr.user_id = w.user_id and pr.effective_from <= w.work_date
                         order by pr.effective_from desc limit 1) r on true
      where w.work_date between p_from and p_to and public.dept_in_scope(p.department_id)), '[]'::jsonb),
    -- Ирцийн цэгээс гадуур бүртгүүлж, админы зөвшөөрөл хүлээж буй ирэлт.
    'pending', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'e', a.staff_id, 'name', a.staff_name, 'at', a.created_at, 'distance', a.distance_m, 'note', a.note)
        order by a.created_at desc)
      from public.attendance a
      where a.type = 'check_in' and a.status = 'pending'
        and a.created_at >= (p_from::timestamp at time zone 'Asia/Ulaanbaatar')
        and a.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Ulaanbaatar')), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.sanhuu_payroll(date, date) from public, anon;
grant execute on function public.sanhuu_payroll(date, date) to authenticated;

/** Админ ажилтны цалингийн тохиргоог өнөөдрөөс хүчинтэй болгож хадгална. */
create or replace function public.sanhuu_set_rate(p_user uuid, p_daily numeric, p_hours numeric, p_meal numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  emp public.profiles%rowtype;
  me_name text;
  today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  select * into emp from public.profiles p where p.id = p_user;
  if emp.id is null or not public.dept_in_scope(emp.department_id) then raise exception 'forbidden'; end if;
  if coalesce(p_daily, -1) < 0 or coalesce(p_hours, 0) <= 0 or p_hours > 24 or coalesce(p_meal, 0) < 0 then raise exception 'invalid_rate'; end if;
  select coalesce(nullif(trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), ''), p.email) into me_name from public.profiles p where p.id = auth.uid();

  insert into public.payroll_rates (user_id, user_name, daily_rate, standard_hours, meal_allowance, effective_from, created_by, created_by_name)
  values (p_user, trim(coalesce(emp.last_name, '') || ' ' || coalesce(emp.name, '')), p_daily, p_hours, coalesce(p_meal, 0), today, auth.uid(), me_name)
  on conflict (user_id, effective_from) do update
    set daily_rate = excluded.daily_rate, standard_hours = excluded.standard_hours,
        meal_allowance = excluded.meal_allowance, created_by = excluded.created_by, created_by_name = excluded.created_by_name;

  -- Өнөөдрийн цагийг шинэ дээд хязгаараар дахин тооцно.
  perform public.payroll_sync_day(p_user, today);
end;
$$;
revoke all on function public.sanhuu_set_rate(uuid, numeric, numeric, numeric) from public, anon;
grant execute on function public.sanhuu_set_rate(uuid, numeric, numeric, numeric) to authenticated;

/** Ирцийн цэгээс гадуурх ирэлтийг зөвшөөрөх/татгалзах — триггер цалинг дахин тооцно. */
create or replace function public.sanhuu_review_checkin(p_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attendance%rowtype;
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  select * into a from public.attendance x where x.id = p_id;
  if a.id is null then raise exception 'not_found'; end if;
  if a.staff_id ~ '^[0-9a-fA-F-]{36}$' and not public.dept_in_scope((select p.department_id from public.profiles p where p.id = a.staff_id::uuid)) then
    raise exception 'forbidden';
  end if;
  update public.attendance x set status = case when p_approve then 'approved' else 'rejected' end where x.id = p_id;
end;
$$;
revoke all on function public.sanhuu_review_checkin(uuid, boolean) from public, anon;
grant execute on function public.sanhuu_review_checkin(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
