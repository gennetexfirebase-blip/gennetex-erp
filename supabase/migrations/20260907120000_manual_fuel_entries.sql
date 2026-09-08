-- Employee-reported consumption is separate from calculated GPS trips and refills.
create table public.manual_fuel_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  consumed_on date not null,
  liters numeric(12,2) not null check (liters > 0 and liters <= 10000),
  cost numeric(14,2) not null check (cost > 0 and cost <= 100000000),
  distance_km numeric(12,2) not null default 0 check (distance_km >= 0 and distance_km <= 100000),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint manual_fuel_date_valid check (consumed_on >= date '2000-01-01' and consumed_on <= (now() at time zone 'Asia/Ulaanbaatar')::date)
);
create index manual_fuel_user_date on public.manual_fuel_entries(user_id, consumed_on desc);
create index manual_fuel_date on public.manual_fuel_entries(consumed_on desc);
alter table public.manual_fuel_entries enable row level security;
revoke all on public.manual_fuel_entries from anon, authenticated;
grant select on public.manual_fuel_entries to authenticated;
grant insert (id, user_id, vehicle_id, consumed_on, liters, cost, distance_km, note)
  on public.manual_fuel_entries to authenticated;
create policy manual_fuel_read on public.manual_fuel_entries for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
create policy manual_fuel_insert on public.manual_fuel_entries for insert to authenticated
  with check (user_id = (select auth.uid()));
