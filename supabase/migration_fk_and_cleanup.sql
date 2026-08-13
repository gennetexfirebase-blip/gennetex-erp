-- ============================================================================
-- GENNETEX ERP — Foreign key холбоо нэмэх + ашиглагдахгүй хүснэгт цэгцлэх
-- ============================================================================
--
-- ⚠️  ЭНЭ ФАЙЛЫГ БҮХЭЛД НЬ НЭГ ДОР АЖИЛЛУУЛЖ БОЛОХГҮЙ.
--     ХЭСЭГ 0 → 1 → 2 → 3 гэсэн дарааллаар, тус тусад нь ажиллуулна.
--
-- Ажиллуулахын өмнө:
--     Supabase Dashboard → Database → Backups → шинэ backup авна.
--
-- Дараалал:
--     ХЭСЭГ 0  Зөвхөн УНШИНА. Өнчин мөр байгаа эсэхийг шалгана. (аюулгүй)
--     ХЭСЭГ 1  Гадаад түлхүүр нэмнэ. (NOT VALID → VALIDATE, аюулгүй)
--     ХЭСЭГ 2  Хуучирсан хүснэгтийг НЭР СОЛИНО, устгахгүй. (буцаах боломжтой)
--     ХЭСЭГ 3  Бүрмөсөн устгана. 2-3 долоо хоногийн дараа л ажиллуулна.
--
-- ============================================================================


-- ============================================================================
-- ХЭСЭГ 0 — ӨНЧИН МӨР ШАЛГАХ  (зөвхөн уншина, юу ч өөрчлөхгүй)
-- ============================================================================
-- Гадаад түлхүүр нэмэхээс өмнө "заасан мөр нь байхгүй" өгөгдөл байгаа эсэхийг
-- шалгана. Хэрэв тоо 0-ээс их гарвал ХЭСЭГ 1 доторх тухайн мөрийг
-- ажиллуулахын өмнө уг өгөгдлийг цэвэрлэх эсвэл NULL болгох хэрэгтэй.

select 'activity_logs.user_id'        as col, count(*) as orphans from public.activity_logs        t left join public.profiles p on p.id = t.user_id     where t.user_id     is not null and p.id is null
union all select 'ai_detection_logs.product_id',   count(*) from public.ai_detection_logs t left join public.products p on p.id = t.product_id  where t.product_id  is not null and p.id is null
union all select 'ai_detection_logs.employee_id',  count(*) from public.ai_detection_logs t left join public.profiles p on p.id = t.employee_id where t.employee_id is not null and p.id is null
union all select 'conversation_members.user_id',   count(*) from public.conversation_members t left join public.profiles p on p.id = t.user_id  where t.user_id     is not null and p.id is null
union all select 'inventory_counts.employee_id',   count(*) from public.inventory_counts t left join public.profiles p on p.id = t.employee_id  where t.employee_id is not null and p.id is null
union all select 'inventory_history.product_id',   count(*) from public.inventory_history t left join public.products p on p.id = t.product_id   where t.product_id  is not null and p.id is null
union all select 'inventory_history.employee_id',  count(*) from public.inventory_history t left join public.profiles p on p.id = t.employee_id  where t.employee_id is not null and p.id is null
union all select 'live_comments.user_id',          count(*) from public.live_comments t left join public.profiles p on p.id = t.user_id          where t.user_id     is not null and p.id is null
union all select 'live_comments.live_id',          count(*) from public.live_comments t left join public.live_streams s on s.id = t.live_id      where t.live_id     is not null and s.id is null
union all select 'live_invites.live_id',           count(*) from public.live_invites t left join public.live_streams s on s.id = t.live_id       where t.live_id     is not null and s.id is null
union all select 'live_invites.host_id',           count(*) from public.live_invites t left join public.profiles p on p.id = t.host_id           where t.host_id     is not null and p.id is null
union all select 'live_invites.invitee_id',        count(*) from public.live_invites t left join public.profiles p on p.id = t.invitee_id        where t.invitee_id  is not null and p.id is null
union all select 'live_streams.host_id',           count(*) from public.live_streams t left join public.profiles p on p.id = t.host_id           where t.host_id     is not null and p.id is null
union all select 'meetings.host_id',               count(*) from public.meetings t left join public.profiles p on p.id = t.host_id               where t.host_id     is not null and p.id is null
union all select 'post_comments.user_id',          count(*) from public.post_comments t left join public.profiles p on p.id = t.user_id          where t.user_id     is not null and p.id is null
union all select 'post_reactions.user_id',         count(*) from public.post_reactions t left join public.profiles p on p.id = t.user_id         where t.user_id     is not null and p.id is null
union all select 'posts.author_id',                count(*) from public.posts t left join public.profiles p on p.id = t.author_id                where t.author_id   is not null and p.id is null
union all select 'stock_movements.user_id',        count(*) from public.stock_movements t left join public.profiles p on p.id = t.user_id        where t.user_id     is not null and p.id is null
union all select 'stock_movements.item_id',        count(*) from public.stock_movements t left join public.inventory i on i.id = t.item_id       where t.item_id     is not null and i.id is null
union all select 'stories.author_id',              count(*) from public.stories t left join public.profiles p on p.id = t.author_id              where t.author_id   is not null and p.id is null
union all select 'story_views.user_id',            count(*) from public.story_views t left join public.profiles p on p.id = t.user_id            where t.user_id     is not null and p.id is null
union all select 'vehicle_logs.vehicle_id',        count(*) from public.vehicle_logs t left join public.vehicles v on v.id = t.vehicle_id        where t.vehicle_id  is not null and v.id is null
union all select 'vehicle_logs.user_id',           count(*) from public.vehicle_logs t left join public.profiles p on p.id = t.user_id           where t.user_id     is not null and p.id is null
order by orphans desc, col;


-- Хуучирсан хүснэгтэд өгөгдөл байгаа эсэх (ХЭСЭГ 2-ын өмнө хараарай)
select 'face_enrollments' as tbl, count(*) as rows from public.face_enrollments
union all select 'work_breaks', count(*) from public.work_breaks;


-- ============================================================================
-- ХЭСЭГ 1 — ГАДААД ТҮЛХҮҮР НЭМЭХ
-- ============================================================================
-- `not valid` гэдэг нь: одоо байгаа мөрүүдийг шалгахгүй, зөвхөн ШИНЭ бичилтэд
-- үйлчилнэ. Тиймээс өнчин мөр байсан ч энэ алхам амжилттай болно, апп зогсохгүй.
-- Дараа нь `validate constraint` хийхэд хуучин мөрүүд шалгагдана — хэрэв өнчин
-- мөр байвал ЭНЭ алхам алдаа өгнө (гэхдээ түгжихгүй, апп ажиллаж байх болно).
--
-- ON DELETE логик:
--   cascade    — эцэг мөр уствал хүүхэд мөр нь утгагүй болно (сэтгэгдэл, реакц)
--   set null   — эцэг мөр устсан ч түүх үлдэх ёстой (агуулахын хөдөлгөөн, лог)

alter table public.activity_logs drop constraint if exists activity_logs_user_fk;
alter table public.activity_logs        add constraint activity_logs_user_fk        foreign key (user_id)     references public.profiles(id)     on delete set null not valid;
alter table public.ai_detection_logs drop constraint if exists ai_det_product_fk;
alter table public.ai_detection_logs    add constraint ai_det_product_fk            foreign key (product_id)  references public.products(id)     on delete set null not valid;
alter table public.ai_detection_logs drop constraint if exists ai_det_employee_fk;
alter table public.ai_detection_logs    add constraint ai_det_employee_fk           foreign key (employee_id) references public.profiles(id)     on delete set null not valid;
alter table public.conversation_members drop constraint if exists conv_members_user_fk;
alter table public.conversation_members add constraint conv_members_user_fk         foreign key (user_id)     references public.profiles(id)     on delete cascade  not valid;
alter table public.inventory_counts drop constraint if exists inv_counts_employee_fk;
alter table public.inventory_counts     add constraint inv_counts_employee_fk       foreign key (employee_id) references public.profiles(id)     on delete set null not valid;
alter table public.inventory_history drop constraint if exists inv_hist_product_fk;
alter table public.inventory_history    add constraint inv_hist_product_fk          foreign key (product_id)  references public.products(id)     on delete set null not valid;
alter table public.inventory_history drop constraint if exists inv_hist_employee_fk;
alter table public.inventory_history    add constraint inv_hist_employee_fk         foreign key (employee_id) references public.profiles(id)     on delete set null not valid;
alter table public.live_comments drop constraint if exists live_comments_user_fk;
alter table public.live_comments        add constraint live_comments_user_fk        foreign key (user_id)     references public.profiles(id)     on delete cascade  not valid;
alter table public.live_comments drop constraint if exists live_comments_live_fk;
alter table public.live_comments        add constraint live_comments_live_fk        foreign key (live_id)     references public.live_streams(id) on delete cascade  not valid;
alter table public.live_invites drop constraint if exists live_invites_live_fk;
alter table public.live_invites         add constraint live_invites_live_fk         foreign key (live_id)     references public.live_streams(id) on delete cascade  not valid;
alter table public.live_invites drop constraint if exists live_invites_host_fk;
alter table public.live_invites         add constraint live_invites_host_fk         foreign key (host_id)     references public.profiles(id)     on delete cascade  not valid;
alter table public.live_invites drop constraint if exists live_invites_invitee_fk;
alter table public.live_invites         add constraint live_invites_invitee_fk      foreign key (invitee_id)  references public.profiles(id)     on delete cascade  not valid;
alter table public.live_streams drop constraint if exists live_streams_host_fk;
alter table public.live_streams         add constraint live_streams_host_fk         foreign key (host_id)     references public.profiles(id)     on delete cascade  not valid;
alter table public.meetings drop constraint if exists meetings_host_fk;
alter table public.meetings             add constraint meetings_host_fk             foreign key (host_id)     references public.profiles(id)     on delete set null not valid;
alter table public.post_comments drop constraint if exists post_comments_user_fk;
alter table public.post_comments        add constraint post_comments_user_fk        foreign key (user_id)     references public.profiles(id)     on delete cascade  not valid;
alter table public.post_reactions drop constraint if exists post_reactions_user_fk;
alter table public.post_reactions       add constraint post_reactions_user_fk       foreign key (user_id)     references public.profiles(id)     on delete cascade  not valid;
alter table public.posts drop constraint if exists posts_author_fk;
alter table public.posts                add constraint posts_author_fk              foreign key (author_id)   references public.profiles(id)     on delete cascade  not valid;
alter table public.stock_movements drop constraint if exists stock_mov_user_fk;
alter table public.stock_movements      add constraint stock_mov_user_fk            foreign key (user_id)     references public.profiles(id)     on delete set null not valid;
alter table public.stock_movements drop constraint if exists stock_mov_item_fk;
alter table public.stock_movements      add constraint stock_mov_item_fk            foreign key (item_id)     references public.inventory(id)    on delete set null not valid;
alter table public.stories drop constraint if exists stories_author_fk;
alter table public.stories              add constraint stories_author_fk            foreign key (author_id)   references public.profiles(id)     on delete cascade  not valid;
alter table public.story_views drop constraint if exists story_views_user_fk;
alter table public.story_views          add constraint story_views_user_fk          foreign key (user_id)     references public.profiles(id)     on delete cascade  not valid;
alter table public.vehicle_logs drop constraint if exists vehicle_logs_vehicle_fk;
alter table public.vehicle_logs         add constraint vehicle_logs_vehicle_fk      foreign key (vehicle_id)  references public.vehicles(id)     on delete cascade  not valid;
alter table public.vehicle_logs drop constraint if exists vehicle_logs_user_fk;
alter table public.vehicle_logs         add constraint vehicle_logs_user_fk         foreign key (user_id)     references public.profiles(id)     on delete set null not valid;



-- ХЭСЭГ 1б — хуучин мөрүүдийг шалгах.
-- ХЭСЭГ 0 дээр бүх тоо 0 гарсан бол л ажиллуулна. Мөр мөрөөр ажиллуулж болно.
alter table public.activity_logs        validate constraint activity_logs_user_fk;
alter table public.ai_detection_logs    validate constraint ai_det_product_fk;
alter table public.ai_detection_logs    validate constraint ai_det_employee_fk;
alter table public.conversation_members validate constraint conv_members_user_fk;
alter table public.inventory_counts     validate constraint inv_counts_employee_fk;
alter table public.inventory_history    validate constraint inv_hist_product_fk;
alter table public.inventory_history    validate constraint inv_hist_employee_fk;
alter table public.live_comments        validate constraint live_comments_user_fk;
alter table public.live_comments        validate constraint live_comments_live_fk;
alter table public.live_invites         validate constraint live_invites_live_fk;
alter table public.live_invites         validate constraint live_invites_host_fk;
alter table public.live_invites         validate constraint live_invites_invitee_fk;
alter table public.live_streams         validate constraint live_streams_host_fk;
alter table public.meetings             validate constraint meetings_host_fk;
alter table public.post_comments        validate constraint post_comments_user_fk;
alter table public.post_reactions       validate constraint post_reactions_user_fk;
alter table public.posts                validate constraint posts_author_fk;
alter table public.stock_movements      validate constraint stock_mov_user_fk;
alter table public.stock_movements      validate constraint stock_mov_item_fk;
alter table public.stories              validate constraint stories_author_fk;
alter table public.story_views          validate constraint story_views_user_fk;
alter table public.vehicle_logs         validate constraint vehicle_logs_vehicle_fk;
alter table public.vehicle_logs         validate constraint vehicle_logs_user_fk;


-- ХЭСЭГ 1в — гүйцэтгэлд шаардлагатай индекс.
-- Postgres нь гадаад түлхүүрийн ТАЛД индекс автоматаар үүсгэдэггүй. Индексгүй
-- бол эцэг мөр устгах бүрд бүтэн хүснэгт уншина.
--
-- ⚠️ Энд `concurrently` АШИГЛААГҮЙ. Supabase SQL Editor нь бүх query-г
--    автоматаар transaction дотор ороодог бол `create index concurrently` нь
--    transaction дотор ажиллах боломжгүй (ERROR 25001). Энгийн `create index`
--    нь хүснэгтийг барих хугацаанд бичилтийг түгжинэ, гэхдээ эдгээр хүснэгтийн
--    хэмжээнд энэ нь хормын зуур тул асуудалгүй.
--
--    Хэрэв хүснэгт маш том болж, түгжих боломжгүй бол SQL Editor-оор биш,
--    psql-ээр холбогдож `concurrently`-тэйгээр ажиллуулна:
--      psql "$DATABASE_URL" -c "create index concurrently ..."
create index if not exists activity_logs_user_idx        on public.activity_logs (user_id);
create index if not exists ai_det_product_idx            on public.ai_detection_logs (product_id);
create index if not exists ai_det_employee_idx           on public.ai_detection_logs (employee_id);
create index if not exists conv_members_user_idx         on public.conversation_members (user_id);
create index if not exists inv_counts_employee_idx       on public.inventory_counts (employee_id);
create index if not exists inv_hist_product_idx          on public.inventory_history (product_id);
create index if not exists inv_hist_employee_idx         on public.inventory_history (employee_id);
create index if not exists live_comments_user_idx        on public.live_comments (user_id);
create index if not exists live_comments_live_idx        on public.live_comments (live_id);
create index if not exists live_invites_live_idx         on public.live_invites (live_id);
create index if not exists live_invites_invitee_idx      on public.live_invites (invitee_id);
create index if not exists live_streams_host_idx         on public.live_streams (host_id);
create index if not exists meetings_host_idx             on public.meetings (host_id);
create index if not exists post_comments_user_idx        on public.post_comments (user_id);
create index if not exists post_reactions_user_idx       on public.post_reactions (user_id);
create index if not exists posts_author_idx              on public.posts (author_id);
create index if not exists stock_mov_item_idx            on public.stock_movements (item_id);
create index if not exists stories_author_idx            on public.stories (author_id);
create index if not exists story_views_user_idx          on public.story_views (user_id);
create index if not exists vehicle_logs_vehicle_idx      on public.vehicle_logs (vehicle_id);
create index if not exists vehicle_logs_user_idx         on public.vehicle_logs (user_id);


-- ============================================================================
-- ХЭСЭГ 2 — ХУУЧИРСАН ХҮСНЭГТИЙГ НЭР СОЛИХ  (устгахгүй, буцаах боломжтой)
-- ============================================================================
-- Кодын 300 файлыг шалгахад дараах 2 хүснэгтэд огт ханддаггүй нь тогтоогдсон:
--
--   ⚠️ face_enrollments-ийг ЭНД БАЙХГҮЙ. Анх "үхмэл" гэж дүгнэсэн боловч
--      Expo Go-д зориулсан үүлэн царай таних (faceCloudService.js) түүнийг
--      ашигладаг болсон тул ҮЛДЭЭВ.
--   work_breaks        →  `employee_break_schedules`-аар солигдсон (shiftService.js:5)
--
-- Шууд устгахын оронд нэрийг нь солино. Хэрэв ямар нэг зүйл эвдэрвэл нэрийг нь
-- буцааж болно. 2-3 долоо хоног ажиглаад асуудалгүй бол ХЭСЭГ 3-ыг ажиллуулна.

alter table if exists public.work_breaks      rename to zz_deprecated_work_breaks;

-- Буцаах бол:
--   alter table public.zz_deprecated_work_breaks      rename to work_breaks;


-- ============================================================================
-- ХЭСЭГ 3 — БҮРМӨСӨН УСТГАХ   ⚠️ БУЦААХ БОЛОМЖГҮЙ
-- ============================================================================
-- ХЭСЭГ 2-оос хойш 2-3 долоо хоног өнгөрч, ямар ч алдаа гараагүй бол л
-- ажиллуулна. Өмнө нь заавал backup авна.
--
--   drop table if exists public.zz_deprecated_work_breaks;


-- ============================================================================
-- ТЭМДЭГЛЭЛ — ЭНЭ ФАЙЛД ЗОРИУДААР ОРУУЛААГҮЙ ЗҮЙЛС
-- ============================================================================
--
-- 1. `authorized_users` — УСТГАХГҮЙ.
--    Апп-ын кодоос шууд ханддаггүй ч Supabase-ийн нэвтрэлтийн hook нь SQL
--    түвшинд уншдаг (migration_gmail_auth.sql:61, :347). Устгавал бүх
--    хэрэглэгч Gmail-ээр нэвтэрч чадахгүй болно.
--
-- 2. Төрөл зөрсөн 4 багана — тусад нь, болгоомжтой хийх ёстой.
--    Эдгээр нь `text` төрөлтэй атлаа `uuid` руу заах ёстой. Хөрвүүлэх шаардлагатай
--    бөгөөд буруу форматтай өгөгдөл байвал алдаа өгнө:
--
--      messages.sender_id        text  →  profiles(id) uuid
--      developer_messages.user_id text →  profiles(id) uuid
--      attendance.staff_id       text  →  staff(id)
--      visit_logs.call_id        text  →  service_calls(id) uuid
--
--    Эхлээд ямар өгөгдөл байгааг хараарай:
--      select sender_id from public.messages
--       where sender_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
--       limit 20;
--    Хэрэв бүгд uuid хэлбэртэй бол:
--      alter table public.messages alter column sender_id type uuid using sender_id::uuid;
--      alter table public.messages add constraint messages_sender_fk
--        foreign key (sender_id) references public.profiles(id) on delete set null not valid;
--
-- 3. Гадаад системийн ID — ГАДААД ТҮЛХҮҮР БИШ, хэвээр үлдээнэ:
--      device_approvals.device_id, push_tokens.device_id  — төхөөрөмжийн хурууны хээ
--      telegram_chat_messages.telegram_message_id         — Telegram-ын өөрийн ID
--      ai_detection_logs.track_id                         — AI мөрдөлтийн ID
