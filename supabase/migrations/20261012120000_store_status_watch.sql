-- App Store-ын төлөв өөрчлөгдөхөд Telegram мэдэгдэл (store-status-notify edge function).
-- Сүүлд мэдэгдсэн төлөвийг хадгална — зөвхөн өөрчлөлтийг илгээнэ.

create table if not exists public.store_status_watch (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.store_status_watch enable row level security;
revoke all on public.store_status_watch from public, anon, authenticated;

create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'store-status-notify';
    perform cron.schedule(
      'store-status-notify',
      '*/15 * * * *',
      $cmd$select net.http_post(
        url := 'https://zkftykocmqzrgdhgwluu.supabase.co/functions/v1/store-status-notify',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-watch-secret', 'f3f0930ecf62255da786b37083b01e71f48aa349'),
        body := '{}'::jsonb
      )$cmd$
    );
  end if;
end
$$;