-- Админд "дуудлагаар явах" эрх нэмэх. Зөвхөн системийн админ (superadmin) оноож болно.
-- Ажилтан (employee) энэ эрхгүйгээр ч дуудлага авдаг тул зөвхөн админд ач холбогдолтой.

alter table public.profiles
  add column if not exists can_take_calls boolean not null default false;

comment on column public.profiles.can_take_calls is
  'Админ хэрэглэгч дуудлагаар (service call) явж болох эсэх. Зөвхөн superadmin оноодог.';
