-- Бодит MT SMS илгээлтийн аудит, idempotency, RLS.
create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  phone text not null,
  message text not null check (char_length(message) between 1 and 1000),
  provider text not null,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  segments integer check (segments is null or segments between 1 and 10),
  encoding text check (encoding is null or encoding in ('GSM-7', 'UCS-2')),
  idempotency_key text not null,
  consent_confirmed boolean not null default false,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, idempotency_key)
);

create index if not exists sms_messages_created_idx on public.sms_messages(created_at desc);
create index if not exists sms_messages_phone_idx on public.sms_messages(phone, created_at desc);
alter table public.sms_messages enable row level security;

drop policy if exists sms_messages_admin_select on public.sms_messages;
create policy sms_messages_admin_select on public.sms_messages
  for select to authenticated using (public.is_admin_user());
drop policy if exists sms_messages_admin_insert on public.sms_messages;
create policy sms_messages_admin_insert on public.sms_messages
  for insert to authenticated
  with check (public.is_admin_user() and created_by = auth.uid() and consent_confirmed);
drop policy if exists sms_messages_admin_update on public.sms_messages;
create policy sms_messages_admin_update on public.sms_messages
  for update to authenticated using (public.is_admin_user()) with check (public.is_admin_user());

revoke all on table public.sms_messages from anon;
grant select, insert, update on table public.sms_messages to authenticated;
