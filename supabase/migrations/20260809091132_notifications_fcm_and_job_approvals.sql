-- Production FCM tokens, notification center/settings, and job application approval.
-- Idempotent where practical so existing Gennetex installations can be upgraded safely.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null,
  device_id text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens add column if not exists device_id text;
alter table public.push_tokens add column if not exists active boolean not null default true;
alter table public.push_tokens add column if not exists last_seen_at timestamptz not null default now();
alter table public.push_tokens add column if not exists created_at timestamptz not null default now();
alter table public.push_tokens add column if not exists updated_at timestamptz not null default now();
update public.push_tokens set platform = 'android' where platform is null;
alter table public.push_tokens alter column user_id set not null;
alter table public.push_tokens alter column platform set not null;

create unique index if not exists push_tokens_token_uidx on public.push_tokens(token);
create index if not exists push_tokens_user_active_idx on public.push_tokens(user_id, active) where active;
create index if not exists push_tokens_device_idx on public.push_tokens(device_id) where device_id is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'push_tokens_platform_check' and conrelid = 'public.push_tokens'::regclass) then
    alter table public.push_tokens add constraint push_tokens_platform_check check (platform in ('android', 'ios'));
  end if;
end $$;

alter table public.push_tokens enable row level security;
drop policy if exists "push_tokens_all" on public.push_tokens;
drop policy if exists "push_tokens_select_own" on public.push_tokens;
drop policy if exists "push_tokens_insert_own" on public.push_tokens;
drop policy if exists "push_tokens_update_own" on public.push_tokens;
drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_select_own" on public.push_tokens for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_tokens_insert_own" on public.push_tokens for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_tokens_update_own" on public.push_tokens for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "push_tokens_delete_own" on public.push_tokens for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.push_tokens from anon;
grant select, insert, update, delete on public.push_tokens to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'system',
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists body text;
alter table public.notifications add column if not exists type text not null default 'system';
alter table public.notifications add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists is_read boolean not null default false;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists created_at timestamptz not null default now();
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, created_at desc) where not is_read;

alter table public.notifications enable row level security;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy "notifications_update_own" on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notifications_delete_own" on public.notifications for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.notifications from anon;
revoke insert on public.notifications from authenticated;
grant select, update, delete on public.notifications to authenticated;

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  orders_enabled boolean not null default true,
  payments_enabled boolean not null default true,
  tasks_enabled boolean not null default true,
  system_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
drop policy if exists "notification_settings_select_own" on public.notification_settings;
drop policy if exists "notification_settings_insert_own" on public.notification_settings;
drop policy if exists "notification_settings_update_own" on public.notification_settings;
create policy "notification_settings_select_own" on public.notification_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "notification_settings_insert_own" on public.notification_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notification_settings_update_own" on public.notification_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.notification_settings from anon;
grant select, insert, update on public.notification_settings to authenticated;

create or replace function public.touch_notification_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_notification_updated_at() from public, anon, authenticated;

drop trigger if exists push_tokens_touch_updated_at on public.push_tokens;
create trigger push_tokens_touch_updated_at before update on public.push_tokens for each row execute function public.touch_notification_updated_at();
drop trigger if exists notification_settings_touch_updated_at on public.notification_settings;
create trigger notification_settings_touch_updated_at before update on public.notification_settings for each row execute function public.touch_notification_updated_at();

alter table if exists public.job_applications add column if not exists admin_signature_svg text;
alter table if exists public.job_applications add column if not exists admin_signed_at timestamptz;
alter table if exists public.job_applications add column if not exists admin_signed_by uuid references auth.users(id) on delete set null;
alter table if exists public.job_applications add column if not exists admin_signed_by_name text;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
