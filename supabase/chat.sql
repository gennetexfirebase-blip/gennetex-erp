-- ============================================================
-- Gennetex ERP — Чат + дуудлагын хүснэгтүүд
-- "Could not find the table 'public.conversations'" алдаа гарвал
-- үүнийг Supabase -> SQL Editor дээр Run хий.
-- ============================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_group boolean default false,
  dm_key text unique,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid,
  user_name text,
  created_at timestamptz default now(),
  unique (conversation_id, user_id)
);
create index if not exists conv_members_user_idx on public.conversation_members (user_id);

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  caller_id uuid,
  caller_name text,
  callee_id uuid,
  callee_name text,
  status text default 'ringing',
  created_at timestamptz default now()
);
create index if not exists call_callee_idx on public.call_sessions (callee_id, created_at desc);

-- RLS
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.call_sessions enable row level security;

drop policy if exists "conversations_all" on public.conversations;
create policy "conversations_all" on public.conversations for all using (true) with check (true);

drop policy if exists "conversation_members_all" on public.conversation_members;
create policy "conversation_members_all" on public.conversation_members for all using (true) with check (true);

drop policy if exists "call_sessions_all" on public.call_sessions;
create policy "call_sessions_all" on public.call_sessions for all using (true) with check (true);

-- Realtime (аль хэдийн нэмэгдсэн бол алдаа заавал алгасна)
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.conversations'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.conversation_members'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.call_sessions'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.messages'; exception when others then null; end;
end $$;
