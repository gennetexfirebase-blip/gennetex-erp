-- ============================================================================
-- Бодит схемийг унших query — ЗӨВХӨН УНШИНА, юу ч өөрчлөхгүй.
-- ============================================================================
--
-- Хэрэглэх заавар:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Доорх бүх кодыг хуулж тавиад Run
--   3. Гарсан үр дүнгийн нүдэн дэх JSON-ыг бүтнээр нь хуулж надад өгнө үү
--
-- Юуг буцаана:
--   • Хүснэгт бүр: мөрийн ойролцоо тоо, эзлэх хэмжээ, RLS асаалттай эсэх
--   • Багана бүр: нэр, төрөл, null зөвшөөрөх эсэх
--   • Одоо байгаа бүх гадаад түлхүүр
--   • Индексүүд
--   • Давхардсан байж болзошгүй хүснэгтүүд (ижил бүтэцтэй)
--
-- Энэ мэдээлэлгүйгээр "давхцал" гэж юуг хэлж байгааг таамаглах болно.
-- Тиймээс эхлээд үүнийг ажиллуулаарай.
-- ============================================================================

with tbl as (
  select
    c.oid,
    c.relname                                        as table_name,
    c.relrowsecurity                                 as rls_enabled,
    coalesce(s.n_live_tup, 0)                        as approx_rows,
    pg_total_relation_size(c.oid)                    as bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where n.nspname = 'public'
    and c.relkind = 'r'
),
cols as (
  select
    a.attrelid as oid,
    jsonb_agg(
      jsonb_build_object(
        'name', a.attname,
        'type', format_type(a.atttypid, a.atttypmod),
        'notnull', a.attnotnull
      )
      order by a.attnum
    ) as columns
  from pg_attribute a
  join tbl on tbl.oid = a.attrelid
  where a.attnum > 0 and not a.attisdropped
  group by a.attrelid
),
fks as (
  select
    con.conrelid as oid,
    jsonb_agg(
      jsonb_build_object(
        'name', con.conname,
        'column', att.attname,
        'references', tgt.relname
      )
    ) as foreign_keys
  from pg_constraint con
  join tbl on tbl.oid = con.conrelid
  join pg_class tgt on tgt.oid = con.confrelid
  join lateral unnest(con.conkey) as k(attnum) on true
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
  where con.contype = 'f'
  group by con.conrelid
),
idx as (
  select
    i.indrelid as oid,
    count(*) as index_count
  from pg_index i
  join tbl on tbl.oid = i.indrelid
  group by i.indrelid
)
select jsonb_pretty(jsonb_agg(
  jsonb_build_object(
    'table',       t.table_name,
    'rows',        t.approx_rows,
    'size',        pg_size_pretty(t.bytes),
    'rls',         t.rls_enabled,
    'n_columns',   jsonb_array_length(coalesce(c.columns, '[]'::jsonb)),
    'n_indexes',   coalesce(x.index_count, 0),
    'foreign_keys', coalesce(f.foreign_keys, '[]'::jsonb),
    'columns',     coalesce(c.columns, '[]'::jsonb)
  )
  order by t.table_name
)) as live_schema
from tbl t
left join cols c on c.oid = t.oid
left join fks  f on f.oid = t.oid
left join idx  x on x.oid = t.oid;


-- ============================================================================
-- НЭМЭЛТ — ижил бүтэцтэй (давхардсан байж болзошгүй) хүснэгт хайх
-- ============================================================================
-- Багануудынх нь нэр 60%-иас дээш давхцаж байгаа хос хүснэгтийг олно.
-- Жишээ нь face_enrollments ↔ face_templates, work_breaks ↔ employee_break_schedules
-- гэх мэт хуучирсан/орлуулагдсан хосуудыг илрүүлнэ.

with cols as (
  select c.relname as t, array_agg(a.attname order by a.attname) as cs
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  where n.nspname = 'public' and c.relkind = 'r'
  group by c.relname
)
select
  a.t as table_a,
  b.t as table_b,
  cardinality(array(select unnest(a.cs) intersect select unnest(b.cs)))            as shared_columns,
  cardinality(a.cs)                                                                as a_columns,
  cardinality(b.cs)                                                                as b_columns,
  round(100.0 * cardinality(array(select unnest(a.cs) intersect select unnest(b.cs)))
        / least(cardinality(a.cs), cardinality(b.cs)), 0)                          as overlap_pct
from cols a
join cols b on a.t < b.t
where cardinality(array(select unnest(a.cs) intersect select unnest(b.cs)))
      >= 0.6 * least(cardinality(a.cs), cardinality(b.cs))
  and least(cardinality(a.cs), cardinality(b.cs)) >= 3
order by overlap_pct desc, shared_columns desc;
