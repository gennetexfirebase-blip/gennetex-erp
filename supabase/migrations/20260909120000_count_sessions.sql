-- Тооллогын түүх (toololgo.gennetex.com)
--
-- Excel харьцуулалт хийсэн бүрд нэг мөр үүснэ. Хүнд өгөгдөл нь
-- `count-sessions` bucket дотор `<user_id>/<session_id>.json.gz` нэрээр
-- шахагдан хадгалагдана — энэ хүснэгт зөвхөн мета болон дүнг барина.

create table if not exists public.count_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  user_email   text,
  created_at   timestamptz not null default now(),

  title        text not null,
  note         text,

  source_file  text not null default '',
  source_sheet text not null default '',
  source_rows  integer not null default 0,
  ref_file     text not null default '',
  ref_sheet    text not null default '',
  ref_rows     integer not null default 0,

  duration_ms  integer not null default 0,
  config       jsonb not null default '{}'::jsonb,
  summary      jsonb not null default '{}'::jsonb,

  detail_path  text,
  detail_bytes bigint
);

create index if not exists count_sessions_user_created_idx
  on public.count_sessions (user_id, created_at desc);
create index if not exists count_sessions_created_idx
  on public.count_sessions (created_at desc);

alter table public.count_sessions enable row level security;

-- Ажилтан өөрийн тооллогоо бүрэн эрхтэй; админ бүгдийг харна.
drop policy if exists count_sessions_select on public.count_sessions;
create policy count_sessions_select on public.count_sessions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user());

drop policy if exists count_sessions_insert on public.count_sessions;
create policy count_sessions_insert on public.count_sessions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists count_sessions_update on public.count_sessions;
create policy count_sessions_update on public.count_sessions
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin_user())
  with check (user_id = auth.uid() or public.is_admin_user());

drop policy if exists count_sessions_delete on public.count_sessions;
create policy count_sessions_delete on public.count_sessions
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin_user());

grant select, insert, update, delete on public.count_sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: хувийн bucket. Замын эхний хэсэг нь эзэмшигчийн user_id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('count-sessions', 'count-sessions', false)
on conflict (id) do update set public = false;

drop policy if exists count_sessions_read on storage.objects;
create policy count_sessions_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'count-sessions'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin_user()
    )
  );

drop policy if exists count_sessions_write on storage.objects;
create policy count_sessions_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'count-sessions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists count_sessions_replace on storage.objects;
create policy count_sessions_replace on storage.objects
  for update to authenticated
  using (
    bucket_id = 'count-sessions'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'count-sessions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists count_sessions_remove on storage.objects;
create policy count_sessions_remove on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'count-sessions'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin_user()
    )
  );
