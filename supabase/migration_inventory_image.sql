-- Бараа материалын зураг (админ оруулна)

alter table public.inventory add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('inventory', 'inventory', true)
on conflict (id) do nothing;

drop policy if exists "inventory_read" on storage.objects;
create policy "inventory_read" on storage.objects
  for select using (bucket_id = 'inventory');

drop policy if exists "inventory_write" on storage.objects;
create policy "inventory_write" on storage.objects
  for insert with check (bucket_id = 'inventory');

drop policy if exists "inventory_update" on storage.objects;
create policy "inventory_update" on storage.objects
  for update using (bucket_id = 'inventory');

notify pgrst, 'reload schema';
