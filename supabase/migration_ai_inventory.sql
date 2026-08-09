-- AI Inventory Counting module
-- Supabase → SQL Editor дээр Run хийнэ.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  barcode text,
  qr_code text,
  category text default 'material',
  brand text,
  warehouse text,
  shelf text,
  stock numeric not null default 0,
  min_stock numeric not null default 0,
  purchase_price numeric default 0,
  selling_price numeric default 0,
  description text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.products add column if not exists purchase_price numeric default 0;
alter table public.products add column if not exists selling_price numeric default 0;
alter table public.products add column if not exists description text;
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_sku_idx on public.products (sku);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  image_url text not null,
  is_training boolean default true,
  created_at timestamptz default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id);

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  expected_stock numeric not null default 0,
  detected_stock numeric not null default 0,
  adjusted_stock numeric,
  difference numeric,
  confidence numeric,
  evidence_url text,
  employee_id uuid,
  employee_name text,
  warehouse text,
  status text default 'draft',
  notes text,
  created_at timestamptz default now()
);
create index if not exists inventory_counts_created_idx on public.inventory_counts (created_at desc);
create index if not exists inventory_counts_employee_idx on public.inventory_counts (employee_id, created_at desc);

create table if not exists public.inventory_history (
  id uuid primary key default gen_random_uuid(),
  count_id uuid references public.inventory_counts(id) on delete cascade,
  product_id uuid,
  product_name text,
  expected_stock numeric,
  detected_stock numeric,
  adjusted_stock numeric,
  difference numeric,
  evidence_url text,
  employee_id uuid,
  employee_name text,
  warehouse text,
  created_at timestamptz default now()
);
create index if not exists inventory_history_created_idx on public.inventory_history (created_at desc);

create table if not exists public.ai_detection_logs (
  id uuid primary key default gen_random_uuid(),
  count_id uuid references public.inventory_counts(id) on delete set null,
  product_id uuid,
  track_id text,
  confidence numeric,
  bbox_json jsonb,
  frame_url text,
  employee_id uuid,
  created_at timestamptz default now()
);
create index if not exists ai_detection_logs_count_idx on public.ai_detection_logs (count_id);

insert into storage.buckets (id, name, public)
values ('ai-inventory', 'ai-inventory', true)
on conflict (id) do update set public = true;

drop policy if exists "ai_inventory_read" on storage.objects;
create policy "ai_inventory_read" on storage.objects
  for select using (bucket_id = 'ai-inventory');

drop policy if exists "ai_inventory_write" on storage.objects;
create policy "ai_inventory_write" on storage.objects
  for insert with check (bucket_id = 'ai-inventory');

drop policy if exists "ai_inventory_update" on storage.objects;
create policy "ai_inventory_update" on storage.objects
  for update using (bucket_id = 'ai-inventory');

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory_counts enable row level security;
alter table public.inventory_history enable row level security;
alter table public.ai_detection_logs enable row level security;

drop policy if exists "products_all" on public.products;
create policy "products_all" on public.products for all using (true) with check (true);

drop policy if exists "product_images_all" on public.product_images;
create policy "product_images_all" on public.product_images for all using (true) with check (true);

drop policy if exists "inventory_counts_all" on public.inventory_counts;
create policy "inventory_counts_all" on public.inventory_counts for all using (true) with check (true);

drop policy if exists "inventory_history_all" on public.inventory_history;
create policy "inventory_history_all" on public.inventory_history for all using (true) with check (true);

drop policy if exists "ai_detection_logs_all" on public.ai_detection_logs;
create policy "ai_detection_logs_all" on public.ai_detection_logs for all using (true) with check (true);

notify pgrst, 'reload schema';
