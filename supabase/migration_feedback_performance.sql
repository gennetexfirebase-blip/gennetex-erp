-- Санал гомдол + AI гүйцэтгэлийн шинжилгээ

create table if not exists public.employee_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  kind text not null default 'gomdol', -- sanal | gomdol
  subject text,
  body text not null,
  mentioned_employee_ids uuid[] default '{}',
  mentioned_employee_names text[] default '{}',
  status text not null default 'new', -- new | read | resolved
  created_at timestamptz default now()
);

create index if not exists employee_feedback_created_idx
  on public.employee_feedback (created_at desc);

create index if not exists employee_feedback_status_idx
  on public.employee_feedback (status, created_at desc);

create table if not exists public.ai_performance_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null default 'instant', -- instant | monthly
  period_label text,
  period_start timestamptz,
  period_end timestamptz,
  stats jsonb,
  analysis_text text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz default now()
);

create index if not exists ai_perf_reports_type_idx
  on public.ai_performance_reports (report_type, created_at desc);

alter table public.employee_feedback enable row level security;
alter table public.ai_performance_reports enable row level security;

drop policy if exists "employee_feedback_all" on public.employee_feedback;
create policy "employee_feedback_all" on public.employee_feedback
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "ai_performance_reports_all" on public.ai_performance_reports;
create policy "ai_performance_reports_all" on public.ai_performance_reports
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.employee_feedback to anon, authenticated;
grant select, insert, update, delete on public.ai_performance_reports to anon, authenticated;

notify pgrst, 'reload schema';
