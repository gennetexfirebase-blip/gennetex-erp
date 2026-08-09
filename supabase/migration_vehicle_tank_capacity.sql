-- Машины бензиний савны багтаамж (%) тооцоолох
alter table public.vehicles add column if not exists tank_capacity_liters numeric default 60;

notify pgrst, 'reload schema';
