-- Бензиний тохиргоо (зөвхөн админ засна)
create table if not exists public.fuel_settings (
  id int primary key default 1 check (id = 1),
  liters_per_100km numeric not null default 12,
  price_per_liter numeric not null default 2600,
  idle_liters_per_hour numeric not null default 1.2,
  updated_at timestamptz default now()
);

insert into public.fuel_settings (id) values (1) on conflict (id) do nothing;

alter table public.trips add column if not exists idle_seconds integer default 0;

alter table public.fuel_settings enable row level security;

grant select on public.fuel_settings to anon, authenticated;
grant insert, update on public.fuel_settings to anon, authenticated;

drop policy if exists "fuel_settings_read" on public.fuel_settings;
create policy "fuel_settings_read" on public.fuel_settings for select to anon, authenticated using (true);

drop policy if exists "fuel_settings_write" on public.fuel_settings;
create policy "fuel_settings_write" on public.fuel_settings for all to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
