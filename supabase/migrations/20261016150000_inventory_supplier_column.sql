-- «Орлого авах» (receive_inventory_stock) — column "supplier" does not exist.
--
-- Функц inventory.supplier-ийг шинэчилдэг ч production сан дээр тэр багана
-- үүсээгүй байв. Вэб ба мобайл апп хоёулаа энэ функцийг дууддаг тул багануудыг
-- нэмэхэд апп шинэчлэхгүйгээр засагдана. Функцийн хэрэглэдэг бусад багануудыг
-- ч «байхгүй бол» нэмнэ.

alter table public.inventory add column if not exists supplier text;
alter table public.inventory add column if not exists price numeric not null default 0;
alter table public.inventory add column if not exists unit text default 'ширхэг';
alter table public.inventory add column if not exists category text default 'material';

alter table public.inventory_receipts add column if not exists supplier text;
alter table public.inventory_receipts add column if not exists note text;
alter table public.inventory_receipts add column if not exists received_by_name text;

notify pgrst, 'reload schema';
