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
  att_status text;
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
      else null
    end;

    if att_type is not null then
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
        (
          (req.requested_date::text || ' ' || coalesce(req.requested_time, '09:00'))::timestamp
          at time zone 'Asia/Ulaanbaatar'
        )
      )
      on conflict do nothing;
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

notify pgrst, 'reload schema';
