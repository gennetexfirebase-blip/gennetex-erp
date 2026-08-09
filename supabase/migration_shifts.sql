-- Ажилтны хуваарь + амралт + ирц/очлог сайжруулалт
-- Эхлээд attendance_locations үүсгэнэ (employee_shifts foreign key шаарддаг)

create table if not exists public.attendance_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_m integer not null default 200,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.attendance_locations enable row level security;
drop policy if exists "attendance_locations_all" on public.attendance_locations;
create policy "attendance_locations_all" on public.attendance_locations for all using (true) with check (true);

-- Хуваарь
create table if not exists public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  shift_date date not null,
  start_time text not null,
  end_time text not null,
  location_id uuid references public.attendance_locations(id) on delete set null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (user_id, shift_date)
);

create index if not exists employee_shifts_date_idx on public.employee_shifts (shift_date, user_id);

-- Амралт (зөвхөн админ оруулна)
create table if not exists public.work_breaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  work_date date not null default current_date,
  minutes integer not null default 0,
  note text,
  created_at timestamptz default now()
);

create index if not exists work_breaks_user_date_idx on public.work_breaks (user_id, work_date);

-- Амралтын өдөр (Даваа–Ням)
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

alter table public.employee_break_schedules enable row level security;
drop policy if exists "employee_break_schedules_all" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_select" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_insert" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_update" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_delete" on public.employee_break_schedules;

grant select, insert, update, delete on public.employee_break_schedules to anon, authenticated;

create policy "employee_break_schedules_select" on public.employee_break_schedules
  for select to anon, authenticated using (true);
create policy "employee_break_schedules_insert" on public.employee_break_schedules
  for insert to anon, authenticated with check (true);
create policy "employee_break_schedules_update" on public.employee_break_schedules
  for update to anon, authenticated using (true) with check (true);
create policy "employee_break_schedules_delete" on public.employee_break_schedules
  for delete to anon, authenticated using (true);

-- Ирц, очлог сайжруулалт
alter table public.attendance add column if not exists location_name text;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'visit_logs'
  ) then
    alter table public.visit_logs add column if not exists photo_url text;
    alter table public.visit_logs add column if not exists face_verified boolean default false;
    alter table public.visit_logs add column if not exists location_name text;
  end if;
end $$;

alter table public.employee_shifts enable row level security;
alter table public.work_breaks enable row level security;

drop policy if exists "employee_shifts_all" on public.employee_shifts;
create policy "employee_shifts_all" on public.employee_shifts for all using (true) with check (true);

drop policy if exists "work_breaks_all" on public.work_breaks;
create policy "work_breaks_all" on public.work_breaks for all using (true) with check (true);

-- PostgREST schema cache шинэчлэх
notify pgrst, 'reload schema';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employee_shifts'
  ) then
    alter publication supabase_realtime add table public.employee_shifts;
  end if;
end $$;
