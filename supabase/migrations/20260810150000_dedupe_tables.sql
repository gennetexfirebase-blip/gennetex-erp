-- ============================================================================
-- Давхардсан хүснэгтүүдийг тэтгэвэрт гаргах
-- ============================================================================
--
-- ЗАРЧИМ: DROP ХИЙХГҮЙ, зөвхөн RENAME.
--
--   Хүснэгт устгах нь эргэлт буцалтгүй. Хэрэв ямар нэг код (эсвэл миний
--   анзаараагүй скрипт) тэр хүснэгтийг ашигласаар байвал өгөгдөл үүрд
--   алдагдана. Нэр солих нь:
--     • унших/бичих оролдлогыг ШУУД, тодорхой алдаагаар илрүүлнэ
--     • өгөгдлийг бүрэн хадгална
--     • нэг мөрөөр буцаах боломжтой
--
--   Хэдэн долоо хоног ажиллуулаад ямар ч алдаа гарахгүй бол `zz_deprecated_`
--   угтвартай хүснэгтүүдийг гараар устгаж болно.
--
-- КОДЫН ТАЛ АЛЬ ХЭДИЙН ХИЙГДСЭН:
--   • aiInventoryService.js  — inventory_history руу бичихээ больсон
--   • liveStreamService.js   — устгасан (meetings kind='live' болсон)
--   • admin-web/index.html   — live_streams хүсэлтийг хассан
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. inventory_history
-- ---------------------------------------------------------------------------
-- `count_id`-аар inventory_counts руу холбогдсон АТЛАА тэндээс 10 баганыг
-- бүрэн хуулж давхар хадгалдаг байв. Хадгалалт бүр хоёуланд нь бичдэг тул
-- энэ нь бүтэн хүснэгтийн хэмжээний давхардал.

do $$
begin
  if to_regclass('public.inventory_history') is not null then
    alter table public.inventory_history rename to zz_deprecated_inventory_history;
    raise notice 'inventory_history -> zz_deprecated_inventory_history';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2. live_streams
-- ---------------------------------------------------------------------------
-- `meetings` хүснэгт рүү `kind='live'` болж нэгтгэгдсэн. Хуучин мөр үлдсэн
-- бол ЭХЛЭЭД зөөнө — id-г хадгална, эс тэгвээс `live_comments.live_id`
-- болон `live_invites` дэх заалтууд эзэнгүй үлдэнэ.

do $$
declare
  v_moved int := 0;
begin
  if to_regclass('public.live_streams') is null then
    return;
  end if;

  if to_regclass('public.meetings') is not null then
    insert into public.meetings (id, host_id, host_name, title, kind, started_at, ended_at, status)
    select ls.id, ls.host_id, ls.host_name, coalesce(ls.title, 'Live'), 'live',
           ls.started_at, ls.ended_at, coalesce(ls.status, 'ended')
    from public.live_streams ls
    where not exists (select 1 from public.meetings m where m.id = ls.id)
    on conflict (id) do nothing;
    get diagnostics v_moved = row_count;
    raise notice 'live_streams -> meetings: % мөр зөөв', v_moved;
  end if;

  alter table public.live_streams rename to zz_deprecated_live_streams;
  raise notice 'live_streams -> zz_deprecated_live_streams';
end;
$$;


-- ---------------------------------------------------------------------------
-- 3. staff
-- ---------------------------------------------------------------------------
-- Анхны schema.sql-ийн үлдэгдэл. Ажилтны жинхэнэ эх сурвалж нь `profiles`
-- (auth.users-тэй холбоотой) бөгөөд `staff`-ийг уншдаг код үлдээгүй.
--
-- ⚠️ Өөр хүснэгт үүн рүү foreign key-ээр холбогдсон бол ХӨНДӨХГҮЙ —
--    тэр тохиолдолд өгөгдлийн бүтэн байдал эвдэрч болзошгүй.

do $$
declare
  v_refs int;
begin
  if to_regclass('public.staff') is null then
    return;
  end if;

  select count(*) into v_refs
  from pg_constraint c
  join pg_class t on t.oid = c.confrelid
  join pg_namespace n on n.oid = t.relnamespace
  where c.contype = 'f' and n.nspname = 'public' and t.relname = 'staff';

  if v_refs > 0 then
    raise notice 'staff: % foreign key заалттай тул хөндөөгүй', v_refs;
  else
    alter table public.staff rename to zz_deprecated_staff;
    raise notice 'staff -> zz_deprecated_staff';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- 4. Тэтгэвэрт гарсан хүснэгтүүдийг бүрэн хаах
-- ---------------------------------------------------------------------------
-- Нэр солих нь RLS болон эрхийг ХАДГАЛНА — өөрөөр хэлбэл хуучин нэрээ
-- мэддэг клиент шинэ нэрээр нь хандаж чадна. Тиймээс эрхийг нь буцаана.
-- Ингэснээр санамсаргүй ашиглалт ШУУД илэрнэ.

do $$
declare
  r record;
begin
  for r in
    select tablename from pg_tables
    where schemaname = 'public' and tablename like 'zz_deprecated_%'
  loop
    execute format('revoke all on public.%I from anon, authenticated', r.tablename);
    execute format('alter table public.%I enable row level security', r.tablename);
    raise notice 'хаав: %', r.tablename;
  end loop;
end;
$$;
