-- Ажлын байр (баг) + ажилтны мэдээлэл өргөтгөл

alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists address text;

create table if not exists public.field_site_sessions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  driver_id uuid references auth.users(id) on delete set null,
  driver_name text,
  site_name text not null,
  site_address text,
  latitude double precision,
  longitude double precision,
  passengers jsonb default '[]'::jsonb,
  arrived_at timestamptz,
  departed_at timestamptz,
  work_note text,
  status text not null default 'pending',
  submitted_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists field_site_sessions_trip_idx on public.field_site_sessions (trip_id, created_at desc);
create index if not exists field_site_sessions_day_idx on public.field_site_sessions (created_at desc);
create index if not exists field_site_sessions_status_idx on public.field_site_sessions (status, created_at desc);

alter table public.field_site_sessions enable row level security;
grant select, insert, update on public.field_site_sessions to anon, authenticated;

drop policy if exists "field_site_sessions_all" on public.field_site_sessions;
create policy "field_site_sessions_all" on public.field_site_sessions for all to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
