-- ============================================================================
-- Аппын суулгац (APK) хадгалах bucket
-- ============================================================================
--
-- ЯАГААД VERCEL ДЭЭР БИШ:
--   Release APK нь 150 MB (хоёр ABI) буюу arm64 дангаараа ч 100 MB орчим.
--   Vercel-ийн нэг файлын хязгаар 100 MB тул deploy хийгдэхгүй.
--
--   Мөн Vercel нь git-ээс deploy хийдэг. Git нь хоёртын файлын ХУУЧИН
--   хувилбар бүрийг үүрд хадгалдаг тул release гаргах бүрд репо 100 MB-аар
--   хавдана — 20 release гарахад 2 GB болно. Энэ нь clone, CI бүгдийг
--   удаашруулна.
--
--   Тиймээс: татах ХУУДАС нь Vercel дээр (хөнгөн HTML), ФАЙЛ нь энд.
--
-- НЭЭЛТТЭЙ BUCKET:
--   Ажилтан нэвтрэхээсээ ӨМНӨ аппыг татах ёстой тул файл нь нэвтрэлтгүй
--   хүртээмжтэй байх шаардлагатай. Аппын суулгац нь нууц зүйл биш —
--   доторх өгөгдөл нь RLS-ээр хамгаалагдсан.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-releases',
  'app-releases',
  true,
  524288000,  -- 500 MB
  array['application/vnd.android.package-archive', 'application/octet-stream']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 524288000,
      allowed_mime_types = array['application/vnd.android.package-archive', 'application/octet-stream'];

-- Унших — хүн бүрд (нэвтрээгүй ажилтан аппаа татна)
drop policy if exists "app_releases_public_read" on storage.objects;
create policy "app_releases_public_read" on storage.objects
  for select to public
  using (bucket_id = 'app-releases');

-- Байршуулах/солих/устгах — ЗӨВХӨН админ.
-- Эс тэгвээс нэвтэрсэн дурын ажилтан хуурамч APK байршуулж, бусад
-- ажилтнуудад тараах боломжтой болно.
drop policy if exists "app_releases_admin_write" on storage.objects;
create policy "app_releases_admin_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'app-releases'
    and public.role_rank((select p.role from public.profiles p where p.id = auth.uid())) >= 3
  );

drop policy if exists "app_releases_admin_update" on storage.objects;
create policy "app_releases_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'app-releases'
    and public.role_rank((select p.role from public.profiles p where p.id = auth.uid())) >= 3
  );

drop policy if exists "app_releases_admin_delete" on storage.objects;
create policy "app_releases_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'app-releases'
    and public.role_rank((select p.role from public.profiles p where p.id = auth.uid())) >= 3
  );
