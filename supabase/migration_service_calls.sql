-- Инженерийн дуудлага (админ бүртгэнэ, инженерт онооно)

create table if not exists public.service_calls (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  phone text,
  address text,
  problem text,
  call_type text not null default 'other',
  engineer_id uuid references auth.users(id) on delete set null,
  engineer_name text,
  latitude double precision,
  longitude double precision,
  status text not null default 'Хүлээгдэж буй',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists service_calls_engineer_idx on public.service_calls (engineer_id, created_at desc);
create index if not exists service_calls_status_idx on public.service_calls (status, created_at desc);

alter table public.service_calls enable row level security;
grant select, insert, update on public.service_calls to anon, authenticated;

drop policy if exists "service_calls_all" on public.service_calls;
create policy "service_calls_all" on public.service_calls for all to anon, authenticated using (true) with check (true);

do $$
begin
  execute 'alter publication supabase_realtime add table public.service_calls';
exception when others then null;
end $$;

notify pgrst, 'reload schema';
