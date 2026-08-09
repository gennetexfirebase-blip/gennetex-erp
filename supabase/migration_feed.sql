-- Ажилтнуудын пост / story / reaction / comment (Facebook-style feed)
-- Supabase → SQL Editor дээр Run хийнэ.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid,
  author_name text,
  content text not null default '',
  image_url text,
  tags jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
alter table public.posts add column if not exists tags jsonb default '[]'::jsonb;
create index if not exists posts_created_idx on public.posts (created_at desc);

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid not null,
  user_name text,
  reaction text not null check (reaction in ('like', 'love', 'care', 'haha', 'angry')),
  created_at timestamptz default now(),
  unique (post_id, user_id)
);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid,
  user_name text,
  content text not null,
  created_at timestamptz default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  author_name text,
  image_url text not null,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);
create index if not exists stories_expires_idx on public.stories (expires_at desc);
create index if not exists stories_author_idx on public.stories (author_id, created_at desc);

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz default now(),
  unique (story_id, user_id)
);

alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

drop policy if exists "posts_all" on public.posts;
create policy "posts_all" on public.posts for all using (true) with check (true);

drop policy if exists "post_reactions_all" on public.post_reactions;
create policy "post_reactions_all" on public.post_reactions for all using (true) with check (true);

drop policy if exists "post_comments_all" on public.post_comments;
create policy "post_comments_all" on public.post_comments for all using (true) with check (true);

drop policy if exists "stories_all" on public.stories;
create policy "stories_all" on public.stories for all using (true) with check (true);

drop policy if exists "story_views_all" on public.story_views;
create policy "story_views_all" on public.story_views for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('feed', 'feed', true)
on conflict (id) do update set public = true;

drop policy if exists "feed_read" on storage.objects;
create policy "feed_read" on storage.objects
  for select using (bucket_id = 'feed');

drop policy if exists "feed_write" on storage.objects;
create policy "feed_write" on storage.objects
  for insert with check (bucket_id = 'feed');

drop policy if exists "feed_update" on storage.objects;
create policy "feed_update" on storage.objects
  for update using (bucket_id = 'feed');

drop policy if exists "feed_delete" on storage.objects;
create policy "feed_delete" on storage.objects
  for delete using (bucket_id = 'feed');

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.posts'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.post_reactions'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.post_comments'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.stories'; exception when others then null; end;
end $$;
