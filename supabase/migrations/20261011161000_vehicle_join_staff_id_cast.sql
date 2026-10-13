-- Ирц бүртгэсний дараа машин сонгоход «operator does not exist: text = uuid» алдаа.
-- attendance.staff_id нь text, auth.uid() нь uuid — харьцуулалтад cast нэмэв.
-- attendance_vehicle_checkout trigger-т мөн ижил алдаа байсан (алдааг залгидаг
-- тул явснаа бүртгүүлэхэд аялал хаагддаггүй байв).

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
   where a.staff_id = uid::text and a.status is distinct from 'rejected'
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


create or replace function public.attendance_vehicle_checkout()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare tr record; still_in boolean;
begin
  if new.type <> 'check_out' or new.status is not distinct from 'rejected' then return new; end if;
  begin
    for tr in
      select t.id, t.started_at from public.trips t
       where t.status = 'active'
         and (t.driver_id::text = new.staff_id or exists (
           select 1 from public.trip_passengers p where p.trip_id = t.id and p.passenger_id::text = new.staff_id))
    loop
      select exists (
        select 1 from (
          select t.driver_id as uid from public.trips t where t.id = tr.id
          union select p.passenger_id from public.trip_passengers p where p.trip_id = tr.id
        ) m
        where m.uid is not null and (
          select a.type from public.attendance a
           where a.staff_id = m.uid::text and a.status is distinct from 'rejected'
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


notify pgrst, 'reload schema';
