-- Ажилтан устгахад гардаг алдааг засна (апп, admin-web хоёулаа admin_delete_user).
--
-- `delete from auth.users` нь доорх хүснэгтүүдийн ON DELETE NO ACTION /
-- RESTRICT холбоосоос болж foreign key алдаа өгдөг байв. Түүхийг (акт,
-- өндөрт ажиллах үнэлгээ, түлш, аялал, байршил) устгахгүй — хүний холбоосыг
-- NULL болгоно. Нэрийг ихэнх хүснэгт тусад нь (created_by_name г.м) хадгалдаг.

do $$
declare
  r record;
  v_ref text;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tbl, a.attname as col,
           a.attnotnull as notnull, c.confrelid::regclass::text as ref
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f'
      and array_length(c.conkey, 1) = 1
      and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
      and c.confdeltype in ('a', 'r')
  loop
    v_ref := case when r.ref = 'auth.users' then 'auth.users(id)' else 'public.profiles(id)' end;
    if r.notnull then
      execute format('alter table %s alter column %I drop not null', r.tbl, r.col);
    end if;
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references %s on delete set null',
                   r.tbl, r.conname, r.col, v_ref);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
