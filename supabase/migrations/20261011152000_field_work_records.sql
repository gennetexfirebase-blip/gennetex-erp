-- Талбайн ажлын тэмдэглэл: «Боксны таг» (шинээр таг сольсон) ба «Шилжүүлэг».
--
-- Ажилтан өмнөх, дараах зургийг ЗААВАЛ камераар авч илгээнэ; зураг авах үед
-- GPS автоматаар бүртгэгдэнэ. Ажилтан өөрийнхөө, ахлах+ бүх тэмдэглэлийг харна.
-- Зураг: хувийн `field-work-photos` bucket, зам `<user_id>/<file>`.

create table if not exists public.field_work_records (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('box_tag', 'transfer')),
  created_by       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_by_name  text,
  box_code         text,
  customer         text,
  note             text,
  before_path      text not null,
  after_path       text not null,
  before_taken_at  timestamptz,
  after_taken_at   timestamptz,
  latitude         double precision,
  longitude        double precision,
  accuracy         double precision,
  created_at       timestamptz not null default now()
);

create index if not exists field_work_records_kind_idx
  on public.field_work_records (kind, created_at desc);
create index if not exists field_work_records_owner_idx
  on public.field_work_records (created_by, created_at desc);

create or replace function public.field_work_viewer_rank()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.role_rank(p.role), 0) from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.field_work_viewer_rank() from public, anon;
grant execute on function public.field_work_viewer_rank() to authenticated;

alter table public.field_work_records enable row level security;
revoke all on public.field_work_records from anon;
grant select, insert, delete on public.field_work_records to authenticated;

drop policy if exists field_work_select on public.field_work_records;
create policy field_work_select on public.field_work_records for select to authenticated
using (created_by = auth.uid() or public.field_work_viewer_rank() >= 1);

drop policy if exists field_work_insert on public.field_work_records;
create policy field_work_insert on public.field_work_records for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists field_work_delete on public.field_work_records;
create policy field_work_delete on public.field_work_records for delete to authenticated
using (public.field_work_viewer_rank() >= 3);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('field-work-photos', 'field-work-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists field_work_photos_select on storage.objects;
create policy field_work_photos_select on storage.objects for select to authenticated
using (bucket_id = 'field-work-photos'
       and ((storage.foldername(name))[1] = auth.uid()::text or public.field_work_viewer_rank() >= 1));

drop policy if exists field_work_photos_insert on storage.objects;
create policy field_work_photos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'field-work-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists field_work_photos_delete on storage.objects;
create policy field_work_photos_delete on storage.objects for delete to authenticated
using (bucket_id = 'field-work-photos' and public.field_work_viewer_rank() >= 3);

notify pgrst, 'reload schema';
