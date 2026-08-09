-- Telegram ↔ Gennetex апп чат (групп мессежийг хадгална)
create table if not exists public.telegram_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  content text not null,
  source text not null default 'app' check (source in ('app', 'telegram')),
  telegram_message_id bigint,
  created_at timestamptz default now()
);

create index if not exists telegram_chat_messages_created_idx
  on public.telegram_chat_messages (created_at desc);

alter table public.telegram_chat_messages enable row level security;
grant select, insert on public.telegram_chat_messages to anon, authenticated;

drop policy if exists "telegram_chat_messages_all" on public.telegram_chat_messages;
create policy "telegram_chat_messages_all" on public.telegram_chat_messages
  for all using (true) with check (true);

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.telegram_chat_messages'; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
