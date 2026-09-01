-- ══════════════════════════════════════════════════════════════════
-- DEMO ДАНС · 1-Р АЛХАМ (нэвтрэх данс үүсгэхийн ӨМНӨ)
--
-- ЗОРИЛГО:
--   App Store болон Google Play-ийн шинжээч аппыг нээж үзэхийн тулд
--   нэвтрэх данс шаарддаг. Танай апп нь урьдчилан бүртгэсэн ажилтныг
--   л оруулдаг тул тусгайлан үүсгэх ёстой.
--
-- ⚠️ ДАРААЛАЛ ЧУХАЛ.
--   `auth.users` дээрх `on_auth_user_created` trigger нь
--   `handle_new_authorized_user`-ыг дуудаж, и-мэйлийг
--   `authorized_users`-аас хайдаг. ОЛДОХГҮЙ бол
--   `raise exception 'gmail_not_authorized'` шидэж дансны үүсгэлт
--   БҮТЭЛГҮЙТНЭ.
--
--   Тиймээс энэ скриптийг Dashboard дээр хэрэглэгч үүсгэхийн ӨМНӨ
--   ажиллуулна.
--
-- ⚠️ РОЛЬ НЬ ЗОРИУД `employee`.
--   `is_admin_user()` нь БҮХ байгууллагыг хамардаг тул админ эрхтэй
--   demo данс өгвөл шинжээч танай бодит ажилтнуудын цалин, хувийн
--   чат, байршлыг харна. Тэд нууцлал сахидаг ч үзүүлэх шаардлага
--   байхгүй. Админы дэлгэцийг дэлгэцийн бичлэгээр харуулна.
-- ══════════════════════════════════════════════════════════════════

-- ── Demo хэлтэс ──────────────────────────────────────────────────
-- Бодит хэлтсээс тусад нь байлгана — бодит ажилтны өгөгдөл
-- холилдохоос сэргийлнэ.
insert into public.departments (name, kind, note, active)
select 'Demo (дэлгүүрийн шалгалт)', 'org',
       'App Store / Google Play-ийн шинжээчид зориулсан. Бодит ажилтан ОРУУЛАХГҮЙ.',
       true
where not exists (
  select 1 from public.departments where name = 'Demo (дэлгүүрийн шалгалт)'
);

-- ── Зөвшөөрөгдсөн и-мэйл ─────────────────────────────────────────
-- ⚠️ И-МЭЙЛЭЭ СОЛИНО УУ. Жинхэнэ хаяг байх шаардлагагүй ч
--    Dashboard дээр үүсгэх дансны и-мэйлтэй ЯГ ИЖИЛ байх ёстой.
insert into public.authorized_users (
  email, name, last_name, position, phone, role, active, department_id
)
select
  'demo.review@gennetex.mn',
  'Demo',
  'Reviewer',
  'Ажилтан',
  '99000000',
  'employee',
  true,
  d.id
from public.departments d
where d.name = 'Demo (дэлгүүрийн шалгалт)'
on conflict (email) do update
  set active        = true,
      role          = 'employee',
      department_id = excluded.department_id;

-- ── Шалгалт ──────────────────────────────────────────────────────
select
  a.email,
  a.role,
  a.active,
  d.name as department,
  case when a.linked_user_id is null
       then 'Дараа нь Dashboard дээр данс үүсгэнэ'
       else 'Данс аль хэдийн холбогдсон' end as status
from public.authorized_users a
left join public.departments d on d.id = a.department_id
where a.email = 'demo.review@gennetex.mn';
