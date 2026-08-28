-- Түлшний үнийн бүртгэл.
--
-- ЗОРИЛГО: админ түлш цэнэглэхдээ ЗӨВХӨН МӨНГӨН ДҮНГ оруулна
-- (жишээ нь 50'000₮), литр нь тухайн үеийн 1 литрийн үнээр
-- автоматаар тооцогдоно.
--
-- ⚠️ ЯАГААД ТУСДАА ХҮСНЭГТ ВЭ:
--    Түлшний үнэ байнга өөрчлөгддөг. Хэрэв тохиргоонд ганц тоо
--    хадгалбал үнэ солиход ӨМНӨХ бүх бүртгэлийн литр буруу болно
--    ("тэр үед хэдээр авсан бэ" гэдэгт хариулах боломжгүй). Тиймээс
--    үнэ нь ОГНООТОЙ түүх болж хуримтлагдана, цэнэглэлт бүр өөрийн
--    үеийн үнийг мөрдөө хадгална.

create table if not exists public.fuel_prices (
  id             uuid primary key default gen_random_uuid(),
  fuel_type      text not null check (fuel_type in ('ai80', 'ai92', 'ai95', 'diesel')),
  price_mnt      numeric(10, 2) not null check (price_mnt > 0),
  effective_date date not null default current_date,
  -- 'manual' = админ гараар оруулсан, бусад нь автомат эх сурвалжийн нэр
  source         text not null default 'manual',
  note           text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  -- Нэг өдөр нэг төрөлд нэг үнэ. Дахин оруулбал шинэчилнэ.
  unique (fuel_type, effective_date)
);

create index if not exists fuel_prices_lookup_idx
  on public.fuel_prices (fuel_type, effective_date desc);

alter table public.fuel_prices enable row level security;

-- Жолооч ч өөрийн аяллын зардлыг харах ёстой тул унших нь нээлттэй.
drop policy if exists "fuel_prices_read" on public.fuel_prices;
create policy "fuel_prices_read"
  on public.fuel_prices for select to authenticated using (true);

-- Бичих нь ЗӨВХӨН RPC-ээр (доор). Шууд insert/update эрх хэнд ч алга.

-- ---------------------------------------------------------------------
-- Машин бүрийн түлшний төрөл
-- ---------------------------------------------------------------------
-- Бензин, дизель нь өөр үнэтэй тул машин бүр өөрийн төрөлтэй байна.
alter table public.vehicles
  add column if not exists fuel_type text not null default 'ai92'
    check (fuel_type in ('ai80', 'ai92', 'ai95', 'diesel'));

-- ---------------------------------------------------------------------
-- Цэнэглэлтийн мөрөнд ТЭР ҮЕИЙН үнийг хадгална
-- ---------------------------------------------------------------------
-- ⚠️ Дараа үнэ өөрчлөгдөхөд хуучин бүртгэлийн литр ХЭВЭЭР үлдэнэ.
alter table public.vehicle_logs
  add column if not exists price_per_liter numeric(10, 2);

-- ---------------------------------------------------------------------
-- Одоогийн үнэ
-- ---------------------------------------------------------------------
create or replace function public.current_fuel_price(p_fuel_type text default 'ai92')
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select price_mnt
    from public.fuel_prices
   where fuel_type = p_fuel_type
     and effective_date <= current_date
   order by effective_date desc
   limit 1;
$$;

grant execute on function public.current_fuel_price(text) to authenticated;

/** Бүх төрлийн одоогийн үнэ — тохиргооны дэлгэцэд нэг дуудлагаар. */
create or replace function public.current_fuel_prices()
returns table (fuel_type text, price_mnt numeric, effective_date date, source text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (p.fuel_type)
         p.fuel_type, p.price_mnt, p.effective_date, p.source
    from public.fuel_prices p
   where p.effective_date <= current_date
   order by p.fuel_type, p.effective_date desc;
$$;

grant execute on function public.current_fuel_prices() to authenticated;

-- ---------------------------------------------------------------------
-- Үнэ тохируулах (админ)
-- ---------------------------------------------------------------------
create or replace function public.set_fuel_price(
  p_fuel_type text,
  p_price      numeric,
  p_date       date default current_date,
  p_source     text default 'manual',
  p_note       text default null
)
returns public.fuel_prices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fuel_prices;
begin
  if public.role_rank((select role from public.profiles where id = auth.uid())) < 3 then
    raise exception 'forbidden' using hint = 'Зөвхөн админ түлшний үнэ тохируулна.';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'invalid_price' using hint = 'Үнэ 0-ээс их байна.';
  end if;

  insert into public.fuel_prices (fuel_type, price_mnt, effective_date, source, note, created_by)
  values (p_fuel_type, p_price, coalesce(p_date, current_date), coalesce(p_source, 'manual'), p_note, auth.uid())
  on conflict (fuel_type, effective_date) do update
    set price_mnt = excluded.price_mnt,
        source    = excluded.source,
        note      = excluded.note,
        created_by = excluded.created_by
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.set_fuel_price(text, numeric, date, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Мөнгөн дүнгээр цэнэглэх
-- ---------------------------------------------------------------------
-- Админ ЗӨВХӨН мөнгөө оруулна; литр нь тухайн үеийн үнээр тооцогдож,
-- машины түвшин багтаамжийн хэрээр нэмэгдэнэ.
create or replace function public.refuel_vehicle_by_amount(
  p_vehicle_id uuid,
  p_amount_mnt numeric,
  p_note       text default null
)
returns table (liters numeric, price_per_liter numeric, fuel_level_percent numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle   public.vehicles;
  v_price     numeric;
  v_liters    numeric;
  v_capacity  numeric;
  v_level     numeric;
  v_actor     text;
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

  v_price := public.current_fuel_price(coalesce(v_vehicle.fuel_type, 'ai92'));
  if v_price is null then
    raise exception 'no_price'
      using hint = 'Түлшний үнэ бүртгэгдээгүй байна. Тохиргооноос оруулна уу.';
  end if;

  v_liters := round(p_amount_mnt / v_price, 2);

  -- Багтаамж мэдэгдэж байвал түвшинг хувиар нэмнэ (100%-аас хэтрэхгүй).
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
    event, liters, cost, price_per_liter
  )
  values (
    p_vehicle_id, v_vehicle.plate_number, v_vehicle.code, auth.uid(), v_actor,
    'refuel', v_liters, p_amount_mnt, v_price
  );

  return query select v_liters, v_price, round(v_level, 1);
end;
$$;

grant execute on function public.refuel_vehicle_by_amount(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';
