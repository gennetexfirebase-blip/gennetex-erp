-- ============================================================================
-- Ирц бүртгүүлэх БҮХ байршлыг БҮХ ажилтанд харуулах
-- ============================================================================
--
-- ЗОРИЛГО:
--   Ажилтан аль цэг дээр ирцээ бүртгүүлж болохоо газрын зураг дээр
--   бүрэн харах ёстой. Нэг ч биш, БҮХ идэвхтэй цэг харагдана.
--
-- ⚠️ ДАВХАР ЗАСВАР — эрхийн зөрчил:
--   Хуучин бодлого нь `for all using (true) with check (true)` байсан.
--   Энэ нь зөвхөн уншихыг биш, БИЧИХИЙГ ч бүгдэд нээсэн гэсэн үг —
--   өөрөөр хэлбэл энгийн ажилтан ирцийн байршлыг өөрчлөх, устгах,
--   радиусыг нь өргөсгөх боломжтой байв (ирцийн хяналтыг тойрч
--   гарах зам). Одоо:
--       унших → нэвтэрсэн бүх хүн
--       бичих → зөвхөн админ
--
--   `attendance_wifi`-д мөн ижил зарчим аль хэдийн хэрэгжсэн тул
--   эндээс зөрчилдөхгүй.
-- ============================================================================

alter table public.attendance_locations enable row level security;

-- Хуучин "бүгдэд бүгдийг" бодлогыг арилгана.
drop policy if exists "attendance_locations_all"    on public.attendance_locations;
drop policy if exists "attendance_locations_read"   on public.attendance_locations;
drop policy if exists "attendance_locations_write"  on public.attendance_locations;

-- Харах: нэвтэрсэн БҮХ ажилтан (хэлтэс, оноолтоос үл хамааран).
-- Байршлын нэр, радиус нь нууц мэдээлэл биш бөгөөд ажилтан хаана
-- бүртгүүлж болохоо мэдэх ёстой.
create policy "attendance_locations_read" on public.attendance_locations
  for select to authenticated
  using (true);

-- Нэмэх/засах/устгах: зөвхөн админ.
create policy "attendance_locations_write" on public.attendance_locations
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select on public.attendance_locations to authenticated;
grant insert, update, delete on public.attendance_locations to authenticated;

notify pgrst, 'reload schema';
