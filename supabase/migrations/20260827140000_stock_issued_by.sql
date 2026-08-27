-- ============================================================================
-- Багаж/бараа ОЛГОСОН ХҮНИЙГ бүртгэх
-- ============================================================================
--
-- АСУУДАЛ:
--   `stock_movements` дээр `user_id`/`user_name` нь ХЭНД олгосныг заадаг
--   бөгөөд ХЭН олгосныг (аль админ) хадгалдаггүй байв. Тиймээс
--   "хэн ямар хүнд юу олгосон" гэсэн тайлан гаргах боломжгүй байсан.
--
-- ЗАСВАР:
--   `issued_by` (uuid) ба `issued_by_name` (text) багана нэмнэ. Хуучин
--   мөрүүд хоосон үлдэнэ — буцаж нөхөх боломжгүй тул тайланд "—" гэж
--   харагдана.
-- ============================================================================

alter table public.stock_movements
  add column if not exists issued_by uuid references auth.users(id) on delete set null;

alter table public.stock_movements
  add column if not exists issued_by_name text;

-- Тайлан нь ихэвчлэн хугацааны мужаар шүүдэг тул индекс нэмнэ.
create index if not exists stock_movements_created_idx
  on public.stock_movements (created_at desc);

create index if not exists stock_movements_issued_by_idx
  on public.stock_movements (issued_by);

notify pgrst, 'reload schema';
