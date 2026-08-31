-- ══════════════════════════════════════════════════════════════════
-- RLS-ийн хэвтээ эрх алдагдлыг хаах
--
-- АСУУДАЛ:
--   2026-08-31-ний аудитаар 139 журмаас ~40 нь `using (true)` буюу
--   ямар ч шалгалтгүй байсан. RESTRICTIVE журам нэг ч байгаагүй тул
--   (permissive журмууд `OR`-оор нэгддэг) эдгээр нь цорын ганц хаалт
--   байв.
--
--   Үр дүнд нь нэвтэрсэн ДУРЫН ажилтан бусдын хувийн чат, тайлан,
--   чөлөөний хүсэлт, ээлж, хөгжүүлэгчийн мессежийг уншиж, бүр
--   ӨӨРЧИЛЖ, УСТГАЖ чаддаг байсан. `conversation_members` дээр `ALL`
--   эрхтэй байсан тул өөрийгөө дурын хувийн ярианд нэмж оруулах
--   боломжтой байв.
--
-- ЗАРЧИМ:
--   A зэрэг — ХУВИЙН: зөвхөн эзэмшигч эсвэл админ УНШИНА.
--   B зэрэг — ХАМТЫН: бүх ажилтан уншина, зөвхөн эзэмшигч/админ БИЧНЭ.
--   C зэрэг — ХАЯГДСАН: зөвхөн админ.
--
--   Дотоод ERP тул "бүх ажилтан уншина" нь олон хүснэгтэд ЗӨВ —
--   агуулах, тээвэр, мэдээллийн урсгал нь хамтын. Хувийн харилцаа,
--   гүйцэтгэлийн тайлан, чөлөөний хүсэлт нь тийм БИШ.
--
-- ⚠️ `null = uuid` нь false биш NULL буцаадаг тул эзэмшигчгүй мөр
--    админаас өөр хүнд харагдахгүй болно. Шилжүүлэхийн өмнө шалгахад
--    NULL эзэмшигчтэй мөр НЭГ Ч БАЙГААГҮЙ тул алдагдах өгөгдөл алга.
-- ══════════════════════════════════════════════════════════════════

-- ── Ярианы гишүүнчлэл шалгах туслах ──────────────────────────────
-- ⚠️ ЗААВАЛ `security definer` байх ёстой. `conversation_members`-ийн
--    журам дотроос мөн түүнийг уншвал RLS нь өөрийгөө дуудаж
--    ХЯЗГААРГҮЙ РЕКУРС үүсгэнэ. `security definer` нь RLS-ийг
--    тойрдог тул рекурс таслагдана.
create or replace function public.is_conversation_member(p_conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = p_conv
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;


-- ══ A ЗЭРЭГ · ХУВИЙН ══════════════════════════════════════════════

-- ── Яриа ба гишүүнчлэл ───────────────────────────────────────────
drop policy if exists conversations_write on public.conversations;
create policy conversations_read on public.conversations
  for select to authenticated
  using (
    public.is_conversation_member(id)
    or created_by = (select auth.uid())
    or public.is_admin_user()
  );
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (created_by = (select auth.uid()) or public.is_admin_user());
create policy conversations_update on public.conversations
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_admin_user());
create policy conversations_delete on public.conversations
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_admin_user());

drop policy if exists conversation_members_write on public.conversation_members;
create policy conversation_members_read on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id) or public.is_admin_user());
-- Гишүүн нэмэх нь тухайн яриандаа аль хэдийн байгаа хүн, эсвэл
-- ярианы үүсгэгч л хийнэ. Өөрийгөө хэн нэгний ярианд нэмэх зам хаагдав.
create policy conversation_members_insert on public.conversation_members
  for insert to authenticated
  with check (
    public.is_conversation_member(conversation_id)
    or public.is_admin_user()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = (select auth.uid())
    )
  );
create policy conversation_members_delete on public.conversation_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists telegram_chat_messages_all on public.telegram_chat_messages;
create policy telegram_chat_messages_read on public.telegram_chat_messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or public.is_admin_user());
create policy telegram_chat_messages_insert on public.telegram_chat_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) or public.is_admin_user());

-- ── Хөгжүүлэгчийн мессеж ─────────────────────────────────────────
-- ⚠️ Энэ хүснэгтийн `user_id` нь uuid БИШ, TEXT. Шууд харьцуулбал
--    "operator does not exist: text = uuid" гэж унана.
drop policy if exists developer_messages_all on public.developer_messages;
create policy developer_messages_read on public.developer_messages
  for select to authenticated
  using (user_id = (select auth.uid())::text or public.is_admin_user());
create policy developer_messages_insert on public.developer_messages
  for insert to authenticated
  with check (user_id = (select auth.uid())::text or public.is_admin_user());
create policy developer_messages_update on public.developer_messages
  for update to authenticated
  using (public.is_admin_user());

-- ── Гүйцэтгэл, санал хүсэлт, чөлөө ───────────────────────────────
drop policy if exists employee_reports_all on public.employee_reports;
create policy employee_reports_read on public.employee_reports
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
create policy employee_reports_write on public.employee_reports
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user())
  with check (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists employee_feedback_all on public.employee_feedback;
create policy employee_feedback_read on public.employee_feedback
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
create policy employee_feedback_write on public.employee_feedback
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user())
  with check (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists leave_requests_all on public.leave_requests;
create policy leave_requests_read on public.leave_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
create policy leave_requests_insert on public.leave_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_admin_user());
-- Шийдвэрлэх нь зөвхөн админ — ажилтан өөрийн хүсэлтээ баталж болохгүй.
create policy leave_requests_update on public.leave_requests
  for update to authenticated
  using (public.is_admin_user());
create policy leave_requests_delete on public.leave_requests
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());

-- ── Царай таних лог, зочлолт, тооллого ───────────────────────────
drop policy if exists ai_detection_logs_all on public.ai_detection_logs;
create policy ai_detection_logs_read on public.ai_detection_logs
  for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin_user());
create policy ai_detection_logs_insert on public.ai_detection_logs
  for insert to authenticated
  with check (employee_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists visit_logs_all on public.visit_logs;
create policy visit_logs_read on public.visit_logs
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
create policy visit_logs_write on public.visit_logs
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user())
  with check (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists inventory_counts_all on public.inventory_counts;
create policy inventory_counts_read on public.inventory_counts
  for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin_user());
create policy inventory_counts_write on public.inventory_counts
  for all to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin_user())
  with check (employee_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists story_views_all on public.story_views;
create policy story_views_read on public.story_views
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user()
    -- Түүхийн эзэн нь хэн үзсэнийг харна.
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid())
    )
  );
create policy story_views_insert on public.story_views
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists ohaab_daily_ack_all on public.ohaab_daily_ack;
create policy ohaab_daily_ack_read on public.ohaab_daily_ack
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
create policy ohaab_daily_ack_write on public.ohaab_daily_ack
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user())
  with check (user_id = (select auth.uid()) or public.is_admin_user());

-- ── Ээлж ба завсарлага ───────────────────────────────────────────
-- Ажилтан өөрийн ээлжээ УНШИНА; онооход зөвхөн админ.
drop policy if exists employee_shifts_select on public.employee_shifts;
drop policy if exists employee_shifts_insert on public.employee_shifts;
drop policy if exists employee_shifts_update on public.employee_shifts;
drop policy if exists employee_shifts_delete on public.employee_shifts;
create policy employee_shifts_read on public.employee_shifts
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
create policy employee_shifts_write on public.employee_shifts
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists work_breaks_select on public.work_breaks;
drop policy if exists work_breaks_insert on public.work_breaks;
drop policy if exists work_breaks_update on public.work_breaks;
drop policy if exists work_breaks_delete on public.work_breaks;
create policy work_breaks_read on public.work_breaks
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
create policy work_breaks_write on public.work_breaks
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());


-- ══ B ЗЭРЭГ · ХАМТЫН (бүгд уншина · эзэмшигч/админ бичнэ) ═════════

-- ── Мэдээллийн урсгал ────────────────────────────────────────────
drop policy if exists posts_all on public.posts;
create policy posts_read on public.posts
  for select to authenticated using (true);
create policy posts_write on public.posts
  for all to authenticated
  using (author_id = (select auth.uid()) or public.is_admin_user())
  with check (author_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists post_comments_all on public.post_comments;
create policy post_comments_read on public.post_comments
  for select to authenticated using (true);
create policy post_comments_write on public.post_comments
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user())
  with check (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists post_reactions_all on public.post_reactions;
create policy post_reactions_read on public.post_reactions
  for select to authenticated using (true);
create policy post_reactions_write on public.post_reactions
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user())
  with check (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists stories_all on public.stories;
create policy stories_read on public.stories
  for select to authenticated using (true);
create policy stories_write on public.stories
  for all to authenticated
  using (author_id = (select auth.uid()) or public.is_admin_user())
  with check (author_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists live_comments_all on public.live_comments;
create policy live_comments_read on public.live_comments
  for select to authenticated using (true);
create policy live_comments_write on public.live_comments
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user())
  with check (user_id = (select auth.uid()) or public.is_admin_user());

-- ── Тээвэр ───────────────────────────────────────────────────────
drop policy if exists trips_all on public.trips;
create policy trips_read on public.trips
  for select to authenticated using (true);
create policy trips_write on public.trips
  for all to authenticated
  using (driver_id = (select auth.uid()) or public.is_admin_user())
  with check (driver_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists vehicles_all on public.vehicles;
create policy vehicles_read on public.vehicles
  for select to authenticated using (true);
create policy vehicles_write on public.vehicles
  for all to authenticated
  using (driver_id = (select auth.uid()) or public.is_admin_user())
  with check (driver_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists vehicle_logs_all on public.vehicle_logs;
create policy vehicle_logs_read on public.vehicle_logs
  for select to authenticated using (true);
create policy vehicle_logs_write on public.vehicle_logs
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user())
  with check (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists field_site_sessions_all on public.field_site_sessions;
create policy field_site_sessions_read on public.field_site_sessions
  for select to authenticated using (true);
create policy field_site_sessions_write on public.field_site_sessions
  for all to authenticated
  using (driver_id = (select auth.uid()) or public.is_admin_user())
  with check (driver_id = (select auth.uid()) or public.is_admin_user());

-- ── Агуулах ──────────────────────────────────────────────────────
drop policy if exists products_all on public.products;
create policy products_read on public.products
  for select to authenticated using (true);
create policy products_insert on public.products
  for insert to authenticated with check (true);
create policy products_update on public.products
  for update to authenticated using (true);
-- Устгах нь эргэлт буцалтгүй тул зөвхөн админ.
create policy products_delete on public.products
  for delete to authenticated using (public.is_admin_user());

drop policy if exists product_images_all on public.product_images;
create policy product_images_read on public.product_images
  for select to authenticated using (true);
create policy product_images_write on public.product_images
  for all to authenticated using (true) with check (true);

drop policy if exists stock_movements_all on public.stock_movements;
create policy stock_movements_read on public.stock_movements
  for select to authenticated using (true);
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_admin_user());
-- Хөдөлгөөний түүх нь бүртгэл — өөрчилж, устгаж болохгүй.
create policy stock_movements_admin on public.stock_movements
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ── Тайлан, архив, дуудлага ──────────────────────────────────────
drop policy if exists service_calls_all on public.service_calls;
create policy service_calls_read on public.service_calls
  for select to authenticated using (true);
create policy service_calls_write on public.service_calls
  for all to authenticated
  using (created_by = (select auth.uid()) or public.is_admin_user())
  with check (created_by = (select auth.uid()) or public.is_admin_user());

drop policy if exists ai_performance_reports_all on public.ai_performance_reports;
create policy ai_performance_reports_read on public.ai_performance_reports
  for select to authenticated
  using (created_by = (select auth.uid()) or public.is_admin_user());
create policy ai_performance_reports_write on public.ai_performance_reports
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ── Уулзалт, шууд дамжуулалт ─────────────────────────────────────
drop policy if exists meetings_all on public.meetings;
create policy meetings_read on public.meetings
  for select to authenticated using (true);
create policy meetings_write on public.meetings
  for all to authenticated using (true) with check (true);

drop policy if exists call_sessions_all on public.call_sessions;
create policy call_sessions_rw on public.call_sessions
  for all to authenticated using (true) with check (true);

drop policy if exists live_streams_all on public.live_streams;
create policy live_streams_read on public.live_streams
  for select to authenticated using (true);
create policy live_streams_write on public.live_streams
  for all to authenticated using (true) with check (true);

drop policy if exists live_invites_all on public.live_invites;
create policy live_invites_rw on public.live_invites
  for all to authenticated using (true) with check (true);

-- ── Тохиргоо · зөвхөн админ бичнэ ────────────────────────────────
drop policy if exists fuel_settings_write on public.fuel_settings;
create policy fuel_settings_write on public.fuel_settings
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists ohaab_instruction_all on public.ohaab_instruction;
create policy ohaab_instruction_read on public.ohaab_instruction
  for select to authenticated using (true);
create policy ohaab_instruction_write on public.ohaab_instruction
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());


-- ══ C ЗЭРЭГ · ХАЯГДСАН ════════════════════════════════════════════
-- `zz_deprecated_*` нь аль хэдийн ашиглагдахаа больсон ч журам нь
-- нээлттэй хэвээр байв. Хойшлуулалгүй хаана.
drop policy if exists inventory_history_all on public.zz_deprecated_inventory_history;
create policy zz_inventory_history_admin on public.zz_deprecated_inventory_history
  for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists live_streams_all on public.zz_deprecated_live_streams;
create policy zz_live_streams_admin on public.zz_deprecated_live_streams
  for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists staff_all on public.zz_deprecated_staff;
create policy zz_staff_admin on public.zz_deprecated_staff
  for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());


-- ⚠️ PostgREST нь схемийн кэштэй тул мэдэгдэхгүй бол шинэ функц
--    "not found" гэж буцаана.
notify pgrst, 'reload schema';
