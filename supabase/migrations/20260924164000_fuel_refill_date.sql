-- Цэнэглэлтийн бодит огноог веб болон мобайлаас сонгож хадгална.
-- Хуучин client-үүд параметр дамжуулахгүй үед одоогийн мөч хэвээр ашиглагдана.

drop function if exists public.refuel_vehicle_by_amount(uuid, numeric, text);
drop function if exists public.refuel_vehicle_by_amount(uuid, numeric, text, numeric);

create function public.refuel_vehicle_by_amount(
  p_vehicle_id      uuid,
  p_amount_mnt      numeric,
  p_note            text default null,
  p_price_per_liter numeric default null,
  p_refueled_on     date default null
)
returns table(liters numeric, price_per_liter numeric, fuel_level_percent numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_vehicle      public.vehicles;
  v_price        numeric;
  v_list_price   numeric;
  v_liters       numeric;
  v_capacity     numeric;
  v_level        numeric;
  v_actor        text;
  v_discounted   boolean := false;
  v_local_today  date := (now() at time zone 'Asia/Ulaanbaatar')::date;
  v_refueled_at  timestamptz;
begin
  if public.role_rank((select role from public.profiles where id = auth.uid())) < 3 then
    raise exception 'forbidden' using hint = 'Зөвхөн админ түлш цэнэглэнэ.';
  end if;
  if p_amount_mnt is null or p_amount_mnt <= 0 then
    raise exception 'invalid_amount' using hint = 'Мөнгөн дүн 0-ээс их байна.';
  end if;
  if p_refueled_on is not null and p_refueled_on > v_local_today then
    raise exception 'future_refuel_date' using hint = 'Ирээдүйн огноо сонгох боломжгүй.';
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

  -- Өнөөдрийн цэнэглэлтийг яг одоогийн цагаар, өмнөх өдрийг тухайн
  -- өдрийн 00:00 Улаанбаатарын цагаар хадгална.
  if p_refueled_on is null or p_refueled_on = v_local_today then
    v_refueled_at := now();
  else
    v_refueled_at := p_refueled_on::timestamp at time zone 'Asia/Ulaanbaatar';
  end if;

  update public.vehicles
     set fuel_level_percent = round(v_level, 1),
         fuel_refilled_at   = v_refueled_at
   where id = p_vehicle_id;

  select coalesce(name, 'Админ') into v_actor from public.profiles where id = auth.uid();

  insert into public.vehicle_logs (
    vehicle_id, plate_number, code, user_id, user_name,
    event, liters, cost, price_per_liter, discounted, created_at
  )
  values (
    p_vehicle_id, v_vehicle.plate_number, v_vehicle.code, auth.uid(), v_actor,
    'refuel', v_liters, p_amount_mnt, v_price, v_discounted, v_refueled_at
  );

  return query select v_liters, v_price, round(v_level, 1);
end;
$function$;

grant execute on function public.refuel_vehicle_by_amount(uuid, numeric, text, numeric, date)
  to authenticated;

comment on function public.refuel_vehicle_by_amount(uuid, numeric, text, numeric, date) is
  'Мөнгөн дүнгээр түлш цэнэглэж, сонгосон бодит огноогоор түүхэнд хадгална.';
