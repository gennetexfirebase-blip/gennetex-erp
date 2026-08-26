-- ============================================================================
-- ИЛГЭЭСЭН МЭДЭГДЛИЙН ТҮҮХ (notification_campaigns)
-- ============================================================================
-- `notifications` хүснэгт нь хүлээн авагч БҮР дээр нэг мөр — админы
-- "Мэдэгдэл илгээх" дэлгэц дээрх "Илгээсэн мэдэгдэл" жагсаалт нэг ЦОХИЛТ
-- (нэг товч дарсан үйлдэл) тутамд НЭГ мөр хардаг тул тусад нь бүртгэнэ.
-- Илгээх процесс өөрчлөгдөхгүй — энэ мөрийг үүсгээд, дараа нь одоо байгаа
-- `sendPushToRole/sendPushToUsers/sendPushToAll` (send-push edge function)
-- функцүүдийг ХЭВЭЭР дуудна.
-- ============================================================================

create table if not exists public.notification_campaigns (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text not null,
  audience_kind text not null check (audience_kind in ('all', 'department', 'users')),
  audience_ids  jsonb not null default '[]'::jsonb,  -- department_id эсвэл user_id жагсаалт
  image_url     text,
  deep_link     text,
  priority      text not null default 'default' check (priority in ('default', 'high')),
  sent_by       uuid references auth.users(id) on delete set null,
  sent_by_name  text,
  recipient_count int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists notification_campaigns_created_idx
  on public.notification_campaigns (created_at desc);

alter table public.notification_campaigns enable row level security;

-- Мэдэгдэл илгээх бол удирдлагын үйлдэл — админаас дээш л харна/бичнэ.
drop policy if exists "notification_campaigns_read" on public.notification_campaigns;
create policy "notification_campaigns_read" on public.notification_campaigns
  for select to authenticated
  using (public.is_admin_user());

drop policy if exists "notification_campaigns_insert" on public.notification_campaigns;
create policy "notification_campaigns_insert" on public.notification_campaigns
  for insert to authenticated
  with check (public.is_admin_user() and sent_by = auth.uid());

grant select, insert on public.notification_campaigns to authenticated;

notify pgrst, 'reload schema';
