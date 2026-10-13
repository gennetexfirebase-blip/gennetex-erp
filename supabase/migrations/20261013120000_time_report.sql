-- ============================================================================
-- Ð¦Ð°Ð³Ð¸Ð¹Ð½ Ñ‚Ð°Ð¹Ð»Ð°Ð½ (tailan.gennetex.com)
-- ============================================================================
--
--   time_report_data(from, to, key)  â€” Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð°Ð½Ñ‹ Ð¸Ñ€Ñ†Ð¸Ð¹Ð½ Ñ‚Ò¯Ò¯Ñ…Ð¸Ð¹ Ó©Ð³Ó©Ð³Ð´Ó©Ð» (JSON).
--       ÐÐ´Ð¼Ð¸Ð½ (is_admin_user, Ñ…ÑÐ»Ñ‚ÑÐ¸Ð¹Ð½ Ñ…Ò¯Ñ€ÑÑÐ³ÑÑÑ€) ÑÑÐ²ÑÐ» Ñ…Ò¯Ñ‡Ð¸Ð½Ñ‚ÑÐ¹ Ò¯Ð·ÑÑ…
--       Ñ‚Ò¯Ð»Ñ…Ò¯Ò¯Ñ€Ñ‚ÑÐ¹ Ñ…ÑÐ½ Ñ‡ Ð´ÑƒÑƒÐ´Ð½Ð°. Ð¢Ó©Ð»Ó©Ð² (Ñ†Ð°Ð³Ñ‚Ð°Ð°/Ñ…Ð¾Ñ†Ð¾Ñ€ÑÐ¾Ð½/Ñ‚Ð°ÑÐ°Ð»ÑÐ°Ð½)-Ð¸Ð¹Ð³ ÐºÐ»Ð¸ÐµÐ½Ñ‚
--       Ñ‚Ð°Ð» company_settings-Ð¸Ð¹Ð½ Ð´Ò¯Ñ€Ð¼ÑÑÑ€ Ñ‚Ð¾Ð¾Ñ†Ð½Ð¾ â€” compute_attendance_status-Ñ‚Ð°Ð¹ Ð¸Ð¶Ð¸Ð».
--
--   report_access_keys â€” Ð°Ð¿Ð¿-Ñ‹Ð½ Ð¾Ð´Ð¾Ð¾Ð³Ð¸Ð¹Ð½ Ñ…ÑƒÐ²Ð¸Ð»Ð±Ð°Ñ€ Ð²ÑÐ± Ñ‚Ð°Ð¹Ð»Ð°Ð½Ð³ ÑˆÐ¸Ð½ÑÑ‡Ð»ÑÐ»Ð³Ò¯Ð¹Ð³ÑÑÑ€
--       Ð½ÑÑÑ…ÑÐ´: Ð°Ð´Ð¼Ð¸Ð½Ñ‹ Â«Ð¢Ð°Ð¹Ð»Ð°Ð½Â» Ð¶Ð°Ð³ÑÐ°Ð°Ð»Ñ‚Ð°Ð´ (employee_reports, Ð·Ó©Ð²Ñ…Ó©Ð½ Ð°Ð´Ð¼Ð¸Ð½
--       ÑƒÐ½ÑˆÐ´Ð°Ð³) Ñ‚Ò¯Ð»Ñ…Ò¯Ò¯Ñ€Ñ‚ÑÐ¹ Ñ…Ð¾Ð»Ð±Ð¾Ð¾Ñ Ð±Ò¯Ñ…Ð¸Ð¹ Ð¼Ó©Ñ€ Ð½ÑÐ¼Ð½Ñ. ÐÐ¿Ð¿ Ñ‚ÑÑ€ Ð¼Ó©Ñ€Ð¸Ð¹Ð³ Ð´Ð°Ñ€Ð°Ñ…Ð°Ð´
--       pdf_url-Ð¸Ð¹Ð³ Ð°Ð¿Ð¿ Ð´Ð¾Ñ‚Ð¾Ñ€ WebView-ÑÑÑ€ Ð½ÑÑÐ´ÑÐ³ (Google Ð½ÑÐ²Ñ‚Ñ€ÑÐ»Ñ‚ WebView-Ð´
--       Ð°Ð¶Ð¸Ð»Ð»Ð°Ñ…Ð³Ò¯Ð¹ Ñ‚ÑƒÐ» Ñ‚Ò¯Ð»Ñ…Ò¯Ò¯Ñ€ÑÑÑ€). Ð¢Ò¯Ð»Ñ…Ò¯Ò¯Ñ€Ð¸Ð¹Ð½ Ð·Ó©Ð²Ñ…Ó©Ð½ hash Ñ…Ð°Ð´Ð³Ð°Ð»Ð°Ð³Ð´Ð°Ð½Ð°.
--
--   attendance_warnings â€” Ð°Ð¶Ð¸Ð»Ñ‚Ð°Ð½Ð´ Ð¸Ð»Ð³ÑÑÑÑÐ½ Ð¸Ñ€Ñ†Ð¸Ð¹Ð½ ÑÐ°Ð½ÑƒÑƒÐ»Ð³Ð°. ÐÐ¶Ð¸Ð»Ñ‚Ð°Ð½
--       tailan.gennetex.com/w/<token> Ñ…ÑƒÑƒÐ´ÑÐ°Ð°Ñ€ (Ð½ÑÐ²Ñ‚Ñ€ÑÐ»Ñ‚Ð³Ò¯Ð¹) Ó©Ó©Ñ€Ð¸Ð¹Ð½ Ð¸Ñ€Ñ†Ð¸Ð¹Ð³ Ñ…Ð°Ñ€Ð½Ð°.
-- ============================================================================

create table if not exists public.report_access_keys (
  id          uuid primary key default gen_random_uuid(),
  key_hash    text not null unique,
  label       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  revoked_at  timestamptz
);
alter table public.report_access_keys enable row level security;
-- Ð‘Ð¾Ð´Ð»Ð¾Ð³Ð¾ Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹: Ð·Ó©Ð²Ñ…Ó©Ð½ security definer Ñ„ÑƒÐ½ÐºÑ†Ò¯Ò¯Ð´ Ñ…Ð°Ð½Ð´Ð°Ð½Ð°.

create or replace function public.time_report_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(length(p_key) between 24 and 128, false) and exists (
    select 1 from public.report_access_keys k
    where k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
      and k.revoked_at is null
      and (k.expires_at is null or k.expires_at > now())
  );
$$;
revoke all on function public.time_report_key_ok(text) from public, anon, authenticated;

create or replace function public.time_report_data(p_from date, p_to date, p_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  by_key boolean := public.time_report_key_ok(p_key);
  result jsonb;
begin
  if not by_key and not public.is_admin_user() then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_from > p_to then raise exception 'invalid_range'; end if;
  if p_to - p_from > 400 then raise exception 'range_too_long'; end if;

  with emp as (
    select p.id, p.name, p.last_name, p.email, p.position, p.role, p.avatar_url, p.department_id, d.name as department
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where by_key or public.dept_in_scope(p.department_id)
  ),
  att as (
    select a.staff_id as uid,
           (a.created_at at time zone 'Asia/Ulaanbaatar')::date as d,
           min(a.created_at) filter (where a.type = 'check_in')  as cin,
           max(a.created_at) filter (where a.type = 'check_out') as cout,
           bool_or(a.is_remote) as remote,
           bool_or(a.status = 'pending') as pending
    from public.attendance a
    where a.status <> 'rejected'
      and a.created_at >= (p_from::timestamp at time zone 'Asia/Ulaanbaatar')
      and a.created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Ulaanbaatar')
    group by 1, 2
  )
  select jsonb_build_object(
    'settings', (select jsonb_build_object('work_start', to_char(coalesce(c.work_start_time, '09:00'::time), 'HH24:MI'),
                                           'grace', coalesce(c.late_grace_minutes, 0))
                 from public.company_settings c where c.singleton = true),
    'employees', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'last_name', e.last_name, 'email', e.email, 'position', e.position,
        'role', e.role, 'avatar_url', e.avatar_url, 'department_id', e.department_id, 'department', e.department)
        order by e.name) from emp e), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object(
        'e', a.uid, 'd', a.d, 'in', a.cin, 'out', a.cout, 'remote', a.remote, 'pending', a.pending))
        from att a where exists (select 1 from emp e where e.id::text = a.uid)), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg(jsonb_build_object('e', s.user_id, 'd', s.shift_date, 'start', s.start_time, 'end', s.end_time))
        from public.employee_shifts s
        where s.shift_date between p_from and p_to and exists (select 1 from emp e where e.id = s.user_id)), '[]'::jsonb),
    'leaves', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('e', l.user_id, 'from', l.date_from, 'to', l.date_to, 'kind', l.kind) x
        from public.leave_requests l
        where l.status = 'approved' and l.date_from <= p_to and l.date_to >= p_from
          and exists (select 1 from emp e where e.id = l.user_id)
        union all
        -- Ð¢Ð¾Ð¼Ð¸Ð»Ð¾Ð»Ñ‚, Ð·Ð°Ð¹Ð½Ð°Ð°Ñ Ð°Ð¶Ð¸Ð»Ð»Ð°ÑÐ°Ð½ Ó©Ð´Ñ€Ð¸Ð¹Ð³ Ð·Ó©Ð²ÑˆÓ©Ó©Ñ€Ó©Ð»Ñ‚ÑÐ¹ Ó©Ð´Ó©Ñ€Ñ‚ Ñ‚Ð¾Ð¾Ñ†Ð½Ð¾.
        select jsonb_build_object('e', r.employee_id, 'from', r.requested_date, 'to', r.requested_date, 'kind', r.type)
        from public.attendance_requests r
        where r.status = 'approved' and r.type in ('business_trip', 'remote_work', 'telecommute')
          and r.requested_date between p_from and p_to
          and exists (select 1 from emp e where e.id = r.employee_id)
      ) q), '[]'::jsonb),
    'rest_days', coalesce((select jsonb_agg(jsonb_build_object('e', b.user_id, 'dow', b.day_of_week))
        from public.employee_break_schedules b where exists (select 1 from emp e where e.id = b.user_id)), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.time_report_data(date, date, text) from public;
grant execute on function public.time_report_data(date, date, text) to anon, authenticated;

-- â”€â”€ Ð¡Ð°Ð½ÑƒÑƒÐ»Ð³Ð° â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists public.attendance_warnings (
  id               uuid primary key default gen_random_uuid(),
  token            text not null unique
                     default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  employee_id      uuid not null references public.profiles(id) on delete cascade,
  employee_name    text,
  employee_email   text,
  period_from      date not null,
  period_to        date not null,
  title            text not null,
  message          text not null,
  stats            jsonb not null default '{}'::jsonb,
  created_by       uuid references auth.users(id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  emailed_at       timestamptz,
  pushed_at        timestamptz,
  viewed_at        timestamptz
);
create index if not exists attendance_warnings_employee_idx on public.attendance_warnings (employee_id, created_at desc);
alter table public.attendance_warnings enable row level security;

drop policy if exists attendance_warnings_read on public.attendance_warnings;
create policy attendance_warnings_read on public.attendance_warnings
  for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin_user());

create or replace function public.create_attendance_warnings(p_items jsonb, p_key text default null)
returns setof public.attendance_warnings
language plpgsql
security definer
set search_path = ''
as $$
declare
  by_key boolean := public.time_report_key_ok(p_key);
  me uuid := auth.uid();
  my_name text;
  it jsonb;
  emp public.profiles%rowtype;
  rec public.attendance_warnings%rowtype;
begin
  if not by_key and not public.is_admin_user() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'invalid_items';
  end if;
  select coalesce(p.name, p.email) into my_name from public.profiles p where p.id = me;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into emp from public.profiles p where p.id = (it->>'employee_id')::uuid;
    if emp.id is null then raise exception 'employee_not_found'; end if;
    if not by_key and not public.dept_in_scope(emp.department_id) then raise exception 'forbidden'; end if;
    insert into public.attendance_warnings
      (employee_id, employee_name, employee_email, period_from, period_to, title, message, stats, created_by, created_by_name)
    values (
      emp.id, trim(coalesce(emp.last_name, '') || ' ' || coalesce(emp.name, '')), emp.email,
      (it->>'period_from')::date, (it->>'period_to')::date,
      left(coalesce(nullif(trim(it->>'title'), ''), 'Ð˜Ñ€Ñ†Ð¸Ð¹Ð½ ÑÐ°Ð½ÑƒÑƒÐ»Ð³Ð°'), 160),
      left(coalesce(nullif(trim(it->>'message'), ''), 'Ð¢Ð°Ð½Ñ‹ Ð¸Ñ€Ñ†ÑÐ´ Ð°Ð½Ñ…Ð°Ð°Ñ€Ð°Ñ… Ð·Ò¯Ð¹Ð» Ð±Ð°Ð¹Ð½Ð°.'), 2000),
      coalesce(it->'stats', '{}'::jsonb),
      me, coalesce(my_name, case when by_key then 'ÐÐ´Ð¼Ð¸Ð½ (Ð°Ð¿Ð¿)' end)
    ) returning * into rec;
    return next rec;
  end loop;
end;
$$;
revoke all on function public.create_attendance_warnings(jsonb, text) from public;
grant execute on function public.create_attendance_warnings(jsonb, text) to anon, authenticated;

-- Ð¡Ð°Ð½ÑƒÑƒÐ»Ð³Ñ‹Ð½ Ñ…ÑƒÑƒÐ´Ð°Ñ: Ñ‚Ð¾ÐºÐµÐ½ ÑÐ·ÑÐ¼ÑˆÐ¸Ð³Ñ‡ Ñ‚ÑƒÑ…Ð°Ð¹Ð½ Ð°Ð¶Ð¸Ð»Ñ‚Ð½Ñ‹ Ð¢Ð£Ð¥ÐÐ™Ð Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð°Ð½Ñ‹ Ð¸Ñ€Ñ†Ð¸Ð¹Ð³ Ð» Ñ…Ð°Ñ€Ð½Ð°.
create or replace function public.get_attendance_warning(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.attendance_warnings%rowtype;
  data jsonb;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select * into w from public.attendance_warnings where token = p_token;
  if w.id is null then return null; end if;
  update public.attendance_warnings set viewed_at = coalesce(viewed_at, now()) where id = w.id;

  select jsonb_build_object(
    'settings', (select jsonb_build_object('work_start', to_char(coalesce(c.work_start_time, '09:00'::time), 'HH24:MI'),
                                           'grace', coalesce(c.late_grace_minutes, 0))
                 from public.company_settings c where c.singleton = true),
    'employee', (select jsonb_build_object('id', p.id, 'name', p.name, 'last_name', p.last_name, 'position', p.position,
                                           'avatar_url', p.avatar_url, 'department', d.name)
                 from public.profiles p left join public.departments d on d.id = p.department_id where p.id = w.employee_id),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object('e', w.employee_id, 'd', x.d, 'in', x.cin, 'out', x.cout,
                                                                'remote', x.remote, 'pending', x.pending))
        from (select (a.created_at at time zone 'Asia/Ulaanbaatar')::date d,
                     min(a.created_at) filter (where a.type = 'check_in') cin,
                     max(a.created_at) filter (where a.type = 'check_out') cout,
                     bool_or(a.is_remote) remote, bool_or(a.status = 'pending') pending
              from public.attendance a
              where a.staff_id = w.employee_id::text and a.status <> 'rejected'
                and a.created_at >= (w.period_from::timestamp at time zone 'Asia/Ulaanbaatar')
                and a.created_at <  ((w.period_to + 1)::timestamp at time zone 'Asia/Ulaanbaatar')
              group by 1) x), '[]'::jsonb),
    'leaves', coalesce((select jsonb_agg(jsonb_build_object('e', l.user_id, 'from', l.date_from, 'to', l.date_to, 'kind', l.kind))
        from public.leave_requests l
        where l.user_id = w.employee_id and l.status = 'approved'
          and l.date_from <= w.period_to and l.date_to >= w.period_from), '[]'::jsonb),
    'rest_days', coalesce((select jsonb_agg(jsonb_build_object('e', b.user_id, 'dow', b.day_of_week))
        from public.employee_break_schedules b where b.user_id = w.employee_id), '[]'::jsonb)
  ) into data;

  return jsonb_build_object(
    'warning', jsonb_build_object('id', w.id, 'title', w.title, 'message', w.message, 'stats', w.stats,
                                  'period_from', w.period_from, 'period_to', w.period_to,
                                  'created_at', w.created_at, 'created_by_name', w.created_by_name,
                                  'employee_name', w.employee_name),
    'data', data
  );
end;
$$;
revoke all on function public.get_attendance_warning(text) from public;
grant execute on function public.get_attendance_warning(text) to anon, authenticated;

-- â”€â”€ ÐÐ¿Ð¿-Ñ‹Ð½ Â«Ð¢Ð°Ð¹Ð»Ð°Ð½Â» Ð¶Ð°Ð³ÑÐ°Ð°Ð»Ñ‚Ð°Ð´ Ð²ÑÐ± Ñ‚Ð°Ð¹Ð»Ð°Ð½Ð³Ð¸Ð¹Ð½ Ñ…Ð¾Ð»Ð±Ð¾Ð¾Ñ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Ð¢Ò¯Ð»Ñ…Ò¯Ò¯Ñ€Ð¸Ð¹Ð³ ÑÐ½Ð´ ÑÐ°Ð½Ð°Ð¼ÑÐ°Ñ€Ð³Ò¯Ð¹ Ò¯Ò¯ÑÐ³ÑÐ½Ñ (git-Ð´ Ð¾Ñ€Ð¾Ñ…Ð³Ò¯Ð¹); Ð·Ó©Ð²Ñ…Ó©Ð½ hash Ñ…Ð°Ð´Ð³Ð°Ð»Ð¶,
-- Ð±Ò¯Ñ‚ÑÐ½ Ñ…Ð¾Ð»Ð±Ð¾Ð¾Ñ Ð½ÑŒ Ð·Ó©Ð²Ñ…Ó©Ð½ Ð°Ð´Ð¼Ð¸Ð½ ÑƒÐ½ÑˆÐ´Ð°Ð³ employee_reports Ð¼Ó©Ñ€Ó©Ð½Ð´ Ð» Ð±Ð°Ð¹Ð½Ð°.
do $$
declare
  k text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not exists (select 1 from public.employee_reports where payload->>'pin' = 'time_report') then
    insert into public.report_access_keys (key_hash, label)
    values (encode(sha256(convert_to(k, 'UTF8')), 'hex'), 'ÐÐ¿Ð¿ â€” Ð°Ð´Ð¼Ð¸Ð½Ñ‹ Ð¢Ð°Ð¹Ð»Ð°Ð½ Ð¶Ð°Ð³ÑÐ°Ð°Ð»Ñ‚');
    insert into public.employee_reports (user_id, user_name, report_type, title, pdf_url, payload)
    values (null, 'Gennetex ERP', 'attendance', 'Ð¦Ð°Ð³Ð¸Ð¹Ð½ Ñ‚Ð°Ð¹Ð»Ð°Ð½ â€” Ð±Ò¯Ñ… Ð°Ð¶Ð¸Ð»Ñ‚Ð½Ñ‹ Ð¸Ñ€Ñ†, Ð³Ñ€Ð°Ñ„Ð¸Ðº',
            'https://tailan.gennetex.com/?k=' || k, jsonb_build_object('pin', 'time_report'));
  end if;
end $$;

-- Ð–Ð°Ð³ÑÐ°Ð°Ð»Ñ‚ created_at-Ð°Ð°Ñ€ ÑÑ€ÑÐ¼Ð±Ð»ÑÐ³Ð´Ð´ÑÐ³ Ñ‚ÑƒÐ» Ó©Ð´Ó©Ñ€ Ð±Ò¯Ñ€ Ð´ÑÑÑˆ Ð½ÑŒ Ð³Ð°Ñ€Ð³Ð°Ð½Ð°.
select cron.unschedule(jobid) from cron.job where jobname = 'time-report-pin';
select cron.schedule('time-report-pin', '5 16 * * *',
  $$update public.employee_reports set created_at = now() where payload->>'pin' = 'time_report'$$);

notify pgrst, 'reload schema';
