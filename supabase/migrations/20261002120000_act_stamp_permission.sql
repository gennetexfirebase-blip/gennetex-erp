-- Актад байгууллагын тамга дарах эрх (acts.stamp).
-- Энэ эрхгүй хэрэглэгч акт үүсгэхэд тамга автоматаар орохгүй, зөвхөн гарын үсэг гарна.

update public.profiles
   set permissions = coalesce(permissions, '{}'::jsonb) || jsonb_build_object('acts.stamp', true)
 where lower(email) = 'bayasgalan.gennetex@gmail.com';
