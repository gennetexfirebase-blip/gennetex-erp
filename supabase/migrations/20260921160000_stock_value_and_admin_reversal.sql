-- Бараа олголтын мөнгөн дүнг тухайн үеийн үнээр хадгалах,
-- буруу олголтыг админ агуулах руу атомикоор буцаах.

alter table public.stock_movements
  add column if not exists unit_price numeric not null default 0,
  add column if not exists total_amount numeric not null default 0,
  add column if not exists reversed_movement_id uuid references public.stock_movements(id) on delete set null;

create unique index if not exists stock_movements_one_reversal_idx
  on public.stock_movements (reversed_movement_id)
  where reversed_movement_id is not null;

create or replace function public.admin_reverse_stock_movement(p_movement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.stock_movements%rowtype;
  result public.stock_movements%rowtype;
  actor_name text;
begin
  if not public.can_manage_inventory() then
    raise exception 'Зөвхөн админ буруу олголтыг буцаана.';
  end if;

  select * into src
  from public.stock_movements
  where id = p_movement_id
  for update;

  if src.id is null then
    raise exception 'Олголтын бүртгэл олдсонгүй.';
  end if;
  if coalesce(src.movement_type, 'withdraw') <> 'withdraw' then
    raise exception 'Зөвхөн олголтын бүртгэлийг буцаана.';
  end if;
  if exists (
    select 1 from public.stock_movements where reversed_movement_id = src.id
  ) then
    raise exception 'Энэ олголт аль хэдийн буцаагдсан байна.';
  end if;

  update public.inventory
  set quantity = coalesce(quantity, 0) + src.quantity
  where id = src.item_id;

  if not found then
    raise exception 'Буцаах барааны агуулахын бүртгэл олдсонгүй.';
  end if;

  select coalesce(name, email, 'Админ') into actor_name
  from public.profiles
  where id = auth.uid();

  insert into public.stock_movements (
    item_id, item_name, unit, user_id, user_email, user_name,
    quantity, movement_type, issued_by, issued_by_name,
    unit_price, total_amount, reversed_movement_id
  ) values (
    src.item_id, src.item_name, src.unit, src.user_id, src.user_email, src.user_name,
    src.quantity, 'return', auth.uid(), actor_name,
    coalesce(src.unit_price, 0), coalesce(src.total_amount, 0), src.id
  )
  returning * into result;

  return to_jsonb(result);
end;
$$;

revoke all on function public.admin_reverse_stock_movement(uuid) from public, anon;
grant execute on function public.admin_reverse_stock_movement(uuid) to authenticated;

notify pgrst, 'reload schema';
