-- Гүйцэтгэл — апп-д хараахан бүртгүүлээгүй ажилтны Sheet-ийн нэрийг HR-ийн жинхэнэ нэрээр харуулах,
-- тэр хүн апп-д бүртгүүлмэгц (authorized_users.linked_user_id) автоматаар холбох.
--   perf_aliases.display_name — HR-ийн нэр (ж: «Баасандорж Балжинням»)
--   perf_aliases.hr_email     — authorized_users.email; бүртгүүлэхэд user_id автоматаар бөглөгдөнө

alter table public.perf_aliases add column if not exists display_name text;
alter table public.perf_aliases add column if not exists hr_email text;

-- Sheet: Baljinnyam / baljinnyam, гараар: «Баасандорж Балжинням» → HR: Баасандорж Балжинням
insert into public.perf_aliases (alias, display_name, hr_email, updated_at)
values ('baljinnyam', 'Баасандорж Балжинням', 'baljinnym126@gmail.com', now()),
       ('баасандорж балжинням', 'Баасандорж Балжинням', 'baljinnym126@gmail.com', now()),
       ('балжинням', 'Баасандорж Балжинням', 'baljinnym126@gmail.com', now())
on conflict (alias) do update set display_name = excluded.display_name, hr_email = excluded.hr_email, updated_at = now();

-- Аль хэдийн апп-д холбогдсон бол шууд холбоно.
update public.perf_aliases pa set user_id = au.linked_user_id, updated_at = now()
from public.authorized_users au
where pa.user_id is null and pa.hr_email is not null and lower(au.email) = lower(pa.hr_email) and au.linked_user_id is not null;

create or replace function public.perf_alias_link_on_register()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.linked_user_id is not null and new.email is not null then
    update public.perf_aliases
       set user_id = new.linked_user_id, updated_at = now()
     where user_id is null and lower(hr_email) = lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists perf_alias_link_on_register on public.authorized_users;
create trigger perf_alias_link_on_register
after insert or update of linked_user_id on public.authorized_users
for each row execute function public.perf_alias_link_on_register();

-- perf_summary: холбогдоогүй нэрсэд HR-ийн нэрийг (name) нэмж буцаана.
create or replace function public.perf_summary(p_from date, p_to date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
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
      select j.*, a.user_id, a.display_name, coalesce(a.ignored, false) as ignored,
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
        select jsonb_agg(jsonb_build_object('alias', u.alias, 'name', u.display_name, 'jobs', u.n) order by u.n desc)
        from (select alias, max(display_name) as display_name, count(*) as n from m where user_id is null and not ignored group by alias) u), '[]'::jsonb),
      'jobs', (select count(*) from public.perf_jobs pj where pj.work_date between p_from and p_to),
      'rates', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'label', r.label, 'amount', r.amount) order by r.kind = 'cable', r.kind) from public.perf_rates r), '[]'::jsonb),
      'last_sync_at', (select s.last_sync_at from public.perf_settings s where s.id = 1)
    )
  );
end;
$function$;

notify pgrst, 'reload schema';
