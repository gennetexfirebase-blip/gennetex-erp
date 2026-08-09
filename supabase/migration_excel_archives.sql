-- Excel архив — бүх экспортыг lifetime хадгална
-- Supabase SQL Editor дээр ажиллуулна

create table if not exists public.excel_archives (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  filename text not null,
  storage_path text not null,
  file_url text,
  sheet_names jsonb not null default '[]'::jsonb,
  sheet_counts jsonb not null default '{}'::jsonb,
  row_count int not null default 0,
  export_year int not null,
  export_month int not null,
  export_day int not null,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists excel_archives_ymd_idx
  on public.excel_archives (export_year, export_month, export_day desc);

create index if not exists excel_archives_cat_idx
  on public.excel_archives (category, created_at desc);

alter table public.excel_archives enable row level security;

drop policy if exists "excel_archives_read" on public.excel_archives;
create policy "excel_archives_read" on public.excel_archives
  for select to authenticated using (true);

drop policy if exists "excel_archives_insert" on public.excel_archives;
create policy "excel_archives_insert" on public.excel_archives
  for insert to authenticated with check (true);

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('excel-exports', 'excel-exports', true)
on conflict (id) do nothing;

drop policy if exists "excel_exports_read" on storage.objects;
create policy "excel_exports_read" on storage.objects
  for select using (bucket_id = 'excel-exports');

drop policy if exists "excel_exports_write" on storage.objects;
create policy "excel_exports_write" on storage.objects
  for insert with check (bucket_id = 'excel-exports');

drop policy if exists "excel_exports_update" on storage.objects;
create policy "excel_exports_update" on storage.objects
  for update using (bucket_id = 'excel-exports');

-- Realtime (сонголттой)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'excel_archives'
  ) then
    alter publication supabase_realtime add table public.excel_archives;
  end if;
end $$;
