-- Чатын зураг/видео/файл — Storage bucket + эрх
-- "Bucket not found" эсвэл зураг харагдахгүй бол энийг SQL Editor дээр ажиллуулна.

insert into storage.buckets (id, name, public)
values ('chat', 'chat', true)
on conflict (id) do update set public = true;

drop policy if exists "chat_read" on storage.objects;
create policy "chat_read" on storage.objects
  for select using (bucket_id = 'chat');

drop policy if exists "chat_write" on storage.objects;
create policy "chat_write" on storage.objects
  for insert with check (bucket_id = 'chat');

drop policy if exists "chat_update" on storage.objects;
create policy "chat_update" on storage.objects
  for update using (bucket_id = 'chat');

drop policy if exists "chat_delete" on storage.objects;
create policy "chat_delete" on storage.objects
  for delete using (bucket_id = 'chat');
