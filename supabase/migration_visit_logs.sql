-- Очсон лог (visit_logs) — хүснэгт байхгүй бол үүсгэнэ
create table if not exists public.visit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  user_name text,
  call_id text,
  customer text,
  problem text,
  call_type text,
  latitude double precision,
  longitude double precision,
  photo_url text,
  face_verified boolean default false,
  location_name text,
  arrived_at timestamptz default now()
);

alter table public.visit_logs enable row level security;
grant select, insert, update on public.visit_logs to anon, authenticated;

drop policy if exists "visit_logs_all" on public.visit_logs;
create policy "visit_logs_all" on public.visit_logs for all to anon, authenticated using (true) with check (true);
