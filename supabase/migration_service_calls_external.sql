-- Гадна систем (U-Service г.м) — JSON webhook-оор ирсэн дuудлага
alter table public.service_calls
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists raw_payload jsonb;

create unique index if not exists service_calls_external_unique
  on public.service_calls (external_source, external_id)
  where external_source is not null and external_id is not null;

create index if not exists service_calls_external_id_idx
  on public.service_calls (external_id)
  where external_id is not null;

notify pgrst, 'reload schema';
