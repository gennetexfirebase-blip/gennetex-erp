-- verify.mn Mobile-Originated (MO) утас баталгаажуулалтын session.
-- Нууц API key болон 6 оронтой кодыг санд хадгалахгүй.

create table if not exists public.phone_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  provider_session_id text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  phone text not null check (phone ~ '^[0-9]{8,16}$'),
  session_status text not null default 'PENDING'
    check (session_status in ('PENDING', 'VERIFIED', 'EXPIRED')),
  callback_status text
    check (callback_status is null or callback_status in ('PENDING', 'SENT', 'FAILED')),
  display_instruction text not null,
  sms_uri text,
  subject_type text,
  subject_id text,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists phone_verification_sessions_created_idx
  on public.phone_verification_sessions(created_at desc);
create index if not exists phone_verification_sessions_phone_idx
  on public.phone_verification_sessions(phone, created_at desc);

alter table public.phone_verification_sessions enable row level security;

drop policy if exists phone_verification_admin_select on public.phone_verification_sessions;
create policy phone_verification_admin_select
  on public.phone_verification_sessions for select to authenticated
  using (public.is_admin_user());

drop policy if exists phone_verification_admin_insert on public.phone_verification_sessions;
create policy phone_verification_admin_insert
  on public.phone_verification_sessions for insert to authenticated
  with check (public.is_admin_user() and created_by = auth.uid());

drop policy if exists phone_verification_admin_update on public.phone_verification_sessions;
create policy phone_verification_admin_update
  on public.phone_verification_sessions for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

revoke all on table public.phone_verification_sessions from anon;
grant select, insert, update on table public.phone_verification_sessions to authenticated;
