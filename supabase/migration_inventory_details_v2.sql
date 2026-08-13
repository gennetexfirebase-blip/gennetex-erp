-- ============================================================================
-- Бараа материал / багажийн бүртгэлийг нарийвчлах
-- ============================================================================
--
-- Одоогийн `inventory` хүснэгт нь: name, unit, quantity, price, barcode,
-- category, image_url. Бодит агуулахын бүртгэлд дараах зүйлс дутаж байна:
--
--   • min_stock  — бараа тус бүрийн бага үлдэгдлийн босго.
--     Одоо код дотор LOW_STOCK = 5 гэж БҮХ бараанд адилхан хатуу бичсэн байна.
--     1000 ширхэг шураптай, 1 ширхэг экскаватортай агуулахад энэ утгагүй.
--
--   • sku        — дотоод код. Ижил нэртэй бараа ялгахад, тайланд хэрэгтэй.
--   • location   — агуулах / тавиурын байршил. Олохгүй бол дахин худалдаж авдаг.
--   • supplier   — нийлүүлэгч. Дахин захиалахад хэрэгтэй.
--   • serial_no  — багажийн сериал дугаар (category = 'tool').
--   • note       — нэмэлт тайлбар.
--
-- Бүгд заавал биш (nullable) тул одоо байгаа мөрүүд эвдэрхгүй.
-- ============================================================================

alter table public.inventory add column if not exists min_stock  numeric default 0;
alter table public.inventory add column if not exists sku        text;
alter table public.inventory add column if not exists location   text;
alter table public.inventory add column if not exists supplier   text;
alter table public.inventory add column if not exists serial_no  text;
alter table public.inventory add column if not exists note       text;

-- Тоо ширхэг сөрөг байж болохгүй. Хэрэв одоо сөрөг мөр байвал энэ constraint
-- алдаа өгнө — тиймээс эхлээд шалгаад, дараа нь нэмнэ.
--   select id, name, quantity from public.inventory where quantity < 0;
alter table public.inventory drop constraint if exists inventory_quantity_nonneg;
alter table public.inventory
  add constraint inventory_quantity_nonneg check (quantity >= 0) not valid;

alter table public.inventory drop constraint if exists inventory_min_stock_nonneg;
alter table public.inventory
  add constraint inventory_min_stock_nonneg check (min_stock >= 0) not valid;

-- Дээрх шалгалт цэвэр бол хуучин мөрүүдэд ч мөрдүүлнэ:
--   alter table public.inventory validate constraint inventory_quantity_nonneg;
--   alter table public.inventory validate constraint inventory_min_stock_nonneg;

-- Баркод давхардвал буруу бараа хасагдана. Хоосон (null) утгыг олон мөр
-- агуулж болно, гэхдээ бөглөсөн баркод давтагдахгүй.
create unique index if not exists inventory_barcode_uniq
  on public.inventory (barcode)
  where barcode is not null and barcode <> '';

-- SKU-д мөн адил
create unique index if not exists inventory_sku_uniq
  on public.inventory (sku)
  where sku is not null and sku <> '';

-- Хайлт хурдасгах
create index if not exists inventory_category_name_idx
  on public.inventory (category, name);

-- Бага үлдэгдэлтэй барааг хурдан олох
create index if not exists inventory_low_stock_idx
  on public.inventory (category, quantity)
  where min_stock > 0;
