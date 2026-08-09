-- Gennetex — live stream + хурал (өөрийн web, WebRTC)
-- kind: live = Пост live stream, meeting = Home цэсний хурал
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid,
  host_name text,
  title text default 'Админ хурал',
  kind text not null default 'live' check (kind in ('live', 'meeting')),
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists meetings_status_idx on public.meetings (status, started_at desc);

alter table public.meetings enable row level security;
grant select, insert, update on public.meetings to anon, authenticated;

drop policy if exists "meetings_all" on public.meetings;
create policy "meetings_all" on public.meetings for all using (true) with check (true);

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.meetings'; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
