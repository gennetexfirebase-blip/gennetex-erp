-- ============================================================================
-- Бараа материал / багажийг ЗӨВХӨН админ олгоно
-- ============================================================================
--
-- ЯАГААД:
--   Урьд нь ажилтан аппаас өөрөө "Бараа авах" гэж агуулахаас хасаж болдог
--   байсан. Аппаас тэр замыг устгасан ч өгөгдлийн сан талдаа `inventory`,
--   `stock_movements` дээр `using (true) with check (true)` policy үлдсэн
--   тул хүсвэл шууд API-аар хасах боломжтой хэвээр байв.
--
--   Энэ migration нь дүрмийг САНГИЙН талд бататгана:
--     • агуулахын үлдэгдлийг зөвхөн агуулах хариуцсан хүн өөрчилнө
--     • олголт (withdraw) зөвхөн админаар бүртгэгдэнэ
--     • ажилтан зөвхөн ӨӨРТ нь олгогдсон зүйлээ "хэрэглэсэн" (consume)
--       гэж бүртгэнэ, өөрийн лог л харна
--
-- ХАМААРАЛ: migration_roles_expand.sql (public.can_manage_inventory,
--           public.is_admin_user) урьд нь ажилласан байх ёстой.
--
-- АНХААР: AI тооллого (`saveInventoryCount`) нь `inventory.quantity`-г
--         засдаг. Үүний дараа тооллогын залруулга ЗӨВХӨН админд бичигдэнэ
--         (ажилтны хувьд чимээгүй алгасагдана — код нь try/catch дотор).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. inventory — харах нээлттэй, ӨӨРЧЛӨХ нь зөвхөн агуулахын эрхтэйд
-- ---------------------------------------------------------------------------
alter table public.inventory enable row level security;

-- Хуучин "бүгдэд бүх эрх" policy-г салгана
drop policy if exists "inventory_all" on public.inventory;

drop policy if exists "inventory_select" on public.inventory;
create policy "inventory_select" on public.inventory
  for select using (true);

drop policy if exists "inventory_write" on public.inventory;
create policy "inventory_write" on public.inventory
  for all
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

-- ---------------------------------------------------------------------------
-- 2. stock_movements — олголтыг админ, хэрэглээг эзэн нь бүртгэнэ
-- ---------------------------------------------------------------------------
alter table public.stock_movements enable row level security;

drop policy if exists "stock_movements_all" on public.stock_movements;

-- Ажилтан зөвхөн өөрийн хөдөлгөөнөө харна; админ бүгдийг харна.
drop policy if exists "stock_movements_select" on public.stock_movements;
create policy "stock_movements_select" on public.stock_movements
  for select
  using (user_id = auth.uid() or public.can_manage_inventory());

-- Бичих:
--   • админ — ямар ч төрлийн мөр (олгох, буцаах, залруулах)
--   • ажилтан — ЗӨВХӨН өөрийн нэр дээрх 'consume' мөр
-- Ингэснээр ажилтан "би 10 ширхэг авлаа" гэсэн withdraw мөр үүсгэж
-- үлдэгдэл өөртөө нэмэх боломжгүй болно.
drop policy if exists "stock_movements_insert" on public.stock_movements;
create policy "stock_movements_insert" on public.stock_movements
  for insert
  with check (
    public.can_manage_inventory()
    or (user_id = auth.uid() and movement_type = 'consume')
  );

-- Бүртгэл засах/устгах нь зөвхөн админ — лог нь баримт учраас.
drop policy if exists "stock_movements_update" on public.stock_movements;
create policy "stock_movements_update" on public.stock_movements
  for update
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "stock_movements_delete" on public.stock_movements;
create policy "stock_movements_delete" on public.stock_movements
  for delete
  using (public.can_manage_inventory());
