-- Дахимдах / маргааш хойшлуулах (close_meta, team_name орно)

alter table public.service_calls
  add column if not exists close_meta jsonb,
  add column if not exists team_name text default 'Хамт яваа баг',
  add column if not exists scheduled_at timestamptz,
  add column if not exists partner_engineer_id uuid references auth.users(id) on delete set null,
  add column if not exists partner_engineer_name text;

create index if not exists service_calls_scheduled_idx
  on public.service_calls (scheduled_at desc nulls last);

notify pgrst, 'reload schema';
