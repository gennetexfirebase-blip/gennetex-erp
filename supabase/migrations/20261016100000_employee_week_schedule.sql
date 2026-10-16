-- ============================================================================
-- Ажилтны 7 хоногийн хуваарь (tailan.gennetex.com → ажилтны цонх)
-- ============================================================================
--
--   employee_week_schedule — админы оноосон ажлын гаригууд (1=Да … 7=Ня).
--       Мөр байвал «оноосон»: админ дахин солих хүртэл хэвээр. Мөргүй бол
--       тайлан хуучин дүрмээр (Бя, Ня амралт) тооцно.
--
--   employee_break_schedules (апп-ын амралтын өдөр) — үүнтэй синк: амралт =
--       ажлын бус гаригууд. Апп өөрчлөлтгүйгээр зөв амралтын өдрийг харуулна.
--       Апп-ын админ амралтын өдрийг засвал триггер энэ хүснэгтийг шинэчилнэ.
--
--   Бичих эрх зөвхөн админд (эсвэл тайлангийн түлхүүр — апп-ын админ) —
--   ажилтан өөрөө өөрчилж чадахгүй.
-- ============================================================================

create table if not exists public.employee_week_schedule (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  work_days   smallint[] not null default '{}',
  updated_by  uuid references auth.users(id) on delete set null,
  updated_by_name text,
  updated_at  timestamptz not null default now(),
  constraint employee_week_schedule_days_ok check (work_days <@ array[1,2,3,4,5,6,7]::smallint[])
);
alter table public.employee_week_schedule enable row level security;

drop policy if exists "employee_week_schedule_read" on public.employee_week_schedule;
create policy "employee_week_schedule_read" on public.employee_week_schedule
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_user());
-- Бичих бодлого байхгүй: зөвхөн доорх security definer функцүүд бичнэ.
grant select on public.employee_week_schedule to authenticated;

-- Апп-аас амралтын өдөр засагдвал (delete → insert) 7 хоногийн хуваарийг дагуулна.
create or replace function public.sync_week_schedule_from_rest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  if uid is null or not exists (select 1 from public.profiles p where p.id = uid) then return null; end if;
  insert into public.employee_week_schedule (user_id, work_days, updated_by, updated_at)
  values (
    uid,
    array(select g::smallint from generate_series(1, 7) g
          where not exists (select 1 from public.employee_break_schedules b where b.user_id = uid and b.day_of_week = g)),
    auth.uid(), now()
  )
  on conflict (user_id) do update
    set work_days = excluded.work_days, updated_by = excluded.updated_by, updated_by_name = null, updated_at = now();
  return null;
end;
$$;
revoke all on function public.sync_week_schedule_from_rest() from public, anon, authenticated;

drop trigger if exists employee_break_schedules_sync_week on public.employee_break_schedules;
create trigger employee_break_schedules_sync_week
  after insert or update or delete on public.employee_break_schedules
  for each row execute function public.sync_week_schedule_from_rest();

-- Одоо амралтын өдөр оноогдсон ажилтнуудыг шилжүүлнэ.
insert into public.employee_week_schedule (user_id, work_days, updated_at)
select u.user_id,
       array(select g::smallint from generate_series(1, 7) g
             where not exists (select 1 from public.employee_break_schedules b where b.user_id = u.user_id and b.day_of_week = g)),
       now()
from (select distinct b.user_id from public.employee_break_schedules b
      join public.profiles p on p.id = b.user_id) u
on conflict (user_id) do nothing;

-- Тайлангаас оноох.
create or replace function public.set_employee_week_schedule(p_user uuid, p_work_days int[], p_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  by_key boolean := public.time_report_key_ok(p_key);
  me uuid := auth.uid();
  emp public.profiles%rowtype;
  days smallint[];
  my_name text;
  rec public.employee_week_schedule%rowtype;
begin
  if not by_key and not public.is_admin_user() then raise exception 'forbidden'; end if;
  select * into emp from public.profiles p where p.id = p_user;
  if emp.id is null then raise exception 'employee_not_found'; end if;
  if not by_key and not public.dept_in_scope(emp.department_id) then raise exception 'forbidden'; end if;
  days := array(select distinct d::smallint from unnest(coalesce(p_work_days, '{}')) d where d between 1 and 7 order by 1);
  select coalesce(nullif(trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), ''), p.email) into my_name
    from public.profiles p where p.id = me;

  delete from public.employee_break_schedules b where b.user_id = p_user;
  insert into public.employee_break_schedules (user_id, user_name, day_of_week, created_by)
  select p_user, trim(coalesce(emp.last_name, '') || ' ' || coalesce(emp.name, '')), g, me
  from generate_series(1, 7) g where g <> all (days);

  insert into public.employee_week_schedule (user_id, work_days, updated_by, updated_by_name, updated_at)
  values (p_user, days, me, coalesce(my_name, case when by_key then 'Админ (апп)' end), now())
  on conflict (user_id) do update
    set work_days = excluded.work_days, updated_by = excluded.updated_by,
        updated_by_name = excluded.updated_by_name, updated_at = now()
  returning * into rec;

  return jsonb_build_object('e', rec.user_id, 'days', rec.work_days, 'by', rec.updated_by_name, 'at', rec.updated_at);
end;
$$;
revoke all on function public.set_employee_week_schedule(uuid, int[], text) from public;
grant execute on function public.set_employee_week_schedule(uuid, int[], text) to anon, authenticated;

-- time_report_data-д 'week' нэмнэ.
do $$
declare
  def text;
  anchor text := $q$'rest_days', coalesce((select jsonb_agg(jsonb_build_object('e', b.user_id, 'dow', b.day_of_week))$q$;
begin
  def := pg_get_functiondef('public.time_report_data(date,date,text)'::regprocedure);
  if position('employee_week_schedule' in def) > 0 then return; end if;
  if position(anchor in def) = 0 then raise exception 'patch failed (time_report_data)'; end if;
  def := replace(def, anchor, $q$'week', coalesce((select jsonb_agg(jsonb_build_object('e', w.user_id, 'days', w.work_days, 'by', w.updated_by_name, 'at', w.updated_at))
        from public.employee_week_schedule w where exists (select 1 from emp e where e.id = w.user_id)), '[]'::jsonb),
    $q$ || anchor);
  execute def;
end $$;

notify pgrst, 'reload schema';
