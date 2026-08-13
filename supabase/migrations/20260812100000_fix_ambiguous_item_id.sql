-- ============================================================================
-- Засвар: column reference "item_id" is ambiguous
-- ============================================================================
--
-- АЛДАА:
--   `box_register_serials` нь `returns table (item_id uuid, ...)` гэж
--   зарлагдсан. PostgreSQL-д `returns table (...)` доторх нэрс нь функцийн
--   ГАРАЛТЫН ПАРАМЕТР болдог — өөрөөр хэлбэл функцийн бүх бие дотор
--   `item_id` гэсэн хувьсагч оршин байна.
--
--   Улмаар доорх мөрөнд:
--       on conflict (box_id, item_id) do update ...
--   PostgreSQL `item_id` гэдэг нь ГАРАЛТЫН ПАРАМЕТР уу, эсвэл
--   `box_items` хүснэгтийн БАГАНА уу гэдгийг ялгаж чадахгүй болж
--   "column reference item_id is ambiguous" гэж унана.
--
--   Энэ бол `role`, `position` дээр өмнө тохиолдсонтой ижил төрлийн алдаа.
--
-- ЗАСВАР:
--   Гаралтын параметрүүдийг `r_` угтвартай болгож, хүснэгтийн баганатай
--   хэзээ ч мөргөлдөхгүй болгов.
--
-- ⚠️ `create or replace` нь буцаах төрлийг өөрчилж чадахгүй тул эхлээд
--    drop хийнэ. Функцийг зөвхөн апп дуудна.
-- ============================================================================

drop function if exists public.box_register_serials(text, text, text[], text, text, numeric);

create or replace function public.box_register_serials(
  p_box_code text,
  p_name text,
  p_serials text[],
  p_category text default 'material',
  p_unit text default 'ширхэг',
  p_price numeric default 0
)
returns table (r_item_id uuid, r_item_name text, r_added int, r_skipped int, r_total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_box public.boxes%rowtype;
  v_item public.inventory%rowtype;
  v_serial text;
  v_added int := 0;
  v_skipped int := 0;
  v_total numeric;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if public.role_rank((select p.role from public.profiles p where p.id = v_actor)) < 1 then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  if p_serials is null or array_length(p_serials, 1) is null then
    raise exception 'no_serials';
  end if;

  select * into v_box from public.boxes b
   where lower(trim(b.code)) = lower(trim(p_box_code)) and b.is_active;
  if v_box.id is null then raise exception 'box_not_found'; end if;

  select * into v_item from public.inventory i
   where lower(trim(i.name)) = lower(trim(p_name))
     and coalesce(i.category, 'material') = coalesce(p_category, 'material')
   limit 1;

  if v_item.id is null then
    insert into public.inventory (name, unit, quantity, price, category)
    values (trim(p_name), coalesce(p_unit, 'ширхэг'), 0, coalesce(p_price, 0), coalesce(p_category, 'material'))
    returning * into v_item;
  end if;

  foreach v_serial in array p_serials loop
    v_serial := trim(v_serial);
    continue when v_serial = '';
    begin
      insert into public.box_serials (box_id, item_id, serial)
      values (v_box.id, v_item.id, v_serial);
      v_added := v_added + 1;
    exception when unique_violation then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  if v_added > 0 then
    update public.inventory i
       set quantity = coalesce(i.quantity, 0) + v_added
     where i.id = v_item.id;

    -- ON CONFLICT-ийг ашиглахгүй: гаралтын параметртэй мөргөлдөх эрсдэлээс
    -- бүрэн зайлсхийхийн тулд шалгаад шинэчлэх/оруулах хэлбэрээр бичив.
    if exists (
      select 1 from public.box_items bi
      where bi.box_id = v_box.id and bi.item_id = v_item.id
    ) then
      update public.box_items bi
         set quantity = bi.quantity + v_added, updated_at = now()
       where bi.box_id = v_box.id and bi.item_id = v_item.id;
    else
      insert into public.box_items (box_id, item_id, quantity)
      values (v_box.id, v_item.id, v_added);
    end if;
  end if;

  select bi.quantity into v_total from public.box_items bi
   where bi.box_id = v_box.id and bi.item_id = v_item.id;

  return query select v_item.id, v_item.name, v_added, v_skipped, coalesce(v_total, 0);
end;
$$;

revoke execute on function public.box_register_serials(text, text, text[], text, text, numeric) from public, anon;
grant  execute on function public.box_register_serials(text, text, text[], text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Мөн адил эрсдэлтэй байсан `box_put_item`-ийг ч засав
-- ---------------------------------------------------------------------------
-- Тэнд `returns table (item_name text, quantity numeric)` гэж зарласан
-- бөгөөд `on conflict ... set quantity = public.box_items.quantity + ...`
-- гэсэн мөрөнд `quantity` мөн хоёрдмол утгатай болох эрсдэлтэй.

drop function if exists public.box_put_item(text, text, numeric);

create or replace function public.box_put_item(
  p_box_code text,
  p_barcode text,
  p_quantity numeric default 1
)
returns table (r_item_name text, r_quantity numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_box public.boxes%rowtype;
  v_item public.inventory%rowtype;
  v_qty numeric;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if public.role_rank((select p.role from public.profiles p where p.id = v_actor)) < 1 then
    raise exception 'forbidden';
  end if;
  if coalesce(p_quantity, 0) <= 0 then raise exception 'invalid_quantity'; end if;

  select * into v_box from public.boxes b
   where lower(trim(b.code)) = lower(trim(p_box_code)) and b.is_active;
  if v_box.id is null then raise exception 'box_not_found'; end if;

  select i.* into v_item from public.inventory i
   where lower(trim(coalesce(i.barcode, ''))) = lower(trim(p_barcode))
      or lower(trim(coalesce(i.serial_no, ''))) = lower(trim(p_barcode))
   limit 1;
  if v_item.id is null then raise exception 'item_not_found'; end if;

  if exists (
    select 1 from public.box_items bi
    where bi.box_id = v_box.id and bi.item_id = v_item.id
  ) then
    update public.box_items bi
       set quantity = bi.quantity + p_quantity, updated_at = now()
     where bi.box_id = v_box.id and bi.item_id = v_item.id
     returning bi.quantity into v_qty;
  else
    insert into public.box_items (box_id, item_id, quantity)
    values (v_box.id, v_item.id, p_quantity)
    returning quantity into v_qty;
  end if;

  return query select v_item.name, v_qty;
end;
$$;

revoke execute on function public.box_put_item(text, text, numeric) from public, anon;
grant  execute on function public.box_put_item(text, text, numeric) to authenticated;
