-- Барааны олголт / хэрэглээ / буцаалтыг ялгах
-- withdraw = агуулахаас авсан (+), consume = хэрэглэсэн (−), return = буцаасан (−)

alter table public.stock_movements
  add column if not exists movement_type text default 'withdraw';

update public.stock_movements
set movement_type = 'withdraw'
where movement_type is null;

create index if not exists stock_mov_type_idx on public.stock_movements (movement_type, created_at desc);

notify pgrst, 'reload schema';
