-- Машины үзлэг/даатгалын snapshot болон SMS dedup log.
create table if not exists public.vehicle_compliance_snapshots (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  plate_number text not null,
  inspection_date date,
  inspection_expiry date,
  insurance_expiry date,
  checked_at timestamptz not null default now(),
  last_error text
);

create table if not exists public.vehicle_compliance_notifications (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  plate_number text not null,
  kind text not null check (kind in ('inspection', 'insurance')),
  expiry_date date not null,
  threshold text not null check (threshold in ('warning_14', 'expired')),
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  recipients_count integer not null default 0,
  provider text not null default 'sendsms',
  provider_message_id text,
  attempt_count integer not null default 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, kind, expiry_date, threshold)
);

create index if not exists vehicle_compliance_notifications_created_idx
  on public.vehicle_compliance_notifications(created_at desc);

alter table public.vehicle_compliance_snapshots enable row level security;
alter table public.vehicle_compliance_notifications enable row level security;

drop policy if exists vehicle_compliance_snapshots_admin_select on public.vehicle_compliance_snapshots;
create policy vehicle_compliance_snapshots_admin_select
  on public.vehicle_compliance_snapshots for select to authenticated using (public.is_admin_user());
drop policy if exists vehicle_compliance_notifications_admin_select on public.vehicle_compliance_notifications;
create policy vehicle_compliance_notifications_admin_select
  on public.vehicle_compliance_notifications for select to authenticated using (public.is_admin_user());

revoke all on public.vehicle_compliance_snapshots from anon, authenticated;
revoke all on public.vehicle_compliance_notifications from anon, authenticated;
grant select on public.vehicle_compliance_snapshots to authenticated;
grant select on public.vehicle_compliance_notifications to authenticated;

