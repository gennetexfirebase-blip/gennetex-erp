-- Бараа/багажын нэмэлт мэдээлэл: model, serial, brand, company

alter table public.inventory add column if not exists model text;
alter table public.inventory add column if not exists serial_number text;
alter table public.inventory add column if not exists brand text;
alter table public.inventory add column if not exists company text;

create index if not exists inventory_serial_idx on public.inventory (serial_number);

notify pgrst, 'reload schema';
