-- ============================================================================
-- Царай таних Edge Function-д шаардлагатай бэлтгэл
-- ============================================================================
--
-- `face-verify` Edge Function нь `face_templates` дээр upsert хийдэг
-- (нэг ажилтанд нэг өнцөг = нэг мөр). Үүнд unique constraint шаардлагатай,
-- гэтэл одоо зөвхөн энгийн индекс байна.
-- ============================================================================


-- Давхардсан мөр байвал upsert-ийн өмнө цэвэрлэнэ.
-- Хамгийн сүүлийнхийг үлдээж, хуучныг устгана.
delete from public.face_templates a
using public.face_templates b
where a.user_id = b.user_id
  and a.pose = b.pose
  and a.created_at < b.created_at;

-- Нэг ажилтан · нэг өнцөг = нэг мөр
create unique index if not exists face_templates_user_pose_uniq
  on public.face_templates (user_id, pose);


-- ---------------------------------------------------------------------------
-- Загварын bucket
-- ---------------------------------------------------------------------------
-- Edge Function нь ONNX загваруудыг эндээс уншина. Нийтэд нээлттэй биш —
-- функц service role-оор хандана.

insert into storage.buckets (id, name, public)
values ('models', 'models', false)
on conflict (id) do nothing;


-- ============================================================================
-- ДАРААГИЙН АЛХАМУУД (гараар хийнэ)
-- ============================================================================
--
-- 1. Загваруудыг татаж, Storage → models bucket-д байршуулна:
--
--    face_detection_yunet_2023mar.onnx      (~340 KB)
--    https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
--
--    face_recognition_sface_2021dec.onnx    (~37 MB)
--    https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx
--
--    (Байршуулаагүй бол функц GitHub-аас шууд татна — ажиллана, гэхдээ
--     хүйтэн эхлэлт удаан болно.)
--
-- 2. Функцийг deploy хийнэ:
--
--    npx supabase functions deploy face-verify
--
-- 3. Туршина. Эхний дуудалт 3-6 секунд болно (загвар ачаалах), дараагийнх
--    нь хурдан. Хэрэв timeout болвол загваруудыг заавал Storage-д
--    байршуулсан эсэхээ шалгаарай.
