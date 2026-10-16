-- ============================================================================
-- share.gennetex.com — нэвтрэлтгүй, нийтэд нээлттэй хуваалцах
-- ============================================================================
--   Хэн ч текст эсвэл файл байршуулж share.gennetex.com/s/<id> холбоос авна.
--   Холбоостой хүн л харна (жагсаалт байхгүй). Хугацаа (1/7/30 хоног) дуусахад
--   edge function `share-public` устгана. IP тутам цагт 30 удаа.
--   Хүснэгтэд бодлого байхгүй — зөвхөн edge function (service role).
-- ============================================================================

create table if not exists public.public_shares (
  id          text primary key,
  kind        text not null check (kind in ('text', 'file')),
  title       text check (char_length(title) <= 200),
  body        text check (char_length(body) <= 50000),
  file_path   text,
  file_name   text,
  file_size   bigint,
  mime        text,
  uploaded    boolean not null default false,
  ip_hash     text,
  views       int not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists public_shares_expires_idx on public.public_shares (expires_at);
create index if not exists public_shares_ip_idx on public.public_shares (ip_hash, created_at desc);
alter table public.public_shares enable row level security;
revoke all on public.public_shares from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('public-shares', 'public-shares', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;
