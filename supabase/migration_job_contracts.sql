-- Хөдөлмөрийн гэрээ — админ ажилтан үүсгэнэ, зөвхөн системийн админ (superadmin) засна,
-- ажилтан танилцаад гарын үсгээ мобайл дээр зурж PDF үүсгэнэ.

create table if not exists public.job_contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references auth.users(id) on delete set null,
  employee_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  position text,
  salary numeric,
  start_date date,
  end_date date,
  terms text,
  status text not null default 'sent', -- sent | signed
  employee_signature_svg text,
  signed_at timestamptz,
  pdf_url text,
  created_at timestamptz default now()
);

create index if not exists job_contracts_employee_idx
  on public.job_contracts (employee_id, created_at desc);
create index if not exists job_contracts_status_idx
  on public.job_contracts (status, created_at desc);

alter table public.job_contracts enable row level security;

-- Үүсгэх — зөвхөн админ / системийн админ
drop policy if exists "job_contracts_insert" on public.job_contracts;
create policy "job_contracts_insert" on public.job_contracts
  for insert to authenticated with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
  );

-- Харах — админ/системийн админ бүгдийг, ажилтан зөвхөн өөрийнхөө гэрээг
drop policy if exists "job_contracts_read" on public.job_contracts;
create policy "job_contracts_read" on public.job_contracts
  for select to authenticated using (
    employee_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
  );

-- Засах — системийн админ бүгдийг; ажилтан зөвхөн өөрийн гэрээнд гарын үсэг нэмнэ
-- (гэрээний нөхцөл талбарыг protect_contract_fields trigger хамгаална)
drop policy if exists "job_contracts_update" on public.job_contracts;
create policy "job_contracts_update" on public.job_contracts
  for update to authenticated using (
    employee_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin')
  ) with check (
    employee_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin')
  );

drop policy if exists "job_contracts_delete" on public.job_contracts;
create policy "job_contracts_delete" on public.job_contracts
  for delete to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin')
  );

-- Гэрээ үүссэний дараа нөхцлийг зөвхөн системийн админ өөрчилнө.
-- Ажилтан зөвхөн гарын үсэг / төлөв / PDF-ээ шинэчилж болно.
create or replace function public.protect_contract_fields()
returns trigger as $$
declare
  actor_role text;
begin
  select role into actor_role from public.profiles where id = auth.uid();
  if coalesce(actor_role, '') = 'superadmin' then
    return new;
  end if;
  if new.position is distinct from old.position
     or new.salary is distinct from old.salary
     or new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date
     or new.terms is distinct from old.terms
     or new.employee_id is distinct from old.employee_id
     or new.created_by is distinct from old.created_by then
    raise exception 'contract_terms_locked';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_contract_fields on public.job_contracts;
create trigger protect_contract_fields
  before update on public.job_contracts
  for each row execute function public.protect_contract_fields();

grant select, insert, update, delete on public.job_contracts to authenticated;

notify pgrst, 'reload schema';
