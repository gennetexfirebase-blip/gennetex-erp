-- Чөлөө avah huselt (ажилтны хуваарьтай холбоотой)
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  date_from date not null,
  date_to date not null,
  reason text,
  kind text default 'coloo',
  status text default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_by_name text,
  review_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (date_to >= date_from)
);

create index if not exists leave_requests_user_idx on public.leave_requests (user_id, created_at desc);
create index if not exists leave_requests_status_idx on public.leave_requests (status, date_from);

alter table public.leave_requests enable row level security;

drop policy if exists "leave_requests_all" on public.leave_requests;
create policy "leave_requests_all" on public.leave_requests for all using (true) with check (true);

grant select, insert, update, delete on public.leave_requests to anon, authenticated;
