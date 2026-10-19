-- ============================================================================
-- Гүйцэтгэл (guitsetgel.gennetex.com) — Google Sheet-ээс ажил бүрийг татаж,
-- инженер бүрийн гүйцэтгэл ба цалингийн нэмэгдлийг тооцно (sanhuu.gennetex.com).
-- ============================================================================
--
--   perf_jobs     — Sheet-ийн мөр бүр нэг ажил (огноо, төрөл, инженерүүд, цаг, кабель).
--                   Edge function `perf-sync` Sheet-ийг бүтнээр нь дахин бичнэ.
--   perf_aliases  — Sheet дээрх латин нэр → ажилтан (lkhavgadash, lhavgadash → нэг хүн).
--   perf_rates    — ажлын төрөл бүрийн үнэлгээ ₮ (+ «cable» — кабель татсан нэмэгдэл).
--   perf_settings — Sheet-ийн хаяг, сүүлд татсан цаг.
--
--   Хамт ч, ганцаараа ч хийсэн ажил оролцсон инженер бүрт БҮТЭН 1 ажил.
--   Цалин (sanhuu) = ирцийн цалин + гүйцэтгэлийн нэмэгдэл.
-- ============================================================================

create table if not exists public.perf_jobs (
  id         bigint generated always as identity primary key,
  sheet_row  int not null,
  work_date  date not null,
  kind       text not null,
  engineers  text[] not null default '{}',
  job_time   text,
  cable      boolean not null default false,
  contract   text,
  synced_at  timestamptz not null default now()
);
create index if not exists perf_jobs_date_idx on public.perf_jobs (work_date);

create table if not exists public.perf_aliases (
  alias      text primary key,            -- жижиг үсгээр, хоосон зайг нэгтгэсэн
  user_id    uuid references public.profiles(id) on delete set null,
  ignored    boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.perf_rates (
  kind       text primary key,            -- Sheet-ийн «төрөл» (жижиг үсгээр) эсвэл 'cable'
  label      text,
  amount     numeric not null default 0 check (amount >= 0),
  updated_at timestamptz not null default now()
);
insert into public.perf_rates (kind, label) values
  ('complain', 'Гомдол (complain)'),
  ('new customer', 'Шинэ хэрэглэгч (new customer)'),
  ('reinstallation', 'Дахин суурилуулалт (reinstallation)'),
  ('add additional box', 'Нэмэлт бокс (add additional box)'),
  ('cable', 'Кабель татсан — нэмэгдэл')
on conflict (kind) do nothing;

create table if not exists public.perf_settings (
  id          int primary key default 1 check (id = 1),
  sheet_id    text not null default '1JAaJXbB8F1IAmiV5NOnGjs22mrOZ5fGRYKMNLT_6PRM',
  sheet_gid   text not null default '1683111914',
  last_sync_at timestamptz,
  last_sync_rows int
);
insert into public.perf_settings (id) values (1) on conflict (id) do nothing;

alter table public.perf_jobs enable row level security;
alter table public.perf_aliases enable row level security;
alter table public.perf_rates enable row level security;
alter table public.perf_settings enable row level security;
do $$
declare t text;
begin
  foreach t in array array['perf_jobs', 'perf_aliases', 'perf_rates', 'perf_settings'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user())', t || '_admin', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

/**
 * Хугацааны гүйцэтгэл — инженер (ажилтан) бүрээр.
 *   jobs   — оролцсон ажлын тоо (хамт ч бүтэн 1)
 *   kinds  — төрөл бүрийн тоо
 *   cable  — кабель татсан ажлын тоо
 *   solo / pair — ганцаараа / хамт
 *   amount — Σ үнэлгээ(төрөл) + cable × үнэлгээ('cable')
 * Холбогдоогүй нэрс (unmapped) тусдаа — sanhuu дээр ажилтантай холбоно.
 */
create or replace function public.perf_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  return (
    with j as (
      select pj.*, lower(btrim(regexp_replace(e.name, '\s+', ' ', 'g'))) as alias, cardinality(pj.engineers) as crew
      from public.perf_jobs pj
      cross join lateral unnest(pj.engineers) as e(name)
      where pj.work_date between p_from and p_to
    ),
    m as (
      select j.*, a.user_id, coalesce(a.ignored, false) as ignored,
             coalesce((select r.amount from public.perf_rates r where r.kind = lower(btrim(j.kind))), 0) as kind_amount,
             case when j.cable then coalesce((select r.amount from public.perf_rates r where r.kind = 'cable'), 0) else 0 end as cable_amount
      from j left join public.perf_aliases a on a.alias = j.alias
    )
    select jsonb_build_object(
      'people', coalesce((
        select jsonb_agg(x order by (x->>'amount')::numeric desc, (x->>'jobs')::int desc) from (
          select jsonb_build_object(
            'user_id', m.user_id,
            'name', coalesce(nullif(btrim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), ''), 'Ажилтан'),
            'department', d.name,
            'aliases', (select jsonb_agg(distinct m2.alias) from m m2 where m2.user_id = m.user_id),
            'jobs', count(*),
            'days', count(distinct m.work_date),
            'cable', count(*) filter (where m.cable),
            'solo', count(*) filter (where m.crew = 1),
            'pair', count(*) filter (where m.crew > 1),
            'kinds', (select jsonb_object_agg(k.kind, k.n) from (select lower(btrim(m3.kind)) as kind, count(*) as n from m m3 where m3.user_id = m.user_id group by 1) k),
            'amount', sum(m.kind_amount + m.cable_amount)
          ) x
          from m
          left join public.profiles p on p.id = m.user_id
          left join public.departments d on d.id = p.department_id
          where m.user_id is not null and not m.ignored
          group by m.user_id, p.last_name, p.name, d.name
        ) q), '[]'::jsonb),
      'unmapped', coalesce((
        select jsonb_agg(jsonb_build_object('alias', u.alias, 'jobs', u.n) order by u.n desc)
        from (select alias, count(*) as n from m where user_id is null and not ignored group by alias) u), '[]'::jsonb),
      'jobs', (select count(*) from public.perf_jobs pj where pj.work_date between p_from and p_to),
      'rates', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'label', r.label, 'amount', r.amount) order by r.kind = 'cable', r.kind) from public.perf_rates r), '[]'::jsonb),
      'last_sync_at', (select s.last_sync_at from public.perf_settings s where s.id = 1)
    )
  );
end;
$$;
revoke all on function public.perf_summary(date, date) from public, anon;
grant execute on function public.perf_summary(date, date) to authenticated;

notify pgrst, 'reload schema';
