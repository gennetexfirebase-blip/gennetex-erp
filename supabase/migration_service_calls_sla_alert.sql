-- SLA хэтэрсэн push — давхар илгээхгүй
alter table public.service_calls
  add column if not exists sla_alert_at timestamptz;

create index if not exists service_calls_sla_alert_idx
  on public.service_calls (sla_alert_at, created_at desc);
