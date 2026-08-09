-- Захиалга хаах, share мэдээлэл

alter table public.service_calls
  add column if not exists close_meta jsonb,
  add column if not exists team_name text default 'Хамт яваа баг';

notify pgrst, 'reload schema';
