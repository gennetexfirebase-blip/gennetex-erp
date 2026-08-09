-- Ажилтны тайлан — зөвхөн энэ файлыг Supabase SQL Editor дээр ажиллуулна
-- (employee_reports хүснэгт байхгүй үед)

-- 1. Профайл дээр гарын үсгийн URL
alter table public.profiles add column if not exists report_signature_url text;

-- 2. Тайлангийн хүснэгт
create table if not exists public.employee_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  report_type text not null,
  title text not null,
  body_html text,
  payload jsonb,
  signature_url text,
  pdf_url text,
  created_at timestamptz default now()
);

alter table public.employee_reports add column if not exists pdf_url text;

create index if not exists employee_reports_created_idx on public.employee_reports (created_at desc);
create index if not exists employee_reports_user_idx on public.employee_reports (user_id, created_at desc);

-- 3. RLS
alter table public.employee_reports enable row level security;

drop policy if exists "employee_reports_all" on public.employee_reports;
create policy "employee_reports_all" on public.employee_reports
  for all using (true) with check (true);

-- 4. Realtime (байвал алгасна)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'employee_reports'
  ) then
    alter publication supabase_realtime add table public.employee_reports;
  end if;
exception
  when others then null;
end $$;

-- 5. Storage — гарын үсэг
insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict (id) do nothing;

drop policy if exists "reports_read" on storage.objects;
create policy "reports_read" on storage.objects
  for select using (bucket_id = 'reports');

drop policy if exists "reports_write" on storage.objects;
create policy "reports_write" on storage.objects
  for insert with check (bucket_id = 'reports');

drop policy if exists "reports_update" on storage.objects;
create policy "reports_update" on storage.objects
  for update using (bucket_id = 'reports');

drop policy if exists "reports_delete" on storage.objects;
create policy "reports_delete" on storage.objects
  for delete using (bucket_id = 'reports');
