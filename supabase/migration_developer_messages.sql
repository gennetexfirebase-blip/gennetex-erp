-- Хөгжүүлэгчид илгээх мессеж (апп + admin-web)
create table if not exists public.developer_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  user_name text not null default 'Ажилтан',
  user_email text,
  subject text,
  body text not null,
  status text not null default 'new',
  created_at timestamptz default now()
);

create index if not exists developer_messages_created_idx
  on public.developer_messages (created_at desc);

alter table public.developer_messages enable row level security;

drop policy if exists "developer_messages_all" on public.developer_messages;
create policy "developer_messages_all" on public.developer_messages
  for all using (true) with check (true);
