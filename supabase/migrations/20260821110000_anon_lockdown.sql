-- ============================================================================
-- CRITICAL — НЭВТРЭЭГҮЙ (anon) ХАНДАЛТЫГ ХААХ
-- ============================================================================
--
-- ЮУ БОЛСОН БЭ:
--   Аудитын үед аппын `EXPO_PUBLIC_SUPABASE_ANON_KEY`-ээр (энэ түлхүүр нь
--   APK дотор ИЛ байдаг тул хэн ч задалж авч чадна) НЭВТРЭХГҮЙГЭЭР дараах
--   өгөгдлийг уншиж чадаж байсан:
--
--     location_logs   1855 мөр  — ажилтны GPS координат, нэр, цаг
--     activity_logs   2292 мөр  — хэн ямар дэлгэц нээснийг харуулсан лог
--     messages         187 мөр  — ажилтан хоорондын чатын БҮТЭН агуулга
--     attendance         7 мөр  — ирцийн selfie зургийн URL + байршил
--     conversations      7 мөр
--     products          24 мөр
--     stock_movements    6 мөр
--
--   Жишээ (бодит хариу):
--     {"user_name":"Adiyasuren","latitude":47.924…,"longitude":106.875…}
--
--   Энэ нь Apple App Review 5.1.1/5.1.2, Google Play User Data policy болон
--   хувийн мэдээлэл хамгаалах хуулийн шууд зөрчил. Дэлгүүрт өгөхөөс ӨМНӨ
--   заавал хаах ёстой.
--
-- ЯАГААД ИЙМ БАЙСАН БЭ:
--   Хуучин `supabase/migration_*.sql` файлууд хүснэгтүүдэд
--     grant select, insert, update, delete ... to anon, authenticated;
--     create policy ... for all to anon, authenticated using (true);
--   гэж бичсэн. RLS асаалттай ч бодлого нь `true` тул юуг ч хязгаарлаагүй.
--
-- ЭНЭ ЗАСВАР ЯГ ЮУ ХИЙХ ВЭ:
--   `anon` РОЛИЙН ХҮСНЭГТИЙН ЭРХИЙГ бөөнөөр нь хураана. Ингэснээр
--   PostgREST нь нэвтрээгүй хүсэлтэд 401 буцаана (яг л одоо `face_templates`,
--   `push_tokens` дээр байгаа шиг).
--
--   ⚠️ `authenticated` ролийн эрхэнд ОГТ ХҮРЭХГҮЙ. Мөн ямар ч policy-г
--      устгахгүй — учир нь олон policy нь `to anon, authenticated` гэж
--      ХОЁУЛАНГ нь нэрлэсэн байдаг тул устгавал нэвтэрсэн хэрэглэгч ч
--      хаагдана. Тиймээс аппын одоогийн ажиллагаа ЯГ ХЭВЭЭР үлдэнэ —
--      зөвхөн нэвтрээгүй хандалт таслагдана.
--
--   Дараа нь public вэбсайтад ҮНЭХЭЭР хэрэгтэй хоёр эрхийг буцааж өгнө:
--     · public_site_content  SELECT — сайтын текстийг зочин уншина
--     · job_applications     INSERT — ажлын анкет илгээнэ (уншихгүй)
--
-- ХЭРХЭН АЖИЛЛУУЛАХ:
--   Supabase → SQL Editor → энэ файлыг бүхэлд нь буулгаад Run.
--
-- ДАРАА НЬ ШАЛГАХ (терминал дээр, нэвтрээгүй байдлаар):
--   curl -s -H "apikey: <ANON_KEY>" \
--     "https://<ref>.supabase.co/rest/v1/location_logs?select=*&limit=1"
--   → {"code":"42501", ... "permission denied"} буюу 401 гарах ЁСТОЙ.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. anon ролиос public схемийн бүх хүснэгтийн эрхийг хураана
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Хойшид нэмэгдэх ШИНЭ хүснэгт мөн автоматаар anon-д нээгдэхгүй байх
-- (энэ нь дараа нь бичих migration-ууд санамсаргүй `to anon` гэж бичихээс
--  бүрэн хамгаалахгүй ч, default privilege-ээр задрахаас сэргийлнэ).
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- ---------------------------------------------------------------------------
-- 2. Public вэбсайтад ҮНЭХЭЭР хэрэгтэй эрхийг буцааж өгнө
-- ---------------------------------------------------------------------------
-- gennetex.mn сайт нь зочинд (нэвтрээгүй) дараах хоёрыг л хийдэг:
--   public-web/src/lib/siteContent.js      → from('public_site_content').select
--   public-web/src/lib/submitApplication.ts → from('job_applications').insert
grant usage  on schema public to anon;
grant select on public.public_site_content to anon;
grant insert on public.job_applications    to anon;

-- Анкет илгээх бодлого нь өмнөх migration дээр үүссэн байх ёстой. Хэрэв
-- байхгүй бол INSERT ажиллахгүй тул энд баталгаажуулна (уншихыг зөвшөөрөхгүй).
drop policy if exists "job_applications_anon_insert" on public.job_applications;
create policy "job_applications_anon_insert" on public.job_applications
  for insert to anon with check (true);

-- Сайтын текстийг зочин унших бодлого.
drop policy if exists "public_site_content_anon_read" on public.public_site_content;
create policy "public_site_content_anon_read" on public.public_site_content
  for select to anon using (true);

-- ---------------------------------------------------------------------------
-- 3. Шалгалт — anon-д ямар хүснэгтэд эрх үлдсэнийг харуулна
-- ---------------------------------------------------------------------------
-- Үр дүнд нь ЗӨВХӨН дараах хоёр мөр гарах ёстой:
--   public_site_content | SELECT
--   job_applications    | INSERT
do $$
declare
  r record;
  extra int := 0;
begin
  for r in
    select table_name, privilege_type
      from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public'
     order by table_name, privilege_type
  loop
    raise notice 'anon → %.% (%)', 'public', r.table_name, r.privilege_type;
    if not (
      (r.table_name = 'public_site_content' and r.privilege_type = 'SELECT') or
      (r.table_name = 'job_applications'    and r.privilege_type = 'INSERT')
    ) then
      extra := extra + 1;
    end if;
  end loop;

  if extra > 0 then
    raise warning 'anon дээр ХҮЛЭЭГДЭЭГҮЙ % эрх үлдлээ — дээрх notice-уудыг шалгана уу', extra;
  else
    raise notice 'OK — anon зөвхөн шаардлагатай 2 эрхтэй үлдлээ';
  end if;
end $$;

notify pgrst, 'reload schema';
