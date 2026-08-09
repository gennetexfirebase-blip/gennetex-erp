-- ============================================================
-- Gennetex ERP — Storage: ирцийн зургийн bucket
-- ============================================================
-- "Bucket not found" алдаа гарвал үүнийг SQL Editor дээр Run хий.
-- (Эсвэл Dashboard -> Storage -> New bucket -> нэр: attendance, Public: ON)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('attendance', 'attendance', true)
on conflict (id) do nothing;

drop policy if exists "attendance_read" on storage.objects;
create policy "attendance_read" on storage.objects
  for select using (bucket_id = 'attendance');

drop policy if exists "attendance_write" on storage.objects;
create policy "attendance_write" on storage.objects
  for insert with check (bucket_id = 'attendance');

-- Шалгах:
-- select id, name, public from storage.buckets where id = 'attendance';

-- ============================================================
-- Профайл зургийн bucket (avatars)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_write" on storage.objects;
create policy "avatars_write" on storage.objects
  for insert with check (bucket_id = 'avatars');

  drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update using (bucket_id = 'avatars');

-- ============================================================
-- Чатын хавсралт (зураг/файл) bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('chat', 'chat', true)
on conflict (id) do nothing;

drop policy if exists "chat_read" on storage.objects;
create policy "chat_read" on storage.objects
  for select using (bucket_id = 'chat');

drop policy if exists "chat_write" on storage.objects;
create policy "chat_write" on storage.objects
  for insert with check (bucket_id = 'chat');
