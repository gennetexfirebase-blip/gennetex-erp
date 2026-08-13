-- ============================================================================
-- 1. Буруу загвараар үүссэн мөрүүдийг цэвэрлэх
-- 2. Хайрцгаар БҮТНЭЭР олгох
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Цэвэрлэгээ
-- ---------------------------------------------------------------------------
-- Өмнөх (буруу) хувилбар нь QR доторх MAC тутамд ТУСДАА `inventory` мөр
-- үүсгэдэг байсан тул "Бараа материал" жагсаалт ижил нэртэй хэдэн арван
-- картаар дүүрэв.
--
-- ⚠️ УСТГАХ НӨХЦӨЛ НАРИЙН — жинхэнэ бараа санамсаргүй устахаас сэргийлж
--    ТАВУУЛАА зэрэг хангасан мөрийг л устгана:
--      • barcode нь MAC/SN хэлбэртэй (12-20 оронтой hex)
--      • тоо 1-ээс ихгүй
--      • ЗӨВХӨН 2026-08-11-нээс хойш үүссэн (тестийн өдөр)
--      • шинэ загварт (`box_serials`) бүртгэлгүй
--      • ямар нэг хөдөлгөөн/олголтод оролцоогүй
--
--    Жинхэнэ ашиглаж буй бараа эдгээрийг бүгдийг зэрэг хангахгүй.

create table if not exists public.cleanup_audit (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  what text not null,
  removed int not null default 0,
  detail text
);

do $$
declare
  v_removed int := 0;
  v_names text;
begin
  -- Юуг устгахаа эхлээд бүртгэнэ — дараа нь "юу устсан бэ" гэдэгт
  -- хариулах боломжтой байх ёстой.
  select count(*), string_agg(distinct i.name, ', ')
    into v_removed, v_names
  from public.inventory i
  where coalesce(i.category, 'material') = 'material'
    and coalesce(i.quantity, 0) <= 1
    and i.barcode ~ '^[0-9A-Fa-f]{12,20}$'
    and i.created_at >= timestamptz '2026-08-11 00:00:00+08'
    and not exists (select 1 from public.box_serials s where s.item_id = i.id)
    and not exists (select 1 from public.stock_movements m where m.item_id = i.id)
    and not exists (select 1 from public.box_issues b where b.item_id = i.id);

  if v_removed > 0 then
    -- box_items дэх заалтыг эхлээд авна (foreign key нь cascade боловч
    -- үлдэгдлийн тоо буруу үлдэхээс сэргийлж тодорхой хасна).
    delete from public.box_items bi
    where exists (
      select 1 from public.inventory i
      where i.id = bi.item_id
        and coalesce(i.category, 'material') = 'material'
        and coalesce(i.quantity, 0) <= 1
        and i.barcode ~ '^[0-9A-Fa-f]{12,20}$'
        and i.created_at >= timestamptz '2026-08-11 00:00:00+08'
        and not exists (select 1 from public.box_serials s where s.item_id = i.id)
        and not exists (select 1 from public.stock_movements m where m.item_id = i.id)
        and not exists (select 1 from public.box_issues b where b.item_id = i.id)
    );

    delete from public.inventory i
    where coalesce(i.category, 'material') = 'material'
      and coalesce(i.quantity, 0) <= 1
      and i.barcode ~ '^[0-9A-Fa-f]{12,20}$'
      and i.created_at >= timestamptz '2026-08-11 00:00:00+08'
      and not exists (select 1 from public.box_serials s where s.item_id = i.id)
      and not exists (select 1 from public.stock_movements m where m.item_id = i.id)
      and not exists (select 1 from public.box_issues b where b.item_id = i.id);
  end if;

  insert into public.cleanup_audit (what, removed, detail)
  values ('MAC тутамд үүссэн давхардсан inventory мөр', v_removed, v_names);
end;
$$;

alter table public.cleanup_audit enable row level security;
drop policy if exists cleanup_audit_read on public.cleanup_audit;
create policy cleanup_audit_read on public.cleanup_audit
  for select to authenticated using (
    public.role_rank((select p.role from public.profiles p where p.id = auth.uid())) >= 3
  );

-- ---------------------------------------------------------------------------
-- 2. Хайрцгаар БҮТНЭЭР олгох
-- ---------------------------------------------------------------------------
-- Ажилтанд бүтэн хайрцаг өгөхөд:
--   • доторх БҮХ серийн дугаар тухайн хүний нэр дээр шилжинэ
--   • агуулахын үлдэгдлээс хасагдана
--   • хайрцаг хоосорно (устахгүй — дахин ашиглана)
--   • бүх лог үлдэнэ: хэн, хэзээ, ямар сериалуудыг авсан
create or replace function public.box_issue_whole(p_box_code text, p_user_id uuid)
returns table (issued_items int, issued_serials int, employee text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_box public.boxes%rowtype;
  v_user public.profiles%rowtype;
  v_items int := 0;
  v_serials int := 0;
  r record;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if public.role_rank((select p.role from public.profiles p where p.id = v_actor)) < 1 then
    raise exception 'forbidden';
  end if;

  select p.name into v_actor_name from public.profiles p where p.id = v_actor;

  select * into v_box from public.boxes b
   where lower(trim(b.code)) = lower(trim(p_box_code)) and b.is_active;
  if v_box.id is null then raise exception 'box_not_found'; end if;

  select * into v_user from public.profiles p where p.id = p_user_id;
  if v_user.id is null then raise exception 'user_not_found'; end if;

  -- Бараа тус бүрээр: агуулахаас хасаж, хөдөлгөөн + олголт бүртгэнэ
  for r in
    select bi.item_id, bi.quantity, i.name, i.unit
    from public.box_items bi
    join public.inventory i on i.id = bi.item_id
    where bi.box_id = v_box.id and bi.quantity > 0
  loop
    update public.inventory i
       set quantity = greatest(coalesce(i.quantity, 0) - r.quantity, 0)
     where i.id = r.item_id;

    insert into public.stock_movements (item_id, item_name, unit, user_id, user_name, quantity, movement_type)
    values (r.item_id, r.name, r.unit, p_user_id, v_user.name, r.quantity, 'withdraw');

    insert into public.box_issues (
      box_id, box_code, item_id, item_name, quantity,
      issued_to, issued_to_name, issued_by, issued_by_name
    ) values (
      v_box.id, v_box.code, r.item_id, r.name, r.quantity,
      p_user_id, v_user.name, v_actor, v_actor_name
    );

    v_items := v_items + 1;
  end loop;

  if v_items = 0 then raise exception 'box_empty'; end if;

  -- Серийн дугаарууд тухайн хүний нэр дээр шилжинэ. УСТГАХГҮЙ —
  -- "энэ MAC хэнд байна вэ" гэсэн асуултад хариулах боломж хэвээр.
  update public.box_serials s
     set status = 'issued',
         issued_to = p_user_id,
         issued_to_name = v_user.name,
         issued_at = now()
   where s.box_id = v_box.id and s.status = 'in_box';
  get diagnostics v_serials = row_count;

  -- Хайрцаг хоосорно
  delete from public.box_items bi where bi.box_id = v_box.id;

  return query select v_items, v_serials, v_user.name;
end;
$$;

revoke execute on function public.box_issue_whole(text, uuid) from public, anon;
grant  execute on function public.box_issue_whole(text, uuid) to authenticated;
