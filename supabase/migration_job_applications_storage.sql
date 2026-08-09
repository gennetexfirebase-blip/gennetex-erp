-- Ажлын байрны анкетын цээж зураг — Storage bucket

insert into storage.buckets (id, name, public)
values ('job-applications', 'job-applications', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "job_applications_storage_select" on storage.objects;
create policy "job_applications_storage_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'job-applications');

drop policy if exists "job_applications_storage_insert" on storage.objects;
create policy "job_applications_storage_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'job-applications');

notify pgrst, 'reload schema';
