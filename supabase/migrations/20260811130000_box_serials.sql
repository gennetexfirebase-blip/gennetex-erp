-- ============================================================================
-- Хайрцаг доторх СЕРИАЛУУД
-- ============================================================================
--
-- БУРУУ БАЙСАН ЗАГВАР:
--   Хайрцгийн QR дотор 10 MAC байвал `inventory`-д 10 ТУСДАА мөр үүсгэж
--   байсан. Үр дүнд нь "Бараа материал" жагсаалт ижил нэртэй 10 картаар
--   дүүрч, ашиглах боломжгүй болов (дэлгэц дээр 31 нэр төрөл гарсан).
--
-- ЗӨВ ЗАГВАР:
--   • `inventory`-д НЭГ мөр — "ONT HG8245", тоо = 10
--   • `box_serials`-д 10 мөр — MAC тус бүрээр, аль хайрцагт байгааг заасан
--
--   Ингэснээр:
--     жагсаалт цэвэрхэн (1 карт, 10 ширхэг)
--     хайрцгийн QR уншихад доторх 10 MAC харагдана
--     ширхэгээр олгоход ЯГ ТЭР MAC-ийг тэмдэглэж хасна
-- ============================================================================

create table if not exists public.box_serials (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on delete cascade,
  item_id uuid not null references public.inventory(id) on delete cascade,
  serial text not null,
  status text not null default 'in_box' check (status in ('in_box', 'issued')),
  issued_to uuid references public.profiles(id) on delete set null,
  issued_to_name text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  -- Нэг MAC хоёр хайрцагт зэрэг байж болохгүй
  constraint box_serials_unique unique (serial)
);

create index if not exists box_serials_box_idx  on public.box_serials (box_id, status);
create index if not exists box_serials_item_idx on public.box_serials (item_id, status);

alter table public.box_serials enable row level security;

drop policy if exists box_serials_read on public.box_serials;
create policy box_serials_read on public.box_serials
  for select to authenticated using (true);
-- Бичих нь зөвхөн доорх RPC-ээр.

-- ---------------------------------------------------------------------------
-- Хайрцгийн QR-аас бөөнөөр бүртгэх
-- ---------------------------------------------------------------------------
-- НЭГ барааны бүртгэл + N серийн дугаар.
create or replace function public.box_register_serials(
  p_box_code text,
  p_name text,
  p_serials text[],
  p_category text default 'material',
  p_unit text default 'ширхэг',
  p_price numeric default 0
)
returns table (item_id uuid, item_name text, added int, skipped int, total_in_box numeric)
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

  -- Ижил нэр + ангилалтай бараа байвал түүн рүү нэмнэ, эс бөгөөс шинээр.
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
      -- Энэ MAC аль хэдийн хаа нэгтээ бүртгэлтэй — давхардуулахгүй
      v_skipped := v_skipped + 1;
    end;
  end loop;

  if v_added > 0 then
    update public.inventory i
       set quantity = coalesce(i.quantity, 0) + v_added
     where i.id = v_item.id;

    insert into public.box_items (box_id, item_id, quantity)
    values (v_box.id, v_item.id, v_added)
    on conflict (box_id, item_id) do update
      set quantity = public.box_items.quantity + excluded.quantity,
          updated_at = now();
  end if;

  select bi.quantity into v_total from public.box_items bi
   where bi.box_id = v_box.id and bi.item_id = v_item.id;

  return query select v_item.id, v_item.name, v_added, v_skipped, coalesce(v_total, 0);
end;
$$;

revoke execute on function public.box_register_serials(text, text, text[], text, text, numeric) from public, anon;
grant  execute on function public.box_register_serials(text, text, text[], text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Хайрцгийн агуулга — серийн дугаартайгаа
-- ---------------------------------------------------------------------------
create or replace function public.box_serials_of(p_box_code text)
returns table (
  serial text,
  status text,
  item_id uuid,
  item_name text,
  unit text,
  issued_to_name text,
  issued_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_box public.boxes%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_box from public.boxes b
   where lower(trim(b.code)) = lower(trim(p_box_code)) and b.is_active;
  if v_box.id is null then raise exception 'box_not_found'; end if;

  return query
  select s.serial, s.status, i.id, i.name, i.unit, s.issued_to_name, s.issued_at
  from public.box_serials s
  join public.inventory i on i.id = s.item_id
  where s.box_id = v_box.id
  order by s.status, i.name, s.serial;
end;
$$;

revoke execute on function public.box_serials_of(text) from public, anon;
grant  execute on function public.box_serials_of(text) to authenticated;
