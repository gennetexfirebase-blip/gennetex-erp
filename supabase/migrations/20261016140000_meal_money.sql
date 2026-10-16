-- ============================================================================
-- sanhuu.gennetex.com — Хоолны мөнгө
-- ============================================================================
--
--   Хуримтлагдсан = ажилласан өдөр бүр (work_hour_entries.regular_hours > 0)
--                   × тухайн өдрийн payroll_rates.meal_allowance.
--   Олгосон (meal_ledger):
--     catchup — нөхөж авсан (өнгөрсөн өдрүүдийн хуримтлагдсанаас)
--     advance — түрүүлж авсан (урьдчилгаа, ирээдүйн өдрүүдээс суутгагдана)
--     adjust  — залруулга (+/−)
--   Үлдэгдэл = хуримтлагдсан + залруулга − нөхөж авсан − түрүүлж авсан.
--   Хасах үлдэгдэл = урьдчилгаа хараахан нөхөгдөөгүй.
-- ============================================================================

create table if not exists public.meal_ledger (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('catchup', 'advance', 'adjust')),
  amount          numeric not null check (amount <> 0),
  entry_date      date not null default (now() at time zone 'Asia/Ulaanbaatar')::date,
  note            text,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);
create index if not exists meal_ledger_user_idx on public.meal_ledger (user_id, entry_date desc);
alter table public.meal_ledger enable row level security;
drop policy if exists "meal_ledger_read" on public.meal_ledger;
create policy "meal_ledger_read" on public.meal_ledger for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
-- Бичих — зөвхөн доорх RPC.
grant select on public.meal_ledger to authenticated;

/** Ажилтны өдөр бүрийн хуримтлагдсан хоолны мөнгө. */
create or replace function public.meal_days(p_user uuid default null)
returns table (user_id uuid, work_date date, hours numeric, amount numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select w.user_id, w.work_date, w.regular_hours,
         coalesce((select r.meal_allowance from public.payroll_rates r
                   where r.user_id = w.user_id and r.effective_from <= w.work_date
                   order by r.effective_from desc limit 1), 0)
  from public.work_hour_entries w
  where w.regular_hours > 0 and (p_user is null or w.user_id = p_user);
$$;
revoke all on function public.meal_days(uuid) from public, anon, authenticated;

create or replace function public.meal_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', now() at time zone 'Asia/Ulaanbaatar')::date;
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(x order by x->>'department', x->>'name') from (
    select jsonb_build_object(
      'id', p.id,
      'name', trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')),
      'department', d.name,
      'avatar_url', p.avatar_url,
      'allowance', (select r.meal_allowance from public.payroll_rates r where r.user_id = p.id
                    order by r.effective_from desc limit 1),
      'earned', coalesce((select sum(m.amount) from public.meal_days(p.id) m), 0),
      'month_days', (select count(*) from public.meal_days(p.id) m where m.work_date >= month_start and m.amount > 0),
      'month_earned', coalesce((select sum(m.amount) from public.meal_days(p.id) m where m.work_date >= month_start), 0),
      'catchup', coalesce((select sum(l.amount) from public.meal_ledger l where l.user_id = p.id and l.kind = 'catchup'), 0),
      'advance', coalesce((select sum(l.amount) from public.meal_ledger l where l.user_id = p.id and l.kind = 'advance'), 0),
      'adjust', coalesce((select sum(l.amount) from public.meal_ledger l where l.user_id = p.id and l.kind = 'adjust'), 0)
    ) x
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where p.role is distinct from 'superadmin' and public.dept_in_scope(p.department_id)
  ) q), '[]'::jsonb);
end;
$$;
revoke all on function public.meal_overview() from public, anon;
grant execute on function public.meal_overview() to authenticated;

create or replace function public.meal_employee(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if not public.dept_in_scope((select p.department_id from public.profiles p where p.id = p_user)) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('d', m.work_date, 'h', m.hours, 'a', m.amount) order by m.work_date desc)
                      from public.meal_days(p_user) m), '[]'::jsonb),
    'ledger', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'amount', l.amount, 'd', l.entry_date,
                                                            'note', l.note, 'by', l.created_by_name, 'at', l.created_at)
                                         order by l.entry_date desc, l.created_at desc)
                        from public.meal_ledger l where l.user_id = p_user), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.meal_employee(uuid) from public, anon;
grant execute on function public.meal_employee(uuid) to authenticated;

create or replace function public.meal_record(p_user uuid, p_kind text, p_amount numeric, p_date date, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me_name text;
  new_id uuid;
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if not public.dept_in_scope((select p.department_id from public.profiles p where p.id = p_user)) then raise exception 'forbidden'; end if;
  if p_kind not in ('catchup', 'advance', 'adjust') then raise exception 'invalid_kind'; end if;
  if p_amount is null or p_amount = 0 or (p_kind <> 'adjust' and p_amount < 0) then raise exception 'invalid_amount'; end if;
  select coalesce(nullif(trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), ''), p.email) into me_name
    from public.profiles p where p.id = auth.uid();
  insert into public.meal_ledger (user_id, kind, amount, entry_date, note, created_by, created_by_name)
  values (p_user, p_kind, p_amount, coalesce(p_date, (now() at time zone 'Asia/Ulaanbaatar')::date), nullif(trim(p_note), ''), auth.uid(), me_name)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.meal_record(uuid, text, numeric, date, text) from public, anon;
grant execute on function public.meal_record(uuid, text, numeric, date, text) to authenticated;

create or replace function public.meal_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if not public.dept_in_scope((select p.department_id from public.meal_ledger l join public.profiles p on p.id = l.user_id where l.id = p_id)) then
    raise exception 'forbidden';
  end if;
  delete from public.meal_ledger l where l.id = p_id;
end;
$$;
revoke all on function public.meal_delete(uuid) from public, anon;
grant execute on function public.meal_delete(uuid) to authenticated;

notify pgrst, 'reload schema';
