-- ============================================================================
-- Цалингийн систем — өдрийн цалин, ажилласан цаг, илүү цагийн хүсэлт
-- ============================================================================
--
-- ⚠️ ЦАЛИН БОЛ ЭМЗЭГ МЭДЭЭЛЭЛ.
--    `profiles` хүснэгтийн RLS нь нэвтэрсэн БҮХ хүнд уншихыг зөвшөөрдөг
--    (schema.sql:32 — `using (auth.role() = 'authenticated')`). Тиймээс
--    цалинг тэнд хадгалж БОЛОХГҮЙ — бүх ажилтан бие биенийхээ цалинг харна.
--    Доорх хүснэгтүүд нь: ажилтан ЗӨВХӨН ӨӨРИЙНХӨӨ мөрийг, админ бүгдийг.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Цалингийн хувь хэмжээ
-- ---------------------------------------------------------------------------
-- Түүхийг хадгална: цалин өөрчлөгдвөл шинэ мөр нэмнэ, хуучныг устгахгүй.
-- Ингэснээр өнгөрсөн сарын тайланг тухайн үеийн ханшаар тооцно.

create table if not exists public.payroll_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text,
  daily_rate numeric not null default 0,          -- өдрийн цалин ₮
  overtime_multiplier numeric not null default 1.5, -- илүү цагийн коэффициент
  standard_hours numeric not null default 8,       -- өдрийн жишиг цаг
  effective_from date not null default current_date,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz default now(),
  constraint payroll_rates_daily_rate_nonneg check (daily_rate >= 0),
  constraint payroll_rates_multiplier_valid check (overtime_multiplier >= 1),
  constraint payroll_rates_hours_valid check (standard_hours > 0 and standard_hours <= 24)
);

-- Нэг ажилтанд нэг өдөр нэг л ханш
create unique index if not exists payroll_rates_user_date_uniq
  on public.payroll_rates (user_id, effective_from);

create index if not exists payroll_rates_user_idx
  on public.payroll_rates (user_id, effective_from desc);


-- ---------------------------------------------------------------------------
-- 2. Ажилласан цагийн бичилт
-- ---------------------------------------------------------------------------
-- Админ гараар оруулна (ирцийн автомат тооцоолол дээр нэмэлт/залруулга).

create table if not exists public.work_hour_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text,
  work_date date not null,
  regular_hours numeric not null default 0,
  overtime_hours numeric not null default 0,
  note text,
  -- Илүү цагийн хүсэлтээс үүссэн бол эх сурвалжийг холбоно
  source_request_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint work_hours_regular_valid check (regular_hours >= 0 and regular_hours <= 24),
  constraint work_hours_overtime_valid check (overtime_hours >= 0 and overtime_hours <= 24)
);

create unique index if not exists work_hour_entries_user_date_uniq
  on public.work_hour_entries (user_id, work_date);

create index if not exists work_hour_entries_date_idx
  on public.work_hour_entries (work_date desc);


-- ---------------------------------------------------------------------------
-- 3. Илүү цагийн хүсэлт
-- ---------------------------------------------------------------------------
-- Шинэ хүснэгт үүсгэхийн оронд `leave_requests`-ийг өргөтгөв.
-- Тэр нь аль хэдийн "ажилтан хүсэлт → админ хянана" урсгалтай бөгөөд
-- `kind` баганатай. Илүү цагт `kind = 'overtime'` ашиглана.

alter table public.leave_requests add column if not exists hours numeric;
alter table public.leave_requests add column if not exists reviewed_at timestamptz;

comment on column public.leave_requests.hours is
  'kind = ''overtime'' үед хүссэн илүү цагийн тоо. Бусад төрөлд null.';


-- ---------------------------------------------------------------------------
-- RLS — цалин зөвхөн өөрийнх нь болон админд
-- ---------------------------------------------------------------------------

alter table public.payroll_rates      enable row level security;
alter table public.work_hour_entries  enable row level security;

-- Дуудаж буй хүн админ эсэхийг шалгах туслах
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

revoke execute on function public.is_admin_user() from public, anon;
grant  execute on function public.is_admin_user() to authenticated;

-- payroll_rates
drop policy if exists "payroll_rates_read" on public.payroll_rates;
create policy "payroll_rates_read" on public.payroll_rates
  for select using (user_id = auth.uid() or public.is_admin_user());

drop policy if exists "payroll_rates_write" on public.payroll_rates;
create policy "payroll_rates_write" on public.payroll_rates
  for all using (public.is_admin_user()) with check (public.is_admin_user());

-- work_hour_entries
drop policy if exists "work_hours_read" on public.work_hour_entries;
create policy "work_hours_read" on public.work_hour_entries
  for select using (user_id = auth.uid() or public.is_admin_user());

drop policy if exists "work_hours_write" on public.work_hour_entries;
create policy "work_hours_write" on public.work_hour_entries
  for all using (public.is_admin_user()) with check (public.is_admin_user());


-- ---------------------------------------------------------------------------
-- Тухайн өдөрт үйлчлэх ханшийг олох
-- ---------------------------------------------------------------------------
-- Цалин өөрчлөгдсөн түүхээс тухайн өдрийн үед хүчинтэй байсныг сонгоно.

create or replace function public.payroll_rate_at(p_user_id uuid, p_date date)
returns public.payroll_rates
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.payroll_rates
  where user_id = p_user_id
    and effective_from <= p_date
  order by effective_from desc
  limit 1;
$$;

revoke execute on function public.payroll_rate_at(uuid, date) from public, anon;
grant  execute on function public.payroll_rate_at(uuid, date) to authenticated;


-- ---------------------------------------------------------------------------
-- Хугацааны цалин тооцох
-- ---------------------------------------------------------------------------
-- Өдөр бүрийн ханшийг тухайн үеийнхээр авч тооцно.
--   үндсэн   = regular_hours / standard_hours × daily_rate
--   илүү цаг = overtime_hours × (daily_rate / standard_hours) × multiplier

create or replace function public.payroll_summary(
  p_user_id uuid,
  p_from date,
  p_to date
)
returns table (
  user_id uuid,
  user_name text,
  days_worked integer,
  regular_hours numeric,
  overtime_hours numeric,
  regular_pay numeric,
  overtime_pay numeric,
  total_pay numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (p_user_id = auth.uid() or public.is_admin_user()) then
    raise exception 'forbidden';
  end if;

  return query
  with entries as (
    select
      w.user_id,
      w.user_name,
      w.work_date,
      w.regular_hours,
      w.overtime_hours,
      r.daily_rate,
      r.standard_hours,
      r.overtime_multiplier
    from public.work_hour_entries w
    left join lateral (
      select * from public.payroll_rates pr
      where pr.user_id = w.user_id and pr.effective_from <= w.work_date
      order by pr.effective_from desc limit 1
    ) r on true
    where w.user_id = p_user_id
      and w.work_date between p_from and p_to
  )
  select
    p_user_id,
    max(e.user_name),
    count(*)::integer,
    coalesce(sum(e.regular_hours), 0),
    coalesce(sum(e.overtime_hours), 0),
    coalesce(sum(
      e.regular_hours / nullif(e.standard_hours, 0) * e.daily_rate
    ), 0),
    coalesce(sum(
      e.overtime_hours * (e.daily_rate / nullif(e.standard_hours, 0)) * e.overtime_multiplier
    ), 0),
    coalesce(sum(
      e.regular_hours / nullif(e.standard_hours, 0) * e.daily_rate
      + e.overtime_hours * (e.daily_rate / nullif(e.standard_hours, 0)) * e.overtime_multiplier
    ), 0)
  from entries e;
end;
$$;

revoke execute on function public.payroll_summary(uuid, date, date) from public, anon;
grant  execute on function public.payroll_summary(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
