-- ============================================================================
-- ИРЦИЙН МОДУЛЬ — БҮХ MIGRATION НЭГ ФАЙЛД (2026-08-26)
-- ============================================================================
--
-- ЯАЖ АЖИЛЛУУЛАХ:
--   Supabase → SQL Editor → энэ файлыг бүтнээр нь хуулж → Run
--
-- Бүх алхам ДАХИН АЖИЛЛУУЛАХАД АЮУЛГҮЙ (idempotent):
--   create table if not exists / drop policy if exists / create or replace
-- Тиймээс аль нэг нь аль хэдийн ажилласан байсан ч алдаа гарахгүй.
--
-- Агуулга (8 файл):
--   1. 20260826120000_attendance_requests.sql
--   2. 20260826120100_attendance_wifi.sql
--   3. 20260826120200_attendance_location_employees.sql
--   4. 20260826120300_departments_hierarchy.sql
--   5. 20260826120400_shift_rls_hardening.sql
--   6. 20260826120500_attendance_summary_functions.sql
--   7. 20260826120600_notification_campaigns.sql
--   8. 20260826130000_fix_attendance_visibility.sql
-- ============================================================================

begin;


-- ###########################################################################
-- # 20260826120000_attendance_requests.sql
-- ###########################################################################

-- ============================================================================
-- ИРЦИЙН ЦАГИЙН ХҮСЭЛТ (attendance_requests)
-- ============================================================================
--
-- ЯАГААД ШИНЭ ХҮСНЭГТ:
--   Одоо байгаа `leave_requests` нь огнооны ХҮРЭЭ (date_from/date_to) дээр
--   суурилсан — Чөлөө, Амралт, Илүү цагийн хүсэлт (kind='overtime',
--   src/services/payrollService.js) зэрэгт тохирно. Гэвч "Зайнаас цаг
--   бүртгүүлэх", "Ирсэн/Явсан цаг нөхөж бүртгүүлэх", "Ирц засуулах",
--   "Хоцролт тайлбарлах" зэрэг нь НЭГ өдрийн НЭГ цагийн үйл явдал бөгөөд
--   зөвшөөрөгдвол `attendance` хүснэгтэд бодит мөр үүсгэх/засах шаардлагатай
--   — `leave_requests`-ийн бүтэц үүнд тохирохгүй тул тусад нь үүсгэв.
--
--   Admin app-ийн "Хүсэлт" дэлгэц дээрх ХОЁР tab яг ийм хуваагдалтай:
--     "Цагийн хүсэлт"   → энэ хүснэгт (attendance_requests)
--     "Ажилтны хүсэлт"  → одоо байгаа leave_requests (өөрчлөлтгүй)
--
-- ЗӨВШӨӨРӨХ ЛОГИК: `admin_decide_attendance_request()` — админ
-- зөвшөөрөхөд шаардлагатай бол `attendance` мөр үүсгэнэ/шинэчилнэ, татгалзвал
-- зөвхөн төлөвийг өөрчилнө. Аль ч тохиолдолд `activity_logs`-д тэмдэглэнэ
-- (шинэ audit table үүсгэхгүй — одоо байгаагаа ашиглана).
-- ============================================================================

create table if not exists public.attendance_requests (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references auth.users(id) on delete cascade,
  employee_name     text,
  type              text not null check (type in (
                       'remote_check_in',      -- Зайнаас цаг бүртгүүлэх (Ирэх)
                       'remote_check_out',      -- Зайнаас цаг бүртгүүлэх (Явах)
                       'makeup_check_in',       -- Ирсэн цаг нөхөж бүртгүүлэх
                       'makeup_check_out',      -- Явсан цаг нөхөж бүртгүүлэх
                       'attendance_correction', -- Ирц засуулах
                       'late_explanation',      -- Хоцролт тайлбарлах
                       'business_trip',         -- Томилолт
                       'remote_work',           -- Зайнаас ажиллах
                       'telecommute'            -- Цахимаар ажиллах
                     )),
  requested_date    date not null,
  requested_time    text,               -- 'HH:MM', employee_shifts-тэй ижил хэлбэр
  -- Аль цагийг хөндөж буй вэ (ирсэн үү, явсан уу). "Ирц засуулах" гэх мэт
  -- төрөл дээр ЗААВАЛ хэрэгтэй — эс бөгөөс аль мөрийг засахыг мэдэхгүй.
  direction         text check (direction in ('check_in', 'check_out')),
  reason            text,
  attachments       jsonb not null default '[]'::jsonb,
  status            text not null default 'pending'
                       check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by        uuid references auth.users(id) on delete set null,
  reviewed_at        timestamptz,
  rejection_reason   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists attendance_requests_employee_idx
  on public.attendance_requests (employee_id, created_at desc);
create index if not exists attendance_requests_status_idx
  on public.attendance_requests (status, requested_date desc);

alter table public.attendance_requests enable row level security;

-- Өөрийнх + админ уншина.
drop policy if exists "attendance_requests_read" on public.attendance_requests;
create policy "attendance_requests_read" on public.attendance_requests
  for select to authenticated
  using (employee_id = auth.uid() or public.is_admin_user());

-- Зөвхөн өөрийн нэрээр илгээнэ.
drop policy if exists "attendance_requests_insert" on public.attendance_requests;
create policy "attendance_requests_insert" on public.attendance_requests
  for insert to authenticated
  with check (employee_id = auth.uid());

-- Шууд UPDATE-ийг зөвхөн админд нээнэ (гар аргаар засах шаардлагатай бол).
-- Ажилтны цуцлах, админы зөвшөөрөх/татгалзах нь доорх RPC-ээр явна
-- (security definer тул RLS-ээс үл хамаарна).
drop policy if exists "attendance_requests_update" on public.attendance_requests;
create policy "attendance_requests_update" on public.attendance_requests
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update on public.attendance_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Ажилтан өөрийн ХҮЛЭЭГДЭЖ буй хүсэлтээ цуцлах
-- ---------------------------------------------------------------------------
create or replace function public.cancel_attendance_request(p_request_id uuid)
returns public.attendance_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  result   public.attendance_requests%rowtype;
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;

  update public.attendance_requests
     set status = 'cancelled', updated_at = now()
   where id = p_request_id
     and employee_id = actor_id
     and status = 'pending'
  returning * into result;

  if not found then raise exception 'not_found_or_not_pending'; end if;
  return result;
end;
$$;

revoke execute on function public.cancel_attendance_request(uuid) from public, anon;
grant  execute on function public.cancel_attendance_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Админ зөвшөөрөх/татгалзах — шаардлагатай бол attendance мөр үүсгэнэ
-- ---------------------------------------------------------------------------
create or replace function public.admin_decide_attendance_request(
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns public.attendance_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id   uuid := auth.uid();
  actor_name text;
  req        public.attendance_requests%rowtype;
  att_type   text;
  target_ts  timestamptz;
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'invalid_decision'; end if;

  select * into req from public.attendance_requests where id = p_request_id;
  if req.id is null then raise exception 'not_found'; end if;
  if req.status not in ('pending') then raise exception 'already_decided'; end if;

  select p.name into actor_name from public.profiles p where p.id = actor_id;

  update public.attendance_requests
     set status = p_decision,
         reviewed_by = actor_id,
         reviewed_at = now(),
         rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end,
         updated_at = now()
   where id = p_request_id
  returning * into req;

  -- Зөвшөөрсөн бол зарим төрөл дээр бодит ирцийн мөр үүсгэнэ/шинэчилнэ.
  if p_decision = 'approved' then
    att_type := case req.type
      when 'remote_check_in'  then 'check_in'
      when 'remote_check_out' then 'check_out'
      when 'makeup_check_in'  then 'check_in'
      when 'makeup_check_out' then 'check_out'
      -- "Ирц засуулах" нь аль цагийг засахыг `direction`-оор заана.
      when 'attendance_correction' then req.direction
      else null
    end;

    if att_type is not null then
      target_ts := (
        (req.requested_date::text || ' ' || coalesce(req.requested_time, '09:00'))::timestamp
        at time zone 'Asia/Ulaanbaatar'
      );

      -- Тухайн өдрийн ижил төрлийн мөр АЛЬ ХЭДИЙН байвал ЗАСНА, эс бөгөөс
      -- шинээр үүсгэнэ. Өмнө нь зөвхөн `insert ... on conflict do nothing`
      -- байсан тул "Ирц засуулах"/"нөхөж бүртгүүлэх" нь мөр аль хэдийн
      -- байхад ЧИМЭЭГҮЙ юу ч хийхгүй өнгөрдөг байв.
      update public.attendance a
         set created_at = target_ts,
             status = 'approved',
             note = trim(both ' · ' from coalesce(a.note, '') || ' · ' ||
                    'Админ засав: ' || coalesce(req.reason, req.type))
       where a.staff_id = req.employee_id::text
         and a.type = att_type
         and a.status <> 'rejected'
         and (a.created_at at time zone 'Asia/Ulaanbaatar')::date = req.requested_date;

      if not found then
        insert into public.attendance (
          staff_id, staff_name, type, status, is_remote, note, location_name, created_at
        ) values (
          req.employee_id::text,
          req.employee_name,
          att_type,
          'approved',
          true,
          coalesce(req.reason, ''),
          null,
          target_ts
        )
        on conflict do nothing;
      end if;
    end if;
  end if;

  -- Аудит — шинэ хүснэгт үүсгэхгүй, байгаа activity_logs ашиглана.
  insert into public.activity_logs (user_id, user_name, action, screen, detail)
  values (
    actor_id,
    actor_name,
    'attendance',
    'AttendanceRequests',
    format('Хүсэлт #%s → %s (%s)', p_request_id, p_decision, coalesce(p_rejection_reason, req.type))
  );

  return req;
end;
$$;

revoke execute on function public.admin_decide_attendance_request(uuid, text, text) from public, anon;
grant  execute on function public.admin_decide_attendance_request(uuid, text, text) to authenticated;

-- Realtime — админы Хүсэлт жагсаалт шинэчлэгдмэгц шууд харагдана.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_requests'
  ) then
    alter publication supabase_realtime add table public.attendance_requests;
  end if;
end $$;


-- ###########################################################################
-- # 20260826120100_attendance_wifi.sql
-- ###########################################################################

-- ============================================================================
-- WI-FI-ЭЭР ИРЦ БАТАЛГААЖУУЛАХ (attendance_wifi)
-- ============================================================================
-- Админ тодорхой байгууллагын Wi-Fi (SSID/BSSID) тохируулж, ажилтан/хэлтэс
-- оноож болно. `attendance_locations.wifi_gateway_ip` багана өмнө нь
-- нэмэгдсэн ч ашиглагдаагүй байсан (frontend уншиж/бичдэггүй) — энэ
-- хүснэгт нь Wi-Fi тохиргооны жинхэнэ эх сурвалж болно.
-- ============================================================================

create table if not exists public.attendance_wifi (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  ssid         text not null,
  bssid        text,
  location_id  uuid references public.attendance_locations(id) on delete set null,
  description  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index if not exists attendance_wifi_active_idx on public.attendance_wifi (active);

alter table public.attendance_wifi enable row level security;

-- Уншихыг бүх нэвтэрсэн хэрэглэгчид нээнэ — ирц бүртгэхдээ өөрийн
-- утасны SSID тохирч байгаа эсэхийг апп дотроос шалгах ёстой (нэр/SSID
-- нь нууц мэдээлэл биш).
drop policy if exists "attendance_wifi_read" on public.attendance_wifi;
create policy "attendance_wifi_read" on public.attendance_wifi
  for select to authenticated
  using (true);

drop policy if exists "attendance_wifi_write" on public.attendance_wifi;
create policy "attendance_wifi_write" on public.attendance_wifi
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.attendance_wifi to authenticated;

-- ---------------------------------------------------------------------------
-- Wi-Fi → ажилтан оноолт
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_wifi_employees (
  wifi_id     uuid not null references public.attendance_wifi(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (wifi_id, employee_id)
);

alter table public.attendance_wifi_employees enable row level security;

-- Ажилтан зөвхөн ӨӨРТ нь оноогдсон эсэхийг л мэдэх хэрэгтэй.
drop policy if exists "attendance_wifi_employees_read" on public.attendance_wifi_employees;
create policy "attendance_wifi_employees_read" on public.attendance_wifi_employees
  for select to authenticated
  using (employee_id = auth.uid() or public.is_admin_user());

drop policy if exists "attendance_wifi_employees_write" on public.attendance_wifi_employees;
create policy "attendance_wifi_employees_write" on public.attendance_wifi_employees
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.attendance_wifi_employees to authenticated;


-- ###########################################################################
-- # 20260826120200_attendance_location_employees.sql
-- ###########################################################################

-- ============================================================================
-- ГЕОФЕНС БАЙРШИЛ → АЖИЛТАН ОНООЛТ (attendance_location_employees)
-- ============================================================================
-- Админ тодорхой геофенс байршлыг тодорхой ажилтнуудад (эсвэл томилохдоо
-- нэг бүрчлэн шийдсэн хэлтсийн гишүүдэд snapshot байдлаар) оноож болно.
-- `department_id`-аар ЛАЙВ шүүхгүй — оноосон мөчид тухайн хэлтсийн
-- гишүүдийг нэг бүрчлэн мөр болгож хадгална (хэлтэс дараа өөрчлөгдвөл
-- дахин оноох шаардлагатай, гэхдээ логик энгийн бөгөөд урьдчилан
-- таамаглах боломжтой хэвээр байна).
-- ============================================================================

create table if not exists public.attendance_location_employees (
  location_id uuid not null references public.attendance_locations(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (location_id, employee_id)
);

alter table public.attendance_location_employees enable row level security;

drop policy if exists "attendance_location_employees_read" on public.attendance_location_employees;
create policy "attendance_location_employees_read" on public.attendance_location_employees
  for select to authenticated
  using (employee_id = auth.uid() or public.is_admin_user());

drop policy if exists "attendance_location_employees_write" on public.attendance_location_employees;
create policy "attendance_location_employees_write" on public.attendance_location_employees
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.attendance_location_employees to authenticated;


-- ###########################################################################
-- # 20260826120300_departments_hierarchy.sql
-- ###########################################################################

-- ============================================================================
-- ХЭЛТСИЙН МОД (parent_id) — Admin "Алба хэлтэс" tree харагдац
-- ============================================================================
-- Нэмэлт багана л нэмнэ (одоо байгаа `departments`-ийг ашигладаг бусад
-- дэлгэц/query бүгд `id`/`name`-ээр ажилладаг тул нөлөөлөхгүй).
-- ============================================================================

alter table public.departments
  add column if not exists parent_id uuid references public.departments(id) on delete set null;

create index if not exists departments_parent_idx on public.departments (parent_id);


-- ###########################################################################
-- # 20260826120400_shift_rls_hardening.sql
-- ###########################################################################

-- ============================================================================
-- HIGH — ХУВААРЬ/АМРАЛТЫН ӨДРИЙН RLS-ИЙГ ХАТУУРУУЛАХ
-- ============================================================================
--
-- АСУУДАЛ:
--   `employee_shifts`, `work_breaks`, `employee_break_schedules` нь
--   `fix-frontend/supabase/migration_shifts.sql` / `migration_rest_days.sql`
--   / `migration_break_schedules_rls_fix.sql`-ээс хойш `using (true)` буюу
--   "нэвтэрсэн бол бүгдийг" горимд үлдсэн — 20260821110100 (`attendance`,
--   `messages`, `location_logs`, `activity_logs`) энд хүрч амжаагүй.
--   Энгийн ажилтан бусад бүх хүний хуваарь, амралтын өдрийг уншиж/бичиж
--   чадна (horizontal privilege escalation, OWASP IDOR).
--
-- ЗАСВАР:
--   Одоогийн апп код баримжаалахад (src/screens/AttendanceScreen.js,
--   src/services/shiftService.js) эдгээр гурван хүснэгтэд ЗӨВХӨН админ
--   бичдэг (`saveShift`, `saveBreakSchedule` нь `isAdmin` render хэсэгт
--   л дуудагддаг), ажилтан зөвхөн ӨӨРИЙНХӨӨ мөрийг уншдаг. Тиймээс
--   "өөрийнх нь мөр эсвэл админ" загварыг хэрэглэхэд одоогийн ажиллагаа
--   ЭВДЭХГҮЙ.
--
-- ⚠️ АЖИЛЛУУЛСНЫ ДАРАА ШАЛГАХ:
--   1. Ажилтнаар нэвтэрч өөрийн MyShift дэлгэц ажиллаж байгааг шалгах.
--   2. Админаар нэвтэрч Хуваарь оноох/Амралтын өдөр тохируулах ажиллаж
--      байгааг шалгах.
--   Хэрэв ажиллахгүй бол доорх бодлогуудыг буцаана:
--     create policy "employee_shifts_all" on public.employee_shifts
--       for all using (true) with check (true);
-- ============================================================================

alter table public.employee_shifts enable row level security;
alter table public.work_breaks enable row level security;
alter table public.employee_break_schedules enable row level security;

-- ---------------------------------------------------------------------------
-- employee_shifts — өөрийнх (унших) / админ (унших + бичих)
-- ---------------------------------------------------------------------------
drop policy if exists "employee_shifts_all" on public.employee_shifts;
drop policy if exists "employee_shifts_read" on public.employee_shifts;
create policy "employee_shifts_read" on public.employee_shifts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user());

drop policy if exists "employee_shifts_write" on public.employee_shifts;
create policy "employee_shifts_write" on public.employee_shifts
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- work_breaks — одоогоор аппын код унших/бичихгүй байгаа ч ижил зарчмаар
-- ---------------------------------------------------------------------------
drop policy if exists "work_breaks_all" on public.work_breaks;
drop policy if exists "work_breaks_read" on public.work_breaks;
create policy "work_breaks_read" on public.work_breaks
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user());

drop policy if exists "work_breaks_write" on public.work_breaks;
create policy "work_breaks_write" on public.work_breaks
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- employee_break_schedules — амралтын өдөр (нэр нь "break" ч агуулга нь rest day)
-- ---------------------------------------------------------------------------
drop policy if exists "employee_break_schedules_select" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_insert" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_update" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_delete" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_read"  on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_write" on public.employee_break_schedules;

create policy "employee_break_schedules_read" on public.employee_break_schedules
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user());

create policy "employee_break_schedules_write" on public.employee_break_schedules
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- `anon` аль хэдийн 20260821110000_anon_lockdown.sql-ээр хаагдсан;
-- эндээс `anon`-д ямар ч grant нэмэхгүй.
grant select, insert, update, delete on public.employee_shifts to authenticated;
grant select, insert, update, delete on public.work_breaks to authenticated;
grant select, insert, update, delete on public.employee_break_schedules to authenticated;


-- ###########################################################################
-- # 20260826120500_attendance_summary_functions.sql
-- ###########################################################################

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


-- ###########################################################################
-- # 20260826120600_notification_campaigns.sql
-- ###########################################################################

-- ============================================================================
-- ИЛГЭЭСЭН МЭДЭГДЛИЙН ТҮҮХ (notification_campaigns)
-- ============================================================================
-- `notifications` хүснэгт нь хүлээн авагч БҮР дээр нэг мөр — админы
-- "Мэдэгдэл илгээх" дэлгэц дээрх "Илгээсэн мэдэгдэл" жагсаалт нэг ЦОХИЛТ
-- (нэг товч дарсан үйлдэл) тутамд НЭГ мөр хардаг тул тусад нь бүртгэнэ.
-- Илгээх процесс өөрчлөгдөхгүй — энэ мөрийг үүсгээд, дараа нь одоо байгаа
-- `sendPushToRole/sendPushToUsers/sendPushToAll` (send-push edge function)
-- функцүүдийг ХЭВЭЭР дуудна.
-- ============================================================================

create table if not exists public.notification_campaigns (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text not null,
  audience_kind text not null check (audience_kind in ('all', 'department', 'users')),
  audience_ids  jsonb not null default '[]'::jsonb,  -- department_id эсвэл user_id жагсаалт
  image_url     text,
  deep_link     text,
  priority      text not null default 'default' check (priority in ('default', 'high')),
  sent_by       uuid references auth.users(id) on delete set null,
  sent_by_name  text,
  recipient_count int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists notification_campaigns_created_idx
  on public.notification_campaigns (created_at desc);

alter table public.notification_campaigns enable row level security;

-- Мэдэгдэл илгээх бол удирдлагын үйлдэл — админаас дээш л харна/бичнэ.
drop policy if exists "notification_campaigns_read" on public.notification_campaigns;
create policy "notification_campaigns_read" on public.notification_campaigns
  for select to authenticated
  using (public.is_admin_user());

drop policy if exists "notification_campaigns_insert" on public.notification_campaigns;
create policy "notification_campaigns_insert" on public.notification_campaigns
  for insert to authenticated
  with check (public.is_admin_user() and sent_by = auth.uid());

grant select, insert on public.notification_campaigns to authenticated;


-- ###########################################################################
-- # 20260826130000_fix_attendance_visibility.sql
-- ###########################################################################

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


commit;

-- PostgREST-д шинэ хүснэгт/функцийг таниулна.
notify pgrst, 'reload schema';
