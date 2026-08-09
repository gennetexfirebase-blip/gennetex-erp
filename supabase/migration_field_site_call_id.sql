-- Ажлын байрын сессийг дуудлагатай холбох (GPS автомат цаг)
alter table public.field_site_sessions
  add column if not exists call_id uuid references public.service_calls(id) on delete set null;

create index if not exists field_site_sessions_call_idx
  on public.field_site_sessions (call_id, created_at desc);
