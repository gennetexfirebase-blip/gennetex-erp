-- Агуулахын орлого болон ажилтны заавал хамрагдах сургалтын бүртгэл.

create table if not exists public.inventory_receipts (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid references public.inventory(id) on delete set null,
  item_name        text not null,
  category         text not null default 'material'
                     check (category in ('material', 'tool', 'supply')),
  unit             text not null default 'ширхэг',
  quantity         numeric not null check (quantity > 0),
  unit_price       numeric not null default 0 check (unit_price >= 0),
  total_amount     numeric generated always as (quantity * unit_price) stored,
  supplier         text,
  note             text,
  received_at      timestamptz not null default now(),
  received_by      uuid references public.profiles(id) on delete set null,
  received_by_name text,
  created_at       timestamptz not null default now()
);

create index if not exists inventory_receipts_item_idx
  on public.inventory_receipts (item_id, received_at desc);
create index if not exists inventory_receipts_date_idx
  on public.inventory_receipts (received_at desc);

alter table public.inventory_receipts enable row level security;
grant select, insert, update, delete on public.inventory_receipts to authenticated;

drop policy if exists inventory_receipts_read on public.inventory_receipts;
create policy inventory_receipts_read on public.inventory_receipts
  for select to authenticated
  using (public.can_manage_inventory());

drop policy if exists inventory_receipts_write on public.inventory_receipts;
create policy inventory_receipts_write on public.inventory_receipts
  for all to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

-- Орлого авах үед үлдэгдэл + дундаж өртөг + түүхийг нэг transaction-д хадгална.
create or replace function public.receive_inventory_stock(
  p_item_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_supplier text default null,
  p_note text default null,
  p_received_at timestamptz default now()
)
returns public.inventory_receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.inventory%rowtype;
  result public.inventory_receipts%rowtype;
  actor_name text;
  old_qty numeric;
  new_qty numeric;
  average_price numeric;
begin
  if not public.can_manage_inventory() then
    raise exception 'permission_denied';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'quantity_required';
  end if;
  if coalesce(p_unit_price, 0) < 0 then
    raise exception 'invalid_unit_price';
  end if;

  select * into item
  from public.inventory
  where id = p_item_id
  for update;

  if item.id is null then
    raise exception 'inventory_item_not_found';
  end if;

  old_qty := greatest(coalesce(item.quantity, 0), 0);
  new_qty := old_qty + p_quantity;
  average_price := case
    when new_qty = 0 then coalesce(p_unit_price, 0)
    else round(
      ((old_qty * greatest(coalesce(item.price, 0), 0))
        + (p_quantity * greatest(coalesce(p_unit_price, 0), 0))) / new_qty,
      2
    )
  end;

  update public.inventory
     set quantity = new_qty,
         price = average_price,
         supplier = coalesce(nullif(trim(coalesce(p_supplier, '')), ''), supplier)
   where id = item.id;

  select coalesce(p.name, p.email, 'Админ') into actor_name
  from public.profiles p
  where p.id = auth.uid();

  insert into public.inventory_receipts (
    item_id, item_name, category, unit, quantity, unit_price,
    supplier, note, received_at, received_by, received_by_name
  ) values (
    item.id, item.name, coalesce(item.category, 'material'), coalesce(item.unit, 'ширхэг'),
    p_quantity, greatest(coalesce(p_unit_price, 0), 0),
    nullif(trim(coalesce(p_supplier, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    coalesce(p_received_at, now()), auth.uid(), actor_name
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.receive_inventory_stock(uuid, numeric, numeric, text, text, timestamptz)
  from public, anon;
grant execute on function public.receive_inventory_stock(uuid, numeric, numeric, text, text, timestamptz)
  to authenticated;

create table if not exists public.employee_training_assignments (
  id             uuid primary key default gen_random_uuid(),
  employee_email text not null,
  employee_id    uuid references public.profiles(id) on delete set null,
  training_name  text not null,
  status         text not null default 'required'
                   check (status in ('required', 'completed')),
  due_date       date,
  completed_at   timestamptz,
  note           text,
  assigned_by    uuid references public.profiles(id) on delete set null,
  assigned_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (trim(employee_email) <> ''),
  check (trim(training_name) <> '')
);

create index if not exists employee_training_email_idx
  on public.employee_training_assignments (lower(employee_email), status, due_date);

-- Нэвтэрсэн удирдагч тухайн ажилтны сургалтыг удирдах эрхтэй эсэх.
create or replace function public.can_manage_employee_training(p_employee_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_dept uuid;
  target_role text;
  target_dept uuid;
begin
  select p.role, p.department_id into actor_role, actor_dept
  from public.profiles p where p.id = auth.uid();

  if actor_role = 'superadmin' then return true; end if;
  if public.role_rank(actor_role) < 1 then
    return false;
  end if;

  select a.role, coalesce(p.department_id, a.department_id)
    into target_role, target_dept
  from public.authorized_users a
  left join public.profiles p on p.id = a.linked_user_id
  where lower(a.email) = lower(trim(p_employee_email))
  limit 1;

  if target_role is null then return false; end if;
  if public.role_rank(target_role) >= public.role_rank(actor_role) then return false; end if;
  return actor_dept is null or target_dept = actor_dept;
end;
$$;

revoke all on function public.can_manage_employee_training(text) from public, anon;
grant execute on function public.can_manage_employee_training(text) to authenticated;

alter table public.employee_training_assignments enable row level security;
grant select, insert, update, delete on public.employee_training_assignments to authenticated;

drop policy if exists employee_training_read on public.employee_training_assignments;
create policy employee_training_read on public.employee_training_assignments
  for select to authenticated
  using (
    lower(employee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.can_manage_employee_training(employee_email)
  );

drop policy if exists employee_training_insert on public.employee_training_assignments;
create policy employee_training_insert on public.employee_training_assignments
  for insert to authenticated
  with check (
    public.can_manage_employee_training(employee_email)
    and assigned_by = auth.uid()
  );

drop policy if exists employee_training_update on public.employee_training_assignments;
create policy employee_training_update on public.employee_training_assignments
  for update to authenticated
  using (public.can_manage_employee_training(employee_email))
  with check (public.can_manage_employee_training(employee_email));

drop policy if exists employee_training_delete on public.employee_training_assignments;
create policy employee_training_delete on public.employee_training_assignments
  for delete to authenticated
  using (public.can_manage_employee_training(employee_email));

notify pgrst, 'reload schema';
