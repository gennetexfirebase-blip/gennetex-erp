-- ============================================================================
-- HIGH — НЭВТЭРСЭН ХЭРЭГЛЭГЧ ХООРОНДЫН ХУВИЙН МЭДЭЭЛЛИЙГ ТУСГААРЛАХ
-- ============================================================================
--
-- ⚠️ ЭНЭ ФАЙЛЫГ `20260821110000_anon_lockdown.sql`-ЫН ДАРАА АЖИЛЛУУЛНА.
--
-- АСУУДАЛ:
--   anon-ыг хаасны дараа ч дараах зөрчил үлдэнэ: НЭВТЭРСЭН ЭНГИЙН АЖИЛТАН
--   бусад бүх ажилтны хувийн мэдээллийг уншиж чадна. Учир нь бодлогууд нь
--   `using (true)` буюу "нэвтэрсэн бол бүгдийг" гэсэн байдалтай:
--
--     messages       — өөр хоёр хүний ХУВИЙН чатыг бүтнээр нь уншина
--     location_logs  — бусад ажилтны GPS түүхийг бүтнээр нь уншина
--     activity_logs  — хэн хэзээ юу хийснийг бүгдийг харна
--     attendance     — бусдын ирцийн selfie, байршил
--
--   OWASP-ийн нэршлээр энэ бол horizontal privilege escalation (IDOR).
--
-- ЗАСВАРЫН ЗАРЧИМ:
--   "Өөрийнх нь мөр" + "админ" гэсэн хоёр л тохиолдолд нээнэ. Чатыг
--   зөвхөн тухайн ярианы ГИШҮҮН уншина.
--
-- ⚠️ ЭНЭ НЬ АППЫН ЗАН ТӨЛӨВИЙГ ӨӨРЧИЛНӨ. Ажиллуулсны дараа ЗААВАЛ шалгах:
--     1. Хоёр ажилтан хоорондоо чат бичих → мессеж харагдаж байна уу
--     2. Бүлэг чат нээх → түүх харагдаж байна уу
--     3. Ажилтан өөрийн ирцийн түүхээ харах
--     4. Админ вэб → Байршил, Ирц, Нийт лог хэсэг ажиллаж байна уу
--   Хэрэв чат хоосорвол доорх `messages_read` бодлогыг буцаана:
--     drop policy "messages_read" on public.messages;
--     create policy "messages_read" on public.messages
--       for select to authenticated using (true);
--
-- ЗАГВАР:
--   `messages.room` нь `conversations.id`-ийн текст хэлбэр (chatService.js:181
--   дээр `m.room === c.id` гэж тулгадаг). Тиймээс гишүүнчлэлийг
--   `conversation_members`-аас шалгана.
--
-- ⚠️ ТӨРЛИЙН CAST (2026-08-27-нд зассан):
--   `messages.sender_id` ба `attendance.staff_id` нь `text` төрөлтэй, харин
--   `auth.uid()` нь `uuid`. PostgreSQL-д `text = uuid` ОПЕРАТОР БАЙХГҮЙ тул
--   энэ файл өмнө нь
--       ERROR: operator does not exist: text = uuid (SQLSTATE 42883)
--   гэж унаж, ХЭЗЭЭ Ч БҮРЭН АЖИЛЛААГҮЙ. Үүнээс болж ирц/чатын RLS хүчин
--   төгөлдөр болоогүй үлдсэн. Тиймээс тэдгээрийг `auth.uid()::text` болгов.
--   Бусад хүснэгтийн `user_id` нь аль хэдийн `uuid` тул cast хэрэггүй.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Туслах: одоогийн хэрэглэгч тухайн ярианы гишүүн үү?
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER — бодлого дотроос `conversation_members`-ийг уншихад
-- дахин RLS шалгагдаж рекурс үүсэхээс сэргийлнэ.
create or replace function public.is_conversation_member(p_room text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.conversation_members m
     where m.user_id = auth.uid()
       and m.conversation_id::text = p_room
  );
$$;

revoke execute on function public.is_conversation_member(text) from public, anon;
grant  execute on function public.is_conversation_member(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. ЧАТ — зөвхөн тухайн ярианы гишүүн
-- ---------------------------------------------------------------------------
-- Хуучин `messages_all`/`for all using(true)` бодлогуудыг үйлдлээр нь
-- салгаж, уншихыг нь хатууруулна.
drop policy if exists "messages_all"    on public.messages;
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_read"   on public.messages;
create policy "messages_read" on public.messages
  for select to authenticated
  using (
    sender_id = auth.uid()::text
    or public.is_conversation_member(room)
  );

-- Бичихдээ ӨӨРИЙН нэрээр л бичнэ (өөр хүн болж дүр эсгэхээс сэргийлнэ)
-- бөгөөд зөвхөн гишүүн байгаа яриандаа.
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()::text
    and (public.is_conversation_member(room) or room = 'general')
  );

-- Засах/устгах — зөвхөн өөрийн мессеж.
drop policy if exists "messages_update" on public.messages;
create policy "messages_update" on public.messages
  for update to authenticated
  using (sender_id = auth.uid()::text)
  with check (sender_id = auth.uid()::text);

drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages
  for delete to authenticated
  using (sender_id = auth.uid()::text or public.is_admin_user());

-- Ярианы жагсаалт — зөвхөн өөрийн орсон яриа.
drop policy if exists "conversations_all"  on public.conversations;
drop policy if exists "conversations_read" on public.conversations;
create policy "conversations_read" on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id::text) or public.is_admin_user());

drop policy if exists "conversations_write" on public.conversations;
create policy "conversations_write" on public.conversations
  for all to authenticated
  using (true) with check (true);

-- Гишүүдийн жагсаалт — өөрийн орсон ярианых.
drop policy if exists "conversation_members_all"  on public.conversation_members;
drop policy if exists "conversation_members_read" on public.conversation_members;
create policy "conversation_members_read" on public.conversation_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_conversation_member(conversation_id::text)
    or public.is_admin_user()
  );

drop policy if exists "conversation_members_write" on public.conversation_members;
create policy "conversation_members_write" on public.conversation_members
  for all to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 2. БАЙРШЛЫН ТҮҮХ — зөвхөн админ (апп нь энэ хүснэгтээс УНШДАГГҮЙ)
-- ---------------------------------------------------------------------------
-- `src/services/trackingService.js` нь зөвхөн INSERT хийдэг; уншдаг код
-- апп болон админ вэб хоёуланд нь алга. Тиймээс SELECT-ийг хаах нь
-- ямар ч функцийг эвдэхгүй.
drop policy if exists "location_logs_all"    on public.location_logs;
drop policy if exists "location_logs_select" on public.location_logs;
drop policy if exists "location_logs_read"   on public.location_logs;
create policy "location_logs_read" on public.location_logs
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user());

drop policy if exists "location_logs_insert" on public.location_logs;
create policy "location_logs_insert" on public.location_logs
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. ҮЙЛДЛИЙН ЛОГ — өөрийнх + админ
-- ---------------------------------------------------------------------------
drop policy if exists "activity_logs_all"  on public.activity_logs;
drop policy if exists "activity_logs_read" on public.activity_logs;
create policy "activity_logs_read" on public.activity_logs
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user());

drop policy if exists "activity_logs_insert" on public.activity_logs;
create policy "activity_logs_insert" on public.activity_logs
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. ИРЦ — өөрийнх + админ
-- ---------------------------------------------------------------------------
-- Ажилтан аппаас зөвхөн ӨӨРИЙН ирцийн түүхийг хардаг, админ вэб бүгдийг.
drop policy if exists "attendance_all"    on public.attendance;
drop policy if exists "attendance_select" on public.attendance;
drop policy if exists "attendance_read"   on public.attendance;
create policy "attendance_read" on public.attendance
  for select to authenticated
  using (staff_id = auth.uid()::text or public.is_admin_user());

drop policy if exists "attendance_insert" on public.attendance;
create policy "attendance_insert" on public.attendance
  for insert to authenticated
  with check (staff_id = auth.uid()::text or public.is_admin_user());

-- Ирц зөвшөөрөх/татгалзах нь зөвхөн админы ажил.
drop policy if exists "attendance_update" on public.attendance;
create policy "attendance_update" on public.attendance
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

notify pgrst, 'reload schema';
