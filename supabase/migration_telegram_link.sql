-- Ажилтан ↔ Telegram хувийн холболт
alter table public.profiles
  add column if not exists telegram_user_id bigint,
  add column if not exists telegram_username text,
  add column if not exists telegram_linked_at timestamptz;

create unique index if not exists profiles_telegram_user_id_uidx
  on public.profiles (telegram_user_id)
  where telegram_user_id is not null;

create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists telegram_link_tokens_user_idx
  on public.telegram_link_tokens (user_id, created_at desc);

alter table public.telegram_link_tokens enable row level security;

drop policy if exists "telegram_link_tokens_own_select" on public.telegram_link_tokens;
create policy "telegram_link_tokens_own_select" on public.telegram_link_tokens
  for select using (auth.uid() = user_id);

-- Insert/update зөвхөн service role (edge function) — RLS-ээр client insert хориглоно
revoke insert, update, delete on public.telegram_link_tokens from anon, authenticated;
grant select on public.telegram_link_tokens to authenticated;

notify pgrst, 'reload schema';
