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

notify pgrst, 'reload schema';
