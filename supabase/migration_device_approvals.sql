-- Шинэ төхөөрөмжийн зөвшөөрөл — ажилтан өөр төхөөрөмжөөр нэвтрэхэд
-- системийн админд (superadmin) мэдэгдэл очиж, зөвшөөрсний дараа л апп нээгдэнэ.
-- Тэмдэглэл: орчин үеийн Android/iOS жинхэнэ MAC хаяг өгдөггүй тул mac талбар нь
-- ихэвчлэн placeholder (02:00:00:00:00:00) байна. Гол таних тэмдэг нь device_id.

create table if not exists public.device_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  device_id text not null,
  device_model text,
  device_brand text,
  os text,
  os_version text,
  local_ip text,
  public_ip text,
  mac text,
  status text not null default 'pending', -- pending | approved | rejected
  requested_at timestamptz default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decided_by_name text,
  unique (user_id, device_id)
);

create index if not exists device_approvals_status_idx
  on public.device_approvals (status, requested_at desc);
create index if not exists device_approvals_user_idx
  on public.device_approvals (user_id, requested_at desc);

alter table public.device_approvals enable row level security;

-- Хэрэглэгч өөрийн төхөөрөмжийн хүсэлт үүсгэнэ
drop policy if exists "device_approvals_insert" on public.device_approvals;
create policy "device_approvals_insert" on public.device_approvals
  for insert to authenticated with check (user_id = auth.uid());

-- Хэрэглэгч өөрийн мөрийг, системийн админ бүгдийг харна
drop policy if exists "device_approvals_read" on public.device_approvals;
create policy "device_approvals_read" on public.device_approvals
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin')
  );

-- Зөвшөөрөл/татгалзал — зөвхөн системийн админ
drop policy if exists "device_approvals_update" on public.device_approvals;
create policy "device_approvals_update" on public.device_approvals
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin')
  );

drop policy if exists "device_approvals_delete" on public.device_approvals;
create policy "device_approvals_delete" on public.device_approvals
  for delete to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin')
  );

-- status='approved'/'rejected' болгохыг зөвхөн системийн админд зөвшөөрнө
create or replace function public.protect_device_status()
returns trigger as $$
declare
  actor_role text;
begin
  select role into actor_role from public.profiles where id = auth.uid();
  if new.status is distinct from old.status
     and coalesce(actor_role, '') <> 'superadmin' then
    raise exception 'device_status_denied';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_device_status on public.device_approvals;
create trigger protect_device_status
  before update on public.device_approvals
  for each row execute function public.protect_device_status();

grant select, insert, update, delete on public.device_approvals to authenticated;

notify pgrst, 'reload schema';
