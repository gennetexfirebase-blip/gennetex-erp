-- ============================================================================
-- Админ хэсгүүдийн 4 шаттай нэвтрэлт (edge function `admin-gate`)
-- ============================================================================
--   1. Утас — verify.mn   2. Google   3. Өөрийн байнгын код   4. Gmail-д ирсэн код
--
--   data-gate-тэй ижил хүснэгтүүдийг `scope`-оор ялгана ('data' | 'admin').
--   Байнгын код (data_passwords) нь хоёуланд нэг — нэг хүн нэг код санана.
--   Админ сесс 12 цаг, .gennetex.com cookie-оор бүх subdomain-д хуваалцагдана.
-- ============================================================================

alter table public.data_gate_attempts add column if not exists scope text not null default 'data';
alter table public.data_sessions add column if not exists scope text not null default 'data';
create index if not exists data_sessions_user_scope_idx on public.data_sessions (user_id, scope);

-- Хуучирсан сесс, оролдлогыг өдөр бүр цэвэрлэнэ.
create or replace function public.gate_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.data_sessions where expires_at < now() - interval '1 day';
  delete from public.data_gate_attempts where expires_at < now() - interval '1 hour';
$$;
revoke all on function public.gate_cleanup() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'gate-cleanup';
    perform cron.schedule('gate-cleanup', '23 19 * * *', 'select public.gate_cleanup()');
  end if;
end $$;
