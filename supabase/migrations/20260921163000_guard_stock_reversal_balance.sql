-- Хэсэгчлэн хэрэглэсэн олголтыг бүтнээр нь буцааж агуулахын тоог
-- хиймлээр өсгөхөөс хамгаална.

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
  employee_balance numeric;
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

  select coalesce(sum(
    case
      when coalesce(m.movement_type, 'withdraw') = 'withdraw' then m.quantity
      when m.movement_type in ('consume', 'return') then -m.quantity
      else 0
    end
  ), 0)
  into employee_balance
  from public.stock_movements m
  where m.item_id = src.item_id
    and (
      (src.user_id is not null and m.user_id = src.user_id)
      or (
        src.user_id is null and src.user_email is not null
        and lower(coalesce(m.user_email, '')) = lower(src.user_email)
      )
      or (
        src.user_id is null and src.user_email is null
        and m.user_id is null and m.user_email is null
        and coalesce(m.user_name, '') = coalesce(src.user_name, '')
      )
    );

  if employee_balance < src.quantity then
    raise exception 'Энэ олголтын бараанаас хэрэглэсэн тул бүтнээр буцаах боломжгүй. Үлдэгдэл: % %.', employee_balance, coalesce(src.unit, 'ш');
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

notify pgrst, 'reload schema';
