-- Мессеж засах тэмдэглэл
alter table public.messages add column if not exists edited_at timestamptz;
