-- Амралтын өдөр (Даваа–Ням, цаг биш)
-- Supabase SQL Editor дээр ажиллуулна

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

create index if not exists employee_break_schedules_user_idx
  on public.employee_break_schedules (user_id, day_of_week);

grant select, insert, update, delete on public.employee_break_schedules to anon, authenticated;
grant all on public.employee_break_schedules to service_role;

alter table public.employee_break_schedules enable row level security;

drop policy if exists "employee_break_schedules_all" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_select" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_insert" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_update" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_delete" on public.employee_break_schedules;

create policy "employee_break_schedules_select" on public.employee_break_schedules
  for select to anon, authenticated using (true);
create policy "employee_break_schedules_insert" on public.employee_break_schedules
  for insert to anon, authenticated with check (true);
create policy "employee_break_schedules_update" on public.employee_break_schedules
  for update to anon, authenticated using (true) with check (true);
create policy "employee_break_schedules_delete" on public.employee_break_schedules
  for delete to anon, authenticated using (true);

notify pgrst, 'reload schema';
