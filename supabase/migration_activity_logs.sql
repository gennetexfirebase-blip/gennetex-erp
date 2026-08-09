-- Ажилтны бүх үйлдэл / даралт / байршлын лог (админ «Нийт лог»)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_name text,
  action text not null,
  screen text,
  detail text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz default now()
);

create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_user_idx on public.activity_logs (user_id, created_at desc);
create index if not exists activity_logs_action_idx on public.activity_logs (action, created_at desc);

alter table public.activity_logs enable row level security;
grant select, insert on public.activity_logs to anon, authenticated;

drop policy if exists "activity_logs_all" on public.activity_logs;
create policy "activity_logs_all" on public.activity_logs for all using (true) with check (true);

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.activity_logs'; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
