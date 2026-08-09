-- Push notification token хадгалах хүснэгт
-- Supabase SQL Editor дээр ажиллуулна.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz default now()
);

create unique index if not exists push_tokens_user_token_idx on public.push_tokens (user_id, token);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_all" on public.push_tokens;
create policy "push_tokens_all" on public.push_tokens for all using (true) with check (true);

notify pgrst, 'reload schema';
