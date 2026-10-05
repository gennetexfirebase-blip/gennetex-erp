-- The operational alert feed supports a per-item threshold, but inventory
-- installations created from the main migration chain did not have this
-- legacy column. Keep 0 as an explicit per-item threshold and let NULL fall
-- back to company_settings.default_min_stock in get_operational_alerts().

alter table public.inventory
  add column if not exists min_stock numeric default 0;

alter table public.inventory
  alter column min_stock set default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory'::regclass
      and conname = 'inventory_min_stock_nonneg'
  ) then
    alter table public.inventory
      add constraint inventory_min_stock_nonneg
      check (min_stock is null or min_stock >= 0) not valid;
  end if;
end;
$$;

create index if not exists inventory_low_stock_idx
  on public.inventory (category, quantity)
  where min_stock > 0;

notify pgrst, 'reload schema';
