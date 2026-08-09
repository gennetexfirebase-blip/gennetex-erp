-- RLS алдаа засах: employee_break_schedules (+ холбоотой хүснэгтүүд)
-- Supabase SQL Editor дээр ажиллуулна

-- Хүснэгт байхгүй бол үүсгэнэ
create table if not exists public.employee_break_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (user_id, day_of_week)
);

alter table public.employee_break_schedules drop column if exists start_time;
alter table public.employee_break_schedules drop column if exists end_time;

-- Эрх олгох (шинэ хүснэгтэд заавал хэрэгтэй)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.employee_break_schedules to anon, authenticated;
grant all on public.employee_break_schedules to service_role;

grant select, insert, update, delete on public.employee_shifts to anon, authenticated;
grant select, insert, update, delete on public.work_breaks to anon, authenticated;

alter table public.employee_break_schedules enable row level security;
alter table public.employee_shifts enable row level security;
alter table public.work_breaks enable row level security;

-- Хуучин бодлогуудыг цэвэрлэх
drop policy if exists "employee_break_schedules_all" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_select" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_insert" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_update" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_delete" on public.employee_break_schedules;

drop policy if exists "employee_shifts_all" on public.employee_shifts;
drop policy if exists "employee_shifts_select" on public.employee_shifts;
drop policy if exists "employee_shifts_insert" on public.employee_shifts;
drop policy if exists "employee_shifts_update" on public.employee_shifts;
drop policy if exists "employee_shifts_delete" on public.employee_shifts;

drop policy if exists "work_breaks_all" on public.work_breaks;
drop policy if exists "work_breaks_select" on public.work_breaks;
drop policy if exists "work_breaks_insert" on public.work_breaks;
drop policy if exists "work_breaks_update" on public.work_breaks;
drop policy if exists "work_breaks_delete" on public.work_breaks;

-- employee_break_schedules
create policy "employee_break_schedules_select" on public.employee_break_schedules
  for select to anon, authenticated using (true);
create policy "employee_break_schedules_insert" on public.employee_break_schedules
  for insert to anon, authenticated with check (true);
create policy "employee_break_schedules_update" on public.employee_break_schedules
  for update to anon, authenticated using (true) with check (true);
create policy "employee_break_schedules_delete" on public.employee_break_schedules
  for delete to anon, authenticated using (true);

-- employee_shifts
create policy "employee_shifts_select" on public.employee_shifts
  for select to anon, authenticated using (true);
create policy "employee_shifts_insert" on public.employee_shifts
  for insert to anon, authenticated with check (true);
create policy "employee_shifts_update" on public.employee_shifts
  for update to anon, authenticated using (true) with check (true);
create policy "employee_shifts_delete" on public.employee_shifts
  for delete to anon, authenticated using (true);

-- work_breaks
create policy "work_breaks_select" on public.work_breaks
  for select to anon, authenticated using (true);
create policy "work_breaks_insert" on public.work_breaks
  for insert to anon, authenticated with check (true);
create policy "work_breaks_update" on public.work_breaks
  for update to anon, authenticated using (true) with check (true);
create policy "work_breaks_delete" on public.work_breaks
  for delete to anon, authenticated using (true);

notify pgrst, 'reload schema';
