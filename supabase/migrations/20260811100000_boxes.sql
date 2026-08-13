-- ============================================================================
-- ХАЙРЦАГ (boxes) — QR кодоор уншиж, доторх бараа/багажийг олгох
-- ============================================================================
--
-- ЗОРИЛГО:
--   Агуулахын хайрцаг бүр дээр QR наана. Уншуулбал тэр хайрцагт ЯГ юу
--   байгаа нь гарч ирнэ. Ажилтанд олгохдоо барааны зураасан кодыг
--   уншуулахад ЯГ ТЭР хайрцгаас хасагдана.
--
-- ЯАГААД `inventory`-д багана нэмээгүй вэ:
--   Нэг бараа ОЛОН хайрцагт байж болно (жишээ нь 3 хайрцагт кабель).
--   `inventory.box_id` гэж нэмбэл нэг бараа нэг л хайрцагт байхаар
--   хязгаарлагдана. Тиймээс `box_items` холбогч хүснэгт ашиглав.
--
-- СЕРИАЛТАЙ БАГАЖ:
--   Багаж бүр `inventory`-д ӨӨРИЙН мөртэй (serial_no тус бүрдээ) тул
--   `box_items.quantity = 1` болно. Материал нь тоогоор.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Урьдчилсан нөхцөл
-- ---------------------------------------------------------------------------
-- Доорх функцууд `inventory.serial_no`-г ашиглана. Тэр багана нь
-- migration_inventory_details_v2.sql дотор нэмэгддэг ч энэ өгөгдлийн
-- сан дээр хараахан хэрэгжсэн эсэх нь тодорхойгүй. Дутуу байвал бүх
-- функц үүсэхгүй тул энд баталгаажуулна (байгаа бол юу ч болохгүй).
alter table public.inventory add column if not exists serial_no text;
alter table public.inventory add column if not exists location  text;

-- ---------------------------------------------------------------------------
-- 1. Хайрцаг
-- ---------------------------------------------------------------------------
create table if not exists public.boxes (
  id uuid primary key default gen_random_uuid(),
  -- QR дотор ЭНЭ код бичигдэнэ. Хүнд уншигдахуйц байлгав — QR гэмтвэл
  -- гараар ч хайж болно.
  code text not null unique,
  name text not null,
  location text,
  note text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boxes_code_idx on public.boxes (code) where is_active;

-- ---------------------------------------------------------------------------
-- 2. Хайрцаг доторх бараа
-- ---------------------------------------------------------------------------
create table if not exists public.box_items (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on delete cascade,
  item_id uuid not null references public.inventory(id) on delete cascade,
  quantity numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint box_items_qty_nonneg check (quantity >= 0),
  -- Нэг хайрцагт нэг бараа НЭГ л мөртэй байна — эс тэгвээс тоо
  -- хоёр мөрөнд хуваагдаж, үлдэгдэл буруу гарна.
  constraint box_items_unique unique (box_id, item_id)
);

create index if not exists box_items_box_idx  on public.box_items (box_id);
create index if not exists box_items_item_idx on public.box_items (item_id);

-- ---------------------------------------------------------------------------
-- 3. Хайрцгаас олгосон түүх
-- ---------------------------------------------------------------------------
-- `stock_movements` нь аль хайрцгаас гарсныг мэддэггүй. Хайрцгийн
-- үлдэгдэл зөрвөл хаанаас алдаа гарсныг олох боломжтой байх ёстой.
create table if not exists public.box_issues (
  id uuid primary key default gen_random_uuid(),
  box_id uuid references public.boxes(id) on delete set null,
  box_code text,
  item_id uuid references public.inventory(id) on delete set null,
  item_name text,
  serial_no text,
  barcode text,
  quantity numeric not null default 1,
  issued_to uuid references public.profiles(id) on delete set null,
  issued_to_name text,
  issued_by uuid references public.profiles(id) on delete set null,
  issued_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists box_issues_box_idx  on public.box_issues (box_id, created_at desc);
create index if not exists box_issues_user_idx on public.box_issues (issued_to, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
-- Унших нь бүх нэвтэрсэн ажилтанд нээлттэй (хайрцаг хаана юу байгааг
-- мэдэх нь ажлын хэрэгцээ). Харин ӨӨРЧЛӨХ нь зөвхөн RPC-ээр явна —
-- шууд UPDATE зөвшөөрвөл хэн ч үлдэгдлээ өөрчилж чадна.

alter table public.boxes      enable row level security;
alter table public.box_items  enable row level security;
alter table public.box_issues enable row level security;

drop policy if exists boxes_read on public.boxes;
create policy boxes_read on public.boxes
  for select to authenticated using (true);

drop policy if exists box_items_read on public.box_items;
create policy box_items_read on public.box_items
  for select to authenticated using (true);

-- Олголтын түүх: өөрийнхөө авсныг ажилтан харна, нярав+ бүгдийг харна.
drop policy if exists box_issues_read on public.box_issues;
create policy box_issues_read on public.box_issues
  for select to authenticated using (
    issued_to = auth.uid()
    or public.role_rank((select p.role from public.profiles p where p.id = auth.uid())) >= 1
  );

-- INSERT/UPDATE/DELETE policy ЗОРИУД байхгүй — доорх RPC-ууд
-- security definer тул тэдгээрээр л өөрчлөгдөнө.

-- ---------------------------------------------------------------------------
-- 5. Хайрцгийн агуулгыг QR кодоор авах
-- ---------------------------------------------------------------------------
create or replace function public.box_by_code(p_code text)
returns table (
  box_id uuid,
  code text,
  name text,
  location text,
  note text,
  item_id uuid,
  item_name text,
  unit text,
  category text,
  barcode text,
  serial_no text,
  quantity numeric
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

  -- Том/жижиг үсэг, зай зөрөхөд ч олдох ёстой — QR гараар бичигдэж болно
  select * into v_box from public.boxes b
   where lower(trim(b.code)) = lower(trim(p_code)) and b.is_active;

  if v_box.id is null then raise exception 'box_not_found'; end if;

  return query
  select
    v_box.id, v_box.code, v_box.name, v_box.location, v_box.note,
    i.id, i.name, i.unit, i.category, i.barcode, i.serial_no, bi.quantity
  from public.box_items bi
  join public.inventory i on i.id = bi.item_id
  where bi.box_id = v_box.id and bi.quantity > 0
  order by i.category, i.name;
end;
$$;

revoke execute on function public.box_by_code(text) from public, anon;
grant  execute on function public.box_by_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Барааг зураасан кодоор нь хайрцгаас олгох
-- ---------------------------------------------------------------------------
-- Энэ бол гол үйлдэл: админ ажилтныг сонгоод барааны зураасан кодыг
-- уншуулна. ЯГ ТЭР хайрцгаас, ЯГ ТЭР бараа хасагдана.
--
-- Хийж буй шалгалтууд:
--   • дуудагч нярав ба түүнээс дээш эрхтэй эсэх
--   • уншсан код тухайн хайрцагт байгаа эсэх (өөр хайрцгийнхыг хасахгүй)
--   • үлдэгдэл хүрэлцэх эсэх (сөрөг рүү орохгүй)
create or replace function public.box_issue_by_barcode(
  p_box_code text,
  p_barcode text,
  p_user_id uuid,
  p_quantity numeric default 1
)
returns table (
  item_id uuid,
  item_name text,
  serial_no text,
  issued numeric,
  remaining numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_rank int;
  v_box public.boxes%rowtype;
  v_item public.inventory%rowtype;
  v_bi public.box_items%rowtype;
  v_user public.profiles%rowtype;
  v_qty numeric := coalesce(p_quantity, 1);
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if v_qty <= 0 then raise exception 'invalid_quantity'; end if;

  select p.name into v_actor_name from public.profiles p where p.id = v_actor;
  -- role_rank: employee=0, nyrav=1 — олголт нь няравын үүрэг
  v_rank := public.role_rank((select p.role from public.profiles p where p.id = v_actor));
  if v_rank < 1 then raise exception 'forbidden'; end if;

  select * into v_box from public.boxes b
   where lower(trim(b.code)) = lower(trim(p_box_code)) and b.is_active;
  if v_box.id is null then raise exception 'box_not_found'; end if;

  select * into v_user from public.profiles p where p.id = p_user_id;
  if v_user.id is null then raise exception 'user_not_found'; end if;

  -- Зураасан код эсвэл сериалаар хайна — багаж дээр ихэвчлэн сериал
  -- наалттай байдаг тул хоёуланг нь дэмжинэ.
  select i.* into v_item
    from public.inventory i
    join public.box_items bi2 on bi2.item_id = i.id and bi2.box_id = v_box.id
   where lower(trim(coalesce(i.barcode, ''))) = lower(trim(p_barcode))
      or lower(trim(coalesce(i.serial_no, ''))) = lower(trim(p_barcode))
   limit 1;

  if v_item.id is null then
    -- Бараа систем дээр байж болох ч ЭНЭ хайрцагт байхгүй байж болно.
    -- Хоёрыг ялгаж хэлэх нь няравт чухал.
    if exists (
      select 1 from public.inventory i
       where lower(trim(coalesce(i.barcode, ''))) = lower(trim(p_barcode))
          or lower(trim(coalesce(i.serial_no, ''))) = lower(trim(p_barcode))
    ) then
      raise exception 'not_in_this_box';
    end if;
    raise exception 'item_not_found';
  end if;

  select * into v_bi from public.box_items bi
   where bi.box_id = v_box.id and bi.item_id = v_item.id
   for update;

  if v_bi.quantity < v_qty then raise exception 'insufficient_in_box'; end if;

  -- Хайрцгаас хасна
  update public.box_items bi
     set quantity = bi.quantity - v_qty, updated_at = now()
   where bi.id = v_bi.id;

  -- Нийт агуулахын үлдэгдлээс ч хасна — эс тэгвээс хайрцгийн тоо
  -- буурсан атлаа агуулахын нийт тоо хэвээр үлдэж, зөрүү үүснэ.
  update public.inventory i
     set quantity = greatest(coalesce(i.quantity, 0) - v_qty, 0)
   where i.id = v_item.id;

  -- Хоёр төрлийн түүх: ерөнхий хөдөлгөөн + хайрцгийн олголт
  insert into public.stock_movements (item_id, item_name, unit, user_id, user_name, quantity, movement_type)
  values (v_item.id, v_item.name, v_item.unit, p_user_id, v_user.name, v_qty, 'withdraw');

  insert into public.box_issues (
    box_id, box_code, item_id, item_name, serial_no, barcode,
    quantity, issued_to, issued_to_name, issued_by, issued_by_name
  ) values (
    v_box.id, v_box.code, v_item.id, v_item.name, v_item.serial_no, v_item.barcode,
    v_qty, p_user_id, v_user.name, v_actor, v_actor_name
  );

  return query
  select v_item.id, v_item.name, v_item.serial_no, v_qty, (v_bi.quantity - v_qty);
end;
$$;

revoke execute on function public.box_issue_by_barcode(text, text, uuid, numeric) from public, anon;
grant  execute on function public.box_issue_by_barcode(text, text, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Хайрцаг үүсгэх / бараа хийх
-- ---------------------------------------------------------------------------
create or replace function public.box_upsert(
  p_code text,
  p_name text,
  p_location text default null,
  p_note text default null
)
returns public.boxes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.boxes%rowtype;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if public.role_rank((select p.role from public.profiles p where p.id = v_actor)) < 1 then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_code), '') = '' then raise exception 'code_required'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;

  insert into public.boxes (code, name, location, note, created_by)
  values (trim(p_code), trim(p_name), p_location, p_note, v_actor)
  on conflict (code) do update
    set name = excluded.name,
        location = excluded.location,
        note = excluded.note,
        is_active = true,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.box_upsert(text, text, text, text) from public, anon;
grant  execute on function public.box_upsert(text, text, text, text) to authenticated;

/** Хайрцагт бараа нэмэх (эсвэл тоог тохируулах). */
create or replace function public.box_put_item(
  p_box_code text,
  p_barcode text,
  p_quantity numeric default 1
)
returns table (item_name text, quantity numeric)
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

  insert into public.box_items (box_id, item_id, quantity)
  values (v_box.id, v_item.id, p_quantity)
  on conflict (box_id, item_id) do update
    set quantity = public.box_items.quantity + excluded.quantity,
        updated_at = now()
  returning public.box_items.quantity into v_qty;

  return query select v_item.name, v_qty;
end;
$$;

revoke execute on function public.box_put_item(text, text, numeric) from public, anon;
grant  execute on function public.box_put_item(text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Хайрцгийн жагсаалт (тоо ширхэгтэйгээ)
-- ---------------------------------------------------------------------------
create or replace function public.box_list()
returns table (
  id uuid,
  code text,
  name text,
  location text,
  item_kinds bigint,
  total_qty numeric,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id, b.code, b.name, b.location,
    count(bi.id) filter (where bi.quantity > 0),
    coalesce(sum(bi.quantity) filter (where bi.quantity > 0), 0),
    b.updated_at
  from public.boxes b
  left join public.box_items bi on bi.box_id = b.id
  where b.is_active and auth.uid() is not null
  group by b.id
  order by b.name;
$$;

revoke execute on function public.box_list() from public, anon;
grant  execute on function public.box_list() to authenticated;
