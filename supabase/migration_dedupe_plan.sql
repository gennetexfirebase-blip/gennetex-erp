-- ============================================================================
-- GENNETEX ERP — Давхардал арилгах
-- ============================================================================
--
-- ⚠️  БҮХЭЛД НЬ НЭГ ДОР АЖИЛЛУУЛЖ БОЛОХГҮЙ. Алхам бүрийг тусад нь.
-- ⚠️  Эхлээд Supabase → Database → Backups дээрээс backup аваарай.
--
-- КОДЫН ӨӨРЧЛӨЛТ АЛЬ ХЭДИЙН ХИЙГДСЭН. Энэ файл нь зөвхөн өгөгдлийн сангийн
-- талыг цэвэрлэнэ. Дараалал: код deploy хийсний ДАРАА энэ SQL-ийг ажиллуулна.
--
-- Үр дүн: 57 → 54 хүснэгт, 10 давхардсан багана арилна.
-- ============================================================================


-- ============================================================================
-- АЛХАМ 0 — ШАЛГАХ  (зөвхөн уншина)
-- ============================================================================

select 'inventory_history' as tbl, count(*) as rows from public.inventory_history
union all select 'live_streams', count(*) from public.live_streams
union all select 'staff',        count(*) from public.staff
union all select 'work_breaks',  count(*) from public.work_breaks;

-- inventory_history нь inventory_counts-ийн 1:1 хуулбар мөн эсэх.
-- Хоёр тоо тэнцүү бол хуулбар нь батлагдана.
select
  (select count(*) from public.inventory_counts)  as counts_rows,
  (select count(*) from public.inventory_history) as history_rows,
  (select count(*) from public.inventory_history h
     join public.inventory_counts c on c.id = h.count_id) as matched_rows;

-- live_streams доторх мөрүүд meetings рүү шилжсэн эсэх
select
  (select count(*) from public.live_streams) as old_live_rows,
  (select count(*) from public.meetings where kind = 'live') as migrated_rows;


-- ============================================================================
-- АЛХАМ 1 — inventory_history
-- ============================================================================
-- ОЛДСОН ЗҮЙЛ: энэ хүснэгт нь `count_id`-аар inventory_counts руу холбогдсон
-- атлаа дээрээс нь 10 баганыг бүрэн хуулж хадгалдаг байв. Хадгалалт бүр
-- ХОЁУЛАНД нь бичдэг тул 1:1 хуулбар — өөрөөр хэлбэл бүтэн хүснэгт илүүц.
--
-- КОД (хийгдсэн): aiInventoryService.js
--   • inventory_history руу бичихээ больсон
--   • fetchInventoryHistory() нь inventory_counts-оос уншина
--     (тэнд бүх талбар + confidence/status/notes нэмэлтээр бий)

alter table if exists public.inventory_history rename to zz_deprecated_inventory_history;


-- ============================================================================
-- АЛХАМ 2 — live_streams
-- ============================================================================
-- ОЛДСОН ЗҮЙЛ: нэгтгэл кодын хувьд АЛЬ ХЭДИЙН дууссан байсан.
--   • meetings хүснэгтэд kind text check (kind in ('live','meeting')) нэмэгдсэн
--   • liveInviteService.fetchActiveLives() нь meetings-ээс kind='live' уншина
--   • FeedScreen.startLive() нь meetingApi.startMeeting() дууддаг
--   • live_streams-ийг уншдаг код үлдээгүй
-- Зөвхөн хуучин liveStreamService.js файл, live_streams хүснэгт хоёр үлдсэн.
--
-- КОД (хийгдсэн): src/services/liveStreamService.js устгав.
--
-- ⚠️ Хэрэв АЛХАМ 0 дээр old_live_rows > 0 гарвал доорхыг ЭХЛЭЭД ажиллуулж
--    хуучин мөрүүдийг meetings рүү зөөнө (id хадгална — live_comments болон
--    live_invites дэх live_id заалт эвдэрхгүй):
--
-- insert into public.meetings (id, host_id, host_name, title, kind, started_at, ended_at, status)
-- select ls.id, ls.host_id, ls.host_name, ls.title, 'live', ls.started_at, ls.ended_at,
--        case when ls.ended_at is null then 'active' else 'ended' end
-- from public.live_streams ls
-- where not exists (select 1 from public.meetings m where m.id = ls.id);

alter table if exists public.live_streams rename to zz_deprecated_live_streams;


-- ============================================================================
-- АЛХАМ 3 — staff
-- ============================================================================
-- ОЛДСОН ЗҮЙЛ: `staff` хүснэгтийг ЯМАР Ч ДЭЛГЭЦ уншдаггүй байв. Зөвхөн
-- AppContext дотор ачаалагдаад хаана ч ашиглагддаггүй байсан. Үүний зэрэгцээ:
--   • апп эхлэх бүрд шаардлагагүй сүлжээний хүсэлт явуулдаг
--   • юу ч хийдэггүй realtime суваг нээдэг
--   • profiles-той 78% давхардсан
-- Байршил хянах жинхэнэ үүргийг trackingService.fetchWorkers() гүйцэтгэдэг —
-- тэр нь profiles-оос latitude/longitude уншина.
--
-- КОД (хийгдсэн):
--   • src/services/staffService.js устгав
--   • AppContext-оос staff / addStaff / refreshStaff / subscribeStaff хаслаа
--
-- ТЭМДЭГЛЭЛ: attendance.staff_id нь `text` төрөлтэй бөгөөд үнэндээ profiles.id
-- хадгалдаг (attApi.insertAttendance({ staffId: profile.id })). staff руу
-- заасан жинхэнэ гадаад түлхүүр хэзээ ч байгаагүй тул энэ нь эвдрэхгүй.

alter table if exists public.staff rename to zz_deprecated_staff;


-- ============================================================================
-- АЛХАМ 4 — work_breaks
-- ============================================================================
-- employee_break_schedules орлосон (shiftService.js:5). Кодод огт ханддаггүй.

alter table if exists public.work_breaks rename to zz_deprecated_work_breaks;


-- ============================================================================
-- АЛХАМ 5 — БҮРМӨСӨН УСТГАХ   ⚠️ БУЦААХ БОЛОМЖГҮЙ
-- ============================================================================
-- 2-3 долоо хоног ажиглаад ямар ч алдаа гараагүй бол л ажиллуулна.
--
--   drop table if exists public.zz_deprecated_inventory_history;
--   drop table if exists public.zz_deprecated_live_streams;
--   drop table if exists public.zz_deprecated_staff;
--   drop table if exists public.zz_deprecated_work_breaks;
--
-- Буцаах бол (АЛХАМ 5-ыг ажиллуулаагүй байхад):
--   alter table public.zz_deprecated_inventory_history rename to inventory_history;
--   alter table public.zz_deprecated_live_streams      rename to live_streams;
--   alter table public.zz_deprecated_staff             rename to staff;
--   alter table public.zz_deprecated_work_breaks       rename to work_breaks;


-- ============================================================================
-- ЗОРИУДААР ХӨНДӨӨГҮЙ
-- ============================================================================
--
-- face_enrollments — АНХНЫ ДҮГНЭЛТ БУРУУ БАЙВ.
--   Эхэндээ "үхмэл" гэж үзсэн боловч Expo Go-д зориулсан үүлэн царай таних
--   (faceCloudService.js) энэ хүснэгтийг ашигладаг болсон. ҮЛДЭЭНЭ.
--
-- authorized_users — УСТГАВАЛ БҮХ НЭВТРЭЛТ ЗОГСОНО.
--   Апп-ын кодоос шууд ханддаггүй ч Supabase-ийн нэвтрэлтийн hook нь SQL
--   түвшинд уншдаг (migration_gmail_auth.sql:61, :347).
--
-- posts ↔ stories (83%) — хоёулаа идэвхтэй, хугацааны логик нь өөр
--   (story 24 цагийн дараа алга болно). Нэгтгэвэл query болгонд шүүлт нэмэгдэнэ.
--
-- messages ↔ telegram_chat_messages (71%) — өөр систем (дотоод чат vs гүүр).
--
-- activity_logs ↔ location_logs ↔ visit_logs ↔ vehicle_logs — зөвхөн
--   latitude/longitude нийтлэг. Санамсаргүй таарсан, өөр өөр үйл явдал.
