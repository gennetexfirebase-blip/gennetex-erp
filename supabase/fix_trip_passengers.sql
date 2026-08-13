-- Хамт яваа хүн: QR уншилт + аяллын зорчигч бүртгэл
-- Supabase SQL Editor дээр ажиллуулна.

alter table public.profiles add column if not exists badge_code text unique;

create table if not exists public.trip_passengers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  passenger_id uuid references auth.users(id) on delete set null,
  passenger_name text not null,
  scanned_at timestamptz default now()
);

create index if not exists trip_passengers_trip_idx on public.trip_passengers (trip_id, scanned_at);
create index if not exists trip_passengers_user_idx on public.trip_passengers (passenger_id, scanned_at desc);
create index if not exists profiles_badge_code_idx on public.profiles (badge_code);

alter table public.trip_passengers enable row level security;

grant select, insert, delete on public.trip_passengers to anon, authenticated;

drop policy if exists "trip_passengers_read" on public.trip_passengers;
create policy "trip_passengers_read" on public.trip_passengers for select to anon, authenticated using (true);

drop policy if exists "trip_passengers_write" on public.trip_passengers;
create policy "trip_passengers_write" on public.trip_passengers for all to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
