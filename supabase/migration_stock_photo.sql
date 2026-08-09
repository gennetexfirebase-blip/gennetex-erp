-- Бараа/багаж авах үеийн баталгаа зураг
alter table public.stock_movements
  add column if not exists photo_url text;

notify pgrst, 'reload schema';
