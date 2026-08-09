-- Ажилд орох анкет (taniulcuulga web-ээс public илгээгдэнэ)
-- adiya.site careers form → job_applications → admin web + admin app (push)

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  last_name text,
  phone text,
  email text,
  position text,
  message text,
  cv_url text,
  source text default 'web',
  status text not null default 'new', -- new | reviewing | contacted | hired | rejected
  created_at timestamptz default now()
);

create index if not exists job_applications_created_idx
  on public.job_applications (created_at desc);
create index if not exists job_applications_status_idx
  on public.job_applications (status, created_at desc);

alter table public.job_applications enable row level security;

-- Нээлттэй форм — хэн ч (anon) анкет илгээж болно
drop policy if exists "job_applications_insert" on public.job_applications;
create policy "job_applications_insert" on public.job_applications
  for insert to anon, authenticated with check (true);

-- Зөвхөн админ/системийн админ жагсаалт харна, төлөв өөрчилнө
drop policy if exists "job_applications_admin_read" on public.job_applications;
create policy "job_applications_admin_read" on public.job_applications
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
  );

drop policy if exists "job_applications_admin_update" on public.job_applications;
create policy "job_applications_admin_update" on public.job_applications
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
  );

drop policy if exists "job_applications_admin_delete" on public.job_applications;
create policy "job_applications_admin_delete" on public.job_applications
  for delete to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
  );

grant insert on public.job_applications to anon;
grant select, insert, update, delete on public.job_applications to authenticated;

notify pgrst, 'reload schema';
