-- ══════════════════════════════════════════════════════════════════
-- Евро стандартын шатахуун + хөнгөлөлтийн картын үнэ
--
-- 1. ЕВРО ТӨРӨЛ
--    Монголд Евро-5 стандартын шатахуун тусдаа, өндөр үнэтэй
--    зарагддаг. Одоогийн жагсаалтад зөвхөн А-80, АИ-92, АИ-95,
--    Дизель байсан тул евро түлш хийсэн машины тооцоо ЭНГИЙН
--    түлшний үнээр бодогдож, литр нь бодитоос их гарч байв.
--
-- 2. ХӨНГӨЛӨЛТИЙН КАРТ
--    Байгууллагын карттай үед шатахуун станц литрийн үнийг
--    хөнгөлдөг. Систем нь ЗӨВХӨН нийтийн үнээр боддог байсан тул
--    хөнгөлөлттэй авсан үед бодит литрээс ЦӨӨН литр бүртгэгдэж,
--    сав дүүрсэн ч систем "дутуу" гэж харуулдаг байв.
--
--    Одоо админ бодит төлсөн үнээ оруулбал түүгээр тооцно.
-- ══════════════════════════════════════════════════════════════════

-- ── Хөнгөлөлтийг лог дээр тэмдэглэнэ ─────────────────────────────
alter table public.vehicle_logs
  add column if not exists discounted boolean not null default false;

comment on column public.vehicle_logs.discounted is
  'Хөнгөлөлтийн картаар авсан эсэх. price_per_liter нь тухайн үед БОДИТ төлсөн үнэ.';


-- ── Хязгаарлалтыг эхлээд өргөтгөнө ──────────────────────────────
-- ⚠️ `fuel_prices` БОЛОН `vehicles` хоёулаа CHECK-ээр дөрвөн төрлөөр
--    хаагдсан. Аль нэгийг нь мартвал үнэ нь орох ч машин дээр тэр
--    төрлийг сонгож чадахгүй болно.
alter table public.fuel_prices drop constraint if exists fuel_prices_fuel_type_check;
alter table public.fuel_prices add constraint fuel_prices_fuel_type_check
  check (fuel_type = any (array[
    'ai80', 'ai92', 'ai95', 'diesel',
    'ai92_euro', 'ai95_euro', 'diesel_euro'
  ]));

alter table public.vehicles drop constraint if exists vehicles_fuel_type_check;
alter table public.vehicles add constraint vehicles_fuel_type_check
  check (fuel_type is null or fuel_type = any (array[
    'ai80', 'ai92', 'ai95', 'diesel',
    'ai92_euro', 'ai95_euro', 'diesel_euro'
  ]));


-- ── Евро төрлийн эхний үнэ ───────────────────────────────────────
-- Энгийн төрлийн өнөөгийн үнээс тооцож эхлүүлнэ. Админ Тохиргооноос
-- хэдийд ч засна — энэ нь зөвхөн ЭХЛЭЛ бөгөөс сонголт хоосон гарахгүй.
insert into public.fuel_prices (fuel_type, price_mnt, effective_date, source, note)
select t.key,
       coalesce(
         (select price_mnt from public.fuel_prices p
           where p.fuel_type = t.base
           order by effective_date desc limit 1) * t.mult,
         t.fallback
       ),
       current_date,
       'seed',
       'Евро төрөл нэмэгдсэн үеийн эхний үнэ — Тохиргооноос засна уу.'
from (values
  ('ai92_euro',   'ai92',   1.06, 3200),
  ('ai95_euro',   'ai95',   1.06, 3500),
  ('diesel_euro', 'diesel', 1.08, 3400)
) as t(key, base, mult, fallback)
where not exists (
  select 1 from public.fuel_prices f where f.fuel_type = t.key
);


/**
 * Мөнгөн дүнгээр цэнэглэх — хөнгөлөлтийн үнийг дэмжинэ.
 *
 * ⚠️ `p_price_per_liter` нь ЗӨВХӨН хөнгөлөлттэй үед дамжина. NULL
 *    үед хуучин зан төлөв хэвээр — бүртгэлтэй нийтийн үнээр тооцно.
 *    Ингэснээр хуучин дуудагчид (гар утасны хуучин хувилбар) эвдрэхгүй.
 *
 * ⚠️ Хөнгөлсөн үнэ нь нийтийн үнээс ИХ байвал татгалзана. Хөнгөлөлт
 *    гэдэг нь тодорхойлолтоороо бага үнэ; их бичсэн бол админ андуурч
 *    нийт дүнг литрийн үнэ гэж бичсэн байх магадлалтай — тэр нь
 *    түлшний түвшинг үлэмж буруу тооцно.
 */
create or replace function public.refuel_vehicle_by_amount(
  p_vehicle_id     uuid,
  p_amount_mnt     numeric,
  p_note           text default null,
  p_price_per_liter numeric default null
)
returns table(liters numeric, price_per_liter numeric, fuel_level_percent numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_vehicle    public.vehicles;
  v_price      numeric;
  v_list_price numeric;
  v_liters     numeric;
  v_capacity   numeric;
  v_level      numeric;
  v_actor      text;
  v_discounted boolean := false;
begin
  if public.role_rank((select role from public.profiles where id = auth.uid())) < 3 then
    raise exception 'forbidden' using hint = 'Зөвхөн админ түлш цэнэглэнэ.';
  end if;
  if p_amount_mnt is null or p_amount_mnt <= 0 then
    raise exception 'invalid_amount' using hint = 'Мөнгөн дүн 0-ээс их байна.';
  end if;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if v_vehicle.id is null then
    raise exception 'vehicle_not_found';
  end if;

  v_list_price := public.current_fuel_price(coalesce(v_vehicle.fuel_type, 'ai92'));

  if p_price_per_liter is not null and p_price_per_liter > 0 then
    if v_list_price is not null and p_price_per_liter > v_list_price then
      raise exception 'discount_above_list'
        using hint = 'Хөнгөлсөн үнэ нийтийн үнээс их байж болохгүй.';
    end if;
    v_price := p_price_per_liter;
    v_discounted := true;
  else
    v_price := v_list_price;
  end if;

  if v_price is null then
    raise exception 'no_price'
      using hint = 'Түлшний үнэ бүртгэгдээгүй байна. Тохиргооноос оруулна уу.';
  end if;

  v_liters := round(p_amount_mnt / v_price, 2);

  v_capacity := nullif(v_vehicle.tank_capacity_liters, 0);
  if v_capacity is not null then
    v_level := least(
      100,
      coalesce(v_vehicle.fuel_level_percent, 0) + (v_liters / v_capacity) * 100
    );
  else
    v_level := v_vehicle.fuel_level_percent;
  end if;

  update public.vehicles
     set fuel_level_percent = round(v_level, 1),
         fuel_refilled_at   = now()
   where id = p_vehicle_id;

  select coalesce(name, 'Админ') into v_actor from public.profiles where id = auth.uid();

  insert into public.vehicle_logs (
    vehicle_id, plate_number, code, user_id, user_name,
    event, liters, cost, price_per_liter, discounted
  )
  values (
    p_vehicle_id, v_vehicle.plate_number, v_vehicle.code, auth.uid(), v_actor,
    'refuel', v_liters, p_amount_mnt, v_price, v_discounted
  );

  return query select v_liters, v_price, round(v_level, 1);
end;
$function$;


/**
 * Машины шатахууны зарцуулалтын нэгтгэл.
 *
 * "Энэ машинд нийт хэдэн төгрөгөөр бензин хийсэн бэ" гэдэг нь
 * төсвийн хамгийн энгийн бөгөөд хамгийн их асуугддаг асуулт байтал
 * хариулах зам байгаагүй — `vehicle_logs` дээр өгөгдөл нь байсан ч
 * хаанаас ч нэгтгэдэггүй байв.
 */
create or replace function public.fuel_spend_report(
  p_from date default null,
  p_to   date default null
)
returns table(
  vehicle_id    uuid,
  plate_number  text,
  code          text,
  driver_name   text,
  fuel_type     text,
  refuel_count  bigint,
  total_liters  numeric,
  total_cost    numeric,
  avg_price     numeric,
  first_at      timestamptz,
  last_at       timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    v.id,
    v.plate_number,
    v.code,
    v.driver_name,
    v.fuel_type,
    count(l.id),
    coalesce(sum(l.liters), 0),
    coalesce(sum(l.cost), 0),
    -- ⚠️ Дундаж үнийг литрийн үнийн ДУНДАЖААР бодохгүй: цэнэглэлт бүр
    --    өөр өөр хэмжээтэй тул жижиг цэнэглэлт томтойгоо ижил жинтэй
    --    болж, дүн мэдэгдэхүйц гажина. Нийт мөнгө ÷ нийт литр нь зөв.
    case when coalesce(sum(l.liters), 0) > 0
         then round(sum(l.cost) / sum(l.liters))
         else null end,
    min(l.created_at),
    max(l.created_at)
  from public.vehicles v
  left join public.vehicle_logs l
    on l.vehicle_id = v.id
   and l.event = 'refuel'
   and (p_from is null or l.created_at >= p_from::timestamptz)
   and (p_to   is null or l.created_at < (p_to + 1)::timestamptz)
  group by v.id, v.plate_number, v.code, v.driver_name, v.fuel_type
  order by coalesce(sum(l.cost), 0) desc;
$$;

revoke all on function public.fuel_spend_report(date, date) from public, anon;
grant execute on function public.fuel_spend_report(date, date) to authenticated;

notify pgrst, 'reload schema';
