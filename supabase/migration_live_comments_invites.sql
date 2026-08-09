-- Live сэтгэгдэл + live урилга
create table if not exists public.live_comments (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null,
  user_id uuid,
  user_name text,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists live_comments_live_idx
  on public.live_comments (live_id, created_at desc);

create table if not exists public.live_invites (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null,
  host_id uuid,
  host_name text,
  invitee_id uuid not null,
  invitee_name text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz default now()
);

create index if not exists live_invites_invitee_idx
  on public.live_invites (invitee_id, status, created_at desc);
create index if not exists live_invites_live_idx
  on public.live_invites (live_id, created_at desc);

alter table public.live_comments enable row level security;
alter table public.live_invites enable row level security;
grant select, insert, update on public.live_comments to anon, authenticated;
grant select, insert, update on public.live_invites to anon, authenticated;

drop policy if exists "live_comments_all" on public.live_comments;
create policy "live_comments_all" on public.live_comments for all using (true) with check (true);

drop policy if exists "live_invites_all" on public.live_invites;
create policy "live_invites_all" on public.live_invites for all using (true) with check (true);

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.live_comments'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.live_invites'; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
