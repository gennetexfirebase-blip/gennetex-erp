-- Gennetex Post — үнэгүй Live (Jitsi)
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  host_id uuid,
  host_name text,
  title text,
  room_name text not null unique,
  status text not null default 'live' check (status in ('live', 'ended')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists live_streams_status_idx on public.live_streams (status, started_at desc);
create index if not exists live_streams_host_idx on public.live_streams (host_id, started_at desc);

alter table public.live_streams enable row level security;
grant select, insert, update on public.live_streams to anon, authenticated;

drop policy if exists "live_streams_all" on public.live_streams;
create policy "live_streams_all" on public.live_streams for all using (true) with check (true);

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.live_streams'; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
