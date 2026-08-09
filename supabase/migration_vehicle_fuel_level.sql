-- Машины бензиний үлдэгдэл (%)
alter table public.vehicles
  add column if not exists fuel_level_percent numeric default 100 check (fuel_level_percent >= 0 and fuel_level_percent <= 100);

alter table public.vehicles
  add column if not exists fuel_refilled_at timestamptz default now();

notify pgrst, 'reload schema';
