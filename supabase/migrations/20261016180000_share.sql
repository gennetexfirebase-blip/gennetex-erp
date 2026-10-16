-- ============================================================================
-- share.gennetex.com — ажилтнууд текст, файл хуваалцах
-- ============================================================================
--   Бүх нэвтэрсэн ажилтан текст бичих эсвэл файл байршуулж, «Бүгд» эсвэл
--   сонгосон хүмүүст хуваалцана. Файл private bucket `shares`-д
--   (<owner_id>/<uuid>-<нэр>), харах эрхтэй хүнд signed URL-ээр.
-- ============================================================================

create table if not exists public.shares (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  owner_name  text,
  kind        text not null check (kind in ('text', 'file')),
  title       text check (char_length(title) <= 200),
  body        text check (char_length(body) <= 20000),
  file_path   text,
  file_name   text,
  file_size   bigint,
  mime        text,
  audience    text not null default 'all' check (audience in ('all', 'users')),
  recipients  uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  constraint shares_content check ((kind = 'text' and coalesce(body, '') <> '') or (kind = 'file' and file_path is not null))
);
create index if not exists shares_created_idx on public.shares (created_at desc);
create index if not exists shares_recipients_idx on public.shares using gin (recipients);
alter table public.shares enable row level security;

drop policy if exists shares_read on public.shares;
create policy shares_read on public.shares for select to authenticated
  using (owner_id = (select auth.uid()) or audience = 'all' or (select auth.uid()) = any (recipients));
drop policy if exists shares_insert on public.shares;
create policy shares_insert on public.shares for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists shares_delete on public.shares;
create policy shares_delete on public.shares for delete to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin_user());
grant select, insert, delete on public.shares to authenticated;

-- ── Файлын сав ───────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('shares', 'shares', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists shares_obj_insert on storage.objects;
create policy shares_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'shares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists shares_obj_read on storage.objects;
create policy shares_obj_read on storage.objects for select to authenticated
  using (
    bucket_id = 'shares' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.shares s
        where s.file_path = storage.objects.name
          and (s.audience = 'all' or (select auth.uid()) = any (s.recipients))
      )
    )
  );

drop policy if exists shares_obj_delete on storage.objects;
create policy shares_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'shares' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin_user()));

notify pgrst, 'reload schema';

-- Шинэ хуваалцсан зүйл нээлттэй хуудсанд шууд харагдана.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shares') then
    alter publication supabase_realtime add table public.shares;
  end if;
end $$;
