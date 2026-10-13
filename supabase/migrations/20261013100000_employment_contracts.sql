-- ============================================================================
-- ХӨДӨЛМӨРИЙН (АЖИЛ ГҮЙЦЭТГЭХ) ГЭРЭЭ — geree.gennetex.com
-- ============================================================================
--
-- Урсгал (актын урсгалтай ижил зарчим):
--   1. Админ ажилтан сонгож гэрээ бөглөнө (draft) → «Илгээх» (sent).
--      Ажилтны имэйл рүү «Танд хөдөлмөрийн гэрээ байгуулах хүсэлт ирлээ».
--   2. Ажилтан geree.gennetex.com/<slug> дээр Google-ээр нэвтэрч PDF-ийг
--      уншаад гарын үсгээ зурж илгээнэ (signed). Захиралд имэйл очно.
--   3. Захирал «Баталгаажуулах» (approved) эсвэл «Буцаах» (returned).
--
-- Хамгаалалт: ажилтан ЗӨВХӨН өөрийн имэйлтэй гэрээг харж, гарын үсэг
-- зурна; баталгаажуулалтыг зөвхөн Захирал (is_act_director) хийнэ. Төлөв
-- солих бүх үйлдэл SECURITY DEFINER функцээр явна — клиент шууд
-- `status`-ыг өөрчлөх боломжгүй.
-- ============================================================================

create sequence if not exists public.employment_contract_seq start 171;

create table if not exists public.employment_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number integer not null default nextval('public.employment_contract_seq'),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  employee_id uuid references public.profiles(id) on delete set null,
  employee_email text not null,
  family_name text,
  given_name text not null,
  fields jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sent', 'signed', 'approved', 'returned')),
  employee_signature_path text,
  employee_signed_at timestamptz,
  director_note text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employment_contracts_email_idx on public.employment_contracts (lower(employee_email));
create index if not exists employment_contracts_status_idx on public.employment_contracts (status, created_at desc);

-- Нэвтэрсэн хэрэглэгчийн имэйл (JWT-ээс).
create or replace function public.my_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

grant execute on function public.my_email() to authenticated;

create or replace function public.is_contract_party(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employment_contracts c
     where c.id = p_id
       and (c.employee_id = auth.uid() or lower(c.employee_email) = public.my_email())
  );
$$;

grant execute on function public.is_contract_party(uuid) to authenticated;

alter table public.employment_contracts enable row level security;
revoke all on public.employment_contracts from public, anon;
grant select, insert, update, delete on public.employment_contracts to authenticated;

drop policy if exists employment_contracts_read on public.employment_contracts;
create policy employment_contracts_read on public.employment_contracts
  for select to authenticated
  using (
    public.is_admin_user()
    or public.is_act_director()
    or employee_id = auth.uid()
    or lower(employee_email) = public.my_email()
  );

-- Админ зөвхөн ноорог/буцаагдсан гэрээг бөглөж засна.
drop policy if exists employment_contracts_insert on public.employment_contracts;
create policy employment_contracts_insert on public.employment_contracts
  for insert to authenticated
  with check (public.is_admin_user() and status = 'draft');

drop policy if exists employment_contracts_update on public.employment_contracts;
create policy employment_contracts_update on public.employment_contracts
  for update to authenticated
  using (public.is_admin_user() and status in ('draft', 'returned'))
  with check (public.is_admin_user() and status in ('draft', 'returned'));

drop policy if exists employment_contracts_delete on public.employment_contracts;
create policy employment_contracts_delete on public.employment_contracts
  for delete to authenticated
  using (public.is_admin_user() and status <> 'approved');

create or replace function public.touch_employment_contract()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists employment_contracts_touch on public.employment_contracts;
create trigger employment_contracts_touch
  before update on public.employment_contracts
  for each row execute function public.touch_employment_contract();

-- ---------------------------------------------------------------------------
-- Төлөв солих үйлдлүүд
-- ---------------------------------------------------------------------------

-- Админ: ажилтанд илгээх (ноорог эсвэл буцаагдсанаас).
create or replace function public.send_employment_contract(p_id uuid)
returns public.employment_contracts
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.employment_contracts%rowtype;
begin
  if not public.is_admin_user() then raise exception 'permission_denied'; end if;
  update public.employment_contracts
     set status = 'sent', sent_at = now(),
         employee_signature_path = null, employee_signed_at = null
   where id = p_id and status in ('draft', 'returned')
  returning * into result;
  if result.id is null then raise exception 'invalid_status'; end if;
  return result;
end;
$$;

-- Ажилтан: уншиж танилцаад гарын үсэг зурсан.
create or replace function public.sign_employment_contract(p_id uuid, p_signature_path text)
returns public.employment_contracts
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.employment_contracts%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_contract_party(p_id) then raise exception 'permission_denied'; end if;
  if p_signature_path is null or p_signature_path not like p_id::text || '/%' then
    raise exception 'invalid_signature';
  end if;
  update public.employment_contracts
     set status = 'signed', employee_signature_path = p_signature_path, employee_signed_at = now(),
         employee_id = coalesce(employee_id, auth.uid())
   where id = p_id and status = 'sent'
  returning * into result;
  if result.id is null then raise exception 'invalid_status'; end if;
  return result;
end;
$$;

-- Захирал: баталгаажуулах эсвэл буцаах.
create or replace function public.decide_employment_contract(p_id uuid, p_approve boolean, p_note text default null)
returns public.employment_contracts
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.employment_contracts%rowtype;
begin
  if not public.is_act_director() then raise exception 'director_only'; end if;
  update public.employment_contracts
     set status = case when p_approve then 'approved' else 'returned' end,
         approved_at = case when p_approve then now() else null end,
         approved_by = case when p_approve then auth.uid() else null end,
         director_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_id and status = 'signed'
  returning * into result;
  if result.id is null then raise exception 'invalid_status'; end if;
  return result;
end;
$$;

revoke all on function public.send_employment_contract(uuid) from public, anon;
revoke all on function public.sign_employment_contract(uuid, text) from public, anon;
revoke all on function public.decide_employment_contract(uuid, boolean, text) from public, anon;
grant execute on function public.send_employment_contract(uuid) to authenticated;
grant execute on function public.sign_employment_contract(uuid, text) to authenticated;
grant execute on function public.decide_employment_contract(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Ажилтны гарын үсэг — хувийн bucket, зам: <contract_id>/<file>.png
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-signatures', 'contract-signatures', false, 2097152, array['image/png']::text[])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists contract_signatures_insert on storage.objects;
create policy contract_signatures_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contract-signatures'
    and exists (
      select 1 from public.employment_contracts c
       where c.id::text = (storage.foldername(name))[1]
         and c.status = 'sent'
         and (c.employee_id = auth.uid() or lower(c.employee_email) = public.my_email())
    )
  );

drop policy if exists contract_signatures_read on storage.objects;
create policy contract_signatures_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contract-signatures'
    and exists (
      select 1 from public.employment_contracts c
       where c.id::text = (storage.foldername(name))[1]
         and (
           public.is_admin_user() or public.is_act_director()
           or c.employee_id = auth.uid() or lower(c.employee_email) = public.my_email()
         )
    )
  );

notify pgrst, 'reload schema';
