-- ---------------------------------------------------------------------------
-- Ажилчдын гүйцэтгэл — багийн ӨДРИЙН бүртгэл
-- ---------------------------------------------------------------------------
-- ЯАГААД:
--   "Нийт хэдэн баг · өдөрт хэдэн айл · нийт хэр хугацаанд · 1 баг өдөрт
--   хэдэн айл" гэсэн үзүүлэлтийг систем нь `service_calls` (айл/байгууллага)
--   ба `field_site_sessions` (ажлын байр дээр байсан хугацаа)-аас өөрөө
--   тооцно. Гэвч бодит амьдрал дээр системд ороогүй ажил (гараар бичсэн
--   хуудас, гэрээт баг, хуучин сарын дүн) байдаг. Түүнийг Excel-ээр
--   ОРУУЛЖ ирэх газар нь энэ хүснэгт.
--
--   Тиймээс тайлан нь ХОЁР эх сурвалжтай:
--     system — service_calls + field_site_sessions (автоматаар)
--     import — энэ хүснэгт (Excel-ээс)
--   Хоёулаа нэг л томьёогоор нэгтгэгдэнэ.
--
-- Supabase → SQL Editor дээр Run хийнэ.

create table if not exists public.team_performance_entries (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  team_name text not null,
  members text,
  ail_count integer not null default 0 check (ail_count >= 0),
  baiguulga_count integer not null default 0 check (baiguulga_count >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  note text,
  -- Аль импортын багц вэ — буруу оруулсан бол багцаар нь буцааж устгана.
  batch_id uuid,
  batch_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Нэг өдөр · нэг баг = НЭГ мөр. Дахин импортлоход хуучин мөр нь
-- ШИНЭЧЛЭГДЭНЭ (upsert), давхардаж хуримтлагдахгүй.
--
-- ⚠️ Багана нь ЯГ (work_date, team_name) байх ёстой — `lower(btrim(...))`
--    гэх мэт функцэн индекс дээр PostgREST-ийн `on_conflict=work_date,
--    team_name` таарахгүй тул upsert нь алдаа өгнө. Нэрийн зай/том жижиг
--    үсгийг импортлохын өмнө клиент талд цэвэрлэдэг.
create unique index if not exists team_performance_entries_day_team_uniq
  on public.team_performance_entries (work_date, team_name);

create index if not exists team_performance_entries_date_idx
  on public.team_performance_entries (work_date desc);
create index if not exists team_performance_entries_batch_idx
  on public.team_performance_entries (batch_id);

alter table public.team_performance_entries enable row level security;

-- Гүйцэтгэлийн тайлан бол удирдлагын мэдээлэл — админаас дээш,
-- эсвэл `employees` эрх тусгайлан нээлгэсэн хүн.
drop policy if exists "team_performance_read"  on public.team_performance_entries;
create policy "team_performance_read" on public.team_performance_entries
  for select to authenticated
  using (public.is_admin_user() or public.has_permission('employees'));

drop policy if exists "team_performance_write" on public.team_performance_entries;
create policy "team_performance_write" on public.team_performance_entries
  for all to authenticated
  using (public.is_admin_user() or public.has_permission('employees'))
  with check (public.is_admin_user() or public.has_permission('employees'));

grant select, insert, update, delete on public.team_performance_entries to authenticated;

notify pgrst, 'reload schema';
