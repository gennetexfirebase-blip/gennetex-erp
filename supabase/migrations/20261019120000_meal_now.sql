-- ============================================================================
-- Хоолны мөнгө — «Одоо авах» (now)
-- ============================================================================
--
--   now — тухайн өдрийн хоолны мөнгийг тэр өдөрт нь (бэлнээр) авсан.
--         Нөхөж авахтай адил хуримтлагдсанаас хасагдана.
--   Үлдэгдэл = хуримтлагдсан + залруулга − нөхөж авсан − түрүүлж авсан − одоо авсан.
-- ============================================================================

alter table public.meal_ledger drop constraint if exists meal_ledger_kind_check;
alter table public.meal_ledger add constraint meal_ledger_kind_check check (kind in ('catchup', 'advance', 'adjust', 'now'));

create or replace function public.meal_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', now() at time zone 'Asia/Ulaanbaatar')::date;
  today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
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
      'adjust', coalesce((select sum(l.amount) from public.meal_ledger l where l.user_id = p.id and l.kind = 'adjust'), 0),
      'now', coalesce((select sum(l.amount) from public.meal_ledger l where l.user_id = p.id and l.kind = 'now'), 0),
      'now_today', coalesce((select sum(l.amount) from public.meal_ledger l where l.user_id = p.id and l.kind = 'now' and l.entry_date = today), 0)
    ) x
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where p.role is distinct from 'superadmin' and public.dept_in_scope(p.department_id)
  ) q), '[]'::jsonb);
end;
$$;
revoke all on function public.meal_overview() from public, anon;
grant execute on function public.meal_overview() to authenticated;

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
  if p_kind not in ('catchup', 'advance', 'adjust', 'now') then raise exception 'invalid_kind'; end if;
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

notify pgrst, 'reload schema';
