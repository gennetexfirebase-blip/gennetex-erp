-- ============================================================================
-- Хэрэглэгчийн контентын гомдол ба хэрэглэгч хаах (App Store 1.2)
-- ============================================================================
--   content_reports — пост, сэтгэгдэл, чатын мессеж эсвэл хэрэглэгчийн тухай
--       гомдол. Ирмэгц бүх админд Мэдэгдлийн төвөөр мэдэгдэнэ.
--   user_blocks     — хэрэглэгч өөр хэрэглэгчийг хаана; хаасан хүний пост,
--       сэтгэгдэл, мессеж апп дээр тухайн хэрэглэгчээс нуугдана.
-- ============================================================================

create table if not exists public.content_reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reporter_name     text,
  target_type       text not null check (target_type in ('post', 'comment', 'message', 'user')),
  target_id         text,
  target_user_id    uuid references auth.users(id) on delete set null,
  target_user_name  text,
  reason            text not null check (reason in ('inappropriate', 'harassment', 'spam', 'other')),
  excerpt           text,
  status            text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by       uuid references auth.users(id) on delete set null,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);
alter table public.content_reports enable row level security;

drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
drop policy if exists content_reports_read on public.content_reports;
create policy content_reports_read on public.content_reports
  for select to authenticated using (reporter_id = (select auth.uid()) or public.is_admin_user());
drop policy if exists content_reports_update on public.content_reports;
create policy content_reports_update on public.content_reports
  for update to authenticated using (public.is_admin_user()) with check (public.is_admin_user());

create table if not exists public.user_blocks (
  blocker_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id    uuid not null references auth.users(id) on delete cascade,
  blocked_name  text,
  created_at    timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_own on public.user_blocks;
create policy user_blocks_own on public.user_blocks
  for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));

-- Гомдол ирмэгц админуудын Мэдэгдлийн төвд бичнэ (апп-д харагдана).
create or replace function public.notify_admins_content_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  what text := case new.target_type
    when 'post' then 'пост' when 'comment' then 'сэтгэгдэл'
    when 'message' then 'чатын мессеж' else 'хэрэглэгч' end;
  why text := case new.reason
    when 'inappropriate' then 'Зохисгүй контент' when 'harassment' then 'Доромжлол, дарамт'
    when 'spam' then 'Спам' else 'Бусад' end;
begin
  insert into public.notifications (user_id, title, body, type, data)
  select p.id,
         'Контентын гомдол: ' || what,
         coalesce(new.reporter_name, 'Ажилтан') || ' — ' || why ||
           coalesce(' · ' || new.target_user_name, '') ||
           coalesce(E'\n«' || left(new.excerpt, 140) || '»', ''),
         'system',
         jsonb_build_object('type', 'system', 'reportId', new.id)
  from public.profiles p
  where p.role in ('admin', 'superadmin');
  return new;
end;
$$;

drop trigger if exists content_reports_notify on public.content_reports;
create trigger content_reports_notify
  after insert on public.content_reports
  for each row execute function public.notify_admins_content_report();

notify pgrst, 'reload schema';
