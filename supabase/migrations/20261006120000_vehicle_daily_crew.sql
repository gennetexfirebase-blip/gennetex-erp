-- Машины өдрийн баг: QR-ийн оронд ирц бүртгүүлсний дараа машинаа сонгоно.
--
--   • Өдөрт нэг машиныг ХАМГИЙН ИХДЭЭ 2 хүн сонгоно. Эхэлж сонгосон нь
--     жолооч (trips.driver_id), хоёр дахь нь хамт яваа (trip_passengers).
--     Хоёулаа нэг баг болно.
--   • Машины явсан км нь тэр 2 хүний ажлын үеийн байршлаас
--     (location_history) тооцогдоно. Хоёр утас нэг машинд явдаг тул нийлбэр
--     биш — илүү бүрэн бичигдсэн замыг (их км) авна. Нэг утасны байршил
--     тасарсан ч нөгөөх нь нөхнө.
--   • Явснаа бүртгүүлэхэд км шинэчлэгдэнэ; багийн бүх гишүүн явснаа
--     бүртгүүлэхэд аялал дуусч, түлшийг хасна.
--
-- Тоолох (давхар сонголт, 3 дахь хүн) нь серверт `for update`-аар
-- түгжигдэж шалгагдана — хоёр хүн зэрэг дарсан ч 2-оос хэтрэхгүй.

begin;

create or replace function public.ub_day_start(p_at timestamptz default now())
returns timestamptz language sql stable set search_path = public, pg_temp as $$
  select date_trunc('day', p_at at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar';
$$;

-- Аяллын км: гишүүн бүрийн машинаар явсан замыг (≥9 км/ц хурдтай
-- хэсгүүд) нэмж, гишүүдээс хамгийн их утгыг авна.
create or replace function public.vehicle_trip_distance_km(p_trip_id uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  with t as (
    select id, driver_id, started_at, coalesce(ended_at, now()) as ended_at
    from public.trips where id = p_trip_id
  ), m as (
    select driver_id as uid from t where driver_id is not null
    union
    select p.passenger_id from public.trip_passengers p join t on p.trip_id = t.id
    where p.passenger_id is not null
  ), pts as (
    select h.employee_id, h.timestamp, h.latitude, h.longitude, h.accuracy,
           lag(h.timestamp) over w as p_ts, lag(h.latitude) over w as p_lat,
           lag(h.longitude) over w as p_lng, lag(h.accuracy) over w as p_acc
    from public.location_history h, t
    where h.employee_id in (select uid from m)
      and h.day between (t.started_at at time zone 'Asia/Ulaanbaatar')::date
                    and (t.ended_at at time zone 'Asia/Ulaanbaatar')::date
      and h.timestamp between (extract(epoch from t.started_at) * 1000)::bigint
                          and (extract(epoch from t.ended_at) * 1000)::bigint
    window w as (partition by h.employee_id order by h.timestamp)
  ), seg as (
    select employee_id,
           public.tracking_distance(p_lat, p_lng, latitude, longitude) as d,
           (timestamp - p_ts) / 1000.0 as s, accuracy, p_acc
    from pts where p_ts is not null
  ), per as (
    -- Боломжгүй үсрэлт (GPS алдаа) болон явган/зогсолтын шилжилтийг хасна.
    select employee_id, sum(d) as meters from seg
    where s > 0
      and d <= s * 80 + coalesce(accuracy, 0) + coalesce(p_acc, 0) + 10
      and d / s >= 2.5
    group by employee_id
  )
  select round(coalesce(max(meters), 0)::numeric / 1000, 2) from per;
$$;

-- Аяллыг хаана: км-ийг байршлаас тооцож, литр/үнэ, савны түвшинг шинэчилнэ.
create or replace function public.finish_vehicle_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  tr public.trips; v public.vehicles; km numeric; lit numeric; price numeric;
begin
  select * into tr from public.trips where id = p_trip_id for update;
  if not found or tr.status <> 'active' then return; end if;
  -- Өмнөх өдөр хаагдаагүй үлдсэн аяллыг тэр өдрийн төгсгөлөөр хаана.
  update public.trips
     set ended_at = least(now(), public.ub_day_start(tr.started_at) + interval '1 day')
   where id = tr.id;
  km := public.vehicle_trip_distance_km(tr.id);
  select * into v from public.vehicles where id = tr.vehicle_id for update;
  lit := round(km * coalesce(v.liters_per_100km, 12) / 100, 2);
  begin
    price := public.current_fuel_price(coalesce(v.fuel_type, 'ai92'));
  exception when others then price := null;
  end;
  update public.trips
     set status = 'done', distance_km = km, liters = lit,
         cost = case when price is null then null else round(lit * price) end
   where id = tr.id;
  if v.id is not null and lit > 0 then
    update public.vehicles
       set fuel_level_percent = round(greatest(0, least(100,
             coalesce(fuel_level_percent, 0) - lit / nullif(coalesce(tank_capacity_liters, 60), 0) * 100))::numeric, 1)
     where id = v.id;
  end if;
  insert into public.vehicle_logs(vehicle_id, plate_number, code, user_id, user_name, event, distance_km, liters, cost)
  values (v.id, tr.plate_number, v.code, tr.driver_id, tr.driver_name, 'trip_end', km, lit,
          case when price is null then null else round(lit * price) end);
end $$;

-- Өмнөх өдрүүдэд хаагдаагүй үлдсэн аяллуудыг байршлаас км тооцож хаана
-- (өмнө нь client 0 км-ээр хаадаг байсан — явсан зам алга болдог).
create or replace function public.close_stale_vehicle_trips()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in select id from public.trips where status = 'active' and started_at < public.ub_day_start() loop
    perform public.finish_vehicle_trip(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Ирц бүртгүүлсэн ажилтан өнөөдрийн машинаа сонгоно.
create or replace function public.join_vehicle_today(p_vehicle_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  day0 timestamptz := public.ub_day_start();
  last_type text; uname text; members int;
  v public.vehicles; tr public.trips; mine public.trips; stale record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select a.type into last_type from public.attendance a
   where a.staff_id = uid and a.status is distinct from 'rejected'
     and a.type in ('check_in', 'check_out') and a.created_at >= day0
   order by a.created_at desc limit 1;
  if last_type is distinct from 'check_in' then raise exception 'not_checked_in'; end if;

  -- Машин бүрээр түгжинэ — зэрэг сонголтод 2-оос хэтрэхгүй.
  select * into v from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'vehicle_not_found'; end if;

  for stale in select id from public.trips
     where vehicle_id = v.id and status = 'active' and started_at < day0 loop
    perform public.finish_vehicle_trip(stale.id);
  end loop;

  select t.* into mine from public.trips t
   where t.status = 'active' and t.started_at >= day0
     and (t.driver_id = uid or exists (
       select 1 from public.trip_passengers p where p.trip_id = t.id and p.passenger_id = uid))
   order by t.started_at desc limit 1;
  if found then
    if mine.vehicle_id = v.id then
      return jsonb_build_object('trip_id', mine.id, 'already', true,
        'role', case when mine.driver_id = uid then 'driver' else 'passenger' end);
    end if;
    raise exception 'already_in_other:%', coalesce(mine.plate_number, '');
  end if;

  select coalesce(nullif(trim(name), ''), 'Ажилтан') into uname from public.profiles where id = uid;

  select * into tr from public.trips
   where vehicle_id = v.id and status = 'active' and started_at >= day0
   order by started_at desc limit 1;

  if not found then
    insert into public.trips(vehicle_id, plate_number, driver_id, driver_name, status)
    values (v.id, v.plate_number, uid, uname, 'active') returning * into tr;
    update public.vehicles set driver_id = uid, driver_name = uname where id = v.id;
    insert into public.vehicle_logs(vehicle_id, plate_number, code, user_id, user_name, event)
    values (v.id, v.plate_number, v.code, uid, uname, 'trip_start');
    return jsonb_build_object('trip_id', tr.id, 'role', 'driver');
  end if;

  select 1 + count(*) into members from public.trip_passengers where trip_id = tr.id;
  if members >= 2 then raise exception 'vehicle_full'; end if;

  insert into public.trip_passengers(trip_id, passenger_id, passenger_name) values (tr.id, uid, uname);
  insert into public.vehicle_logs(vehicle_id, plate_number, code, user_id, user_name, event)
  values (v.id, v.plate_number, v.code, uid, uname, 'scan');
  return jsonb_build_object('trip_id', tr.id, 'role', 'passenger');
end $$;

-- Өнөөдрийн машин бүрийн баг (сонгох жагсаалтад хэдэн хүн сонгосныг харуулна).
create or replace function public.vehicle_crews_today()
returns table(vehicle_id uuid, trip_id uuid, members jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.vehicle_id, t.id,
         jsonb_build_array(jsonb_build_object('id', t.driver_id, 'name', t.driver_name, 'role', 'driver'))
         || coalesce((select jsonb_agg(jsonb_build_object('id', p.passenger_id, 'name', p.passenger_name, 'role', 'passenger')
                                       order by p.scanned_at)
                      from public.trip_passengers p where p.trip_id = t.id), '[]'::jsonb)
  from public.trips t
  where t.status = 'active' and t.started_at >= public.ub_day_start() and t.vehicle_id is not null;
$$;

-- Явснаа бүртгүүлэхэд: км шинэчилнэ, бүх гишүүн явсан бол аяллыг хаана.
-- Ирцийн бүртгэлийг ХЭЗЭЭ Ч унагахгүй — алдааг залгина.
create or replace function public.attendance_vehicle_checkout()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare tr record; still_in boolean;
begin
  if new.type <> 'check_out' or new.status is not distinct from 'rejected' then return new; end if;
  begin
    for tr in
      select t.id, t.started_at from public.trips t
       where t.status = 'active'
         and (t.driver_id = new.staff_id or exists (
           select 1 from public.trip_passengers p where p.trip_id = t.id and p.passenger_id = new.staff_id))
    loop
      select exists (
        select 1 from (
          select t.driver_id as uid from public.trips t where t.id = tr.id
          union select p.passenger_id from public.trip_passengers p where p.trip_id = tr.id
        ) m
        where m.uid is not null and (
          select a.type from public.attendance a
           where a.staff_id = m.uid and a.status is distinct from 'rejected'
             and a.type in ('check_in', 'check_out') and a.created_at >= tr.started_at
           order by a.created_at desc limit 1
        ) is distinct from 'check_out'
      ) into still_in;
      if still_in then
        update public.trips set distance_km = public.vehicle_trip_distance_km(tr.id) where id = tr.id;
      else
        perform public.finish_vehicle_trip(tr.id);
      end if;
    end loop;
  exception when others then
    raise warning 'attendance_vehicle_checkout: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists attendance_vehicle_checkout on public.attendance;
create trigger attendance_vehicle_checkout after insert or update of type, status on public.attendance
  for each row execute function public.attendance_vehicle_checkout();

revoke all on function public.vehicle_trip_distance_km(uuid) from public, anon;
revoke all on function public.finish_vehicle_trip(uuid) from public, anon, authenticated;
revoke all on function public.join_vehicle_today(uuid) from public, anon;
revoke all on function public.vehicle_crews_today() from public, anon;
grant execute on function public.vehicle_trip_distance_km(uuid) to authenticated;
grant execute on function public.join_vehicle_today(uuid) to authenticated;
grant execute on function public.vehicle_crews_today() to authenticated;
revoke all on function public.close_stale_vehicle_trips() from public, anon;
grant execute on function public.close_stale_vehicle_trips() to authenticated;

commit;
