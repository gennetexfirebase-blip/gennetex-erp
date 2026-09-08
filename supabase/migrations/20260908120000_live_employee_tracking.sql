begin;

create table public.current_locations (
  employee_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  accuracy double precision check(accuracy between 0 and 100),
  speed double precision check(speed between 0 and 80),
  heading double precision check(heading >= 0 and heading < 360),
  battery integer check(battery between 0 and 100),
  timestamp bigint not null,
  online boolean not null default true
);
create table public.location_history (
  employee_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  timestamp bigint not null,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  accuracy double precision,
  speed double precision,
  heading double precision,
  battery integer,
  primary key(employee_id, day, timestamp)
);
create index location_history_retention_idx on public.location_history(day);
create index if not exists attendance_tracking_session_idx on public.attendance(staff_id, created_at desc);
alter table public.current_locations enable row level security;
alter table public.location_history enable row level security;
create policy tracking_admin_current on public.current_locations for select to authenticated using(public.is_admin_user());
create policy tracking_admin_history on public.location_history for select to authenticated using(public.is_admin_user());
revoke all on public.current_locations, public.location_history from anon, authenticated;
grant select on public.current_locations, public.location_history to authenticated;

create function public.tracking_distance(a_lat float8, a_lng float8, b_lat float8, b_lng float8)
returns float8 language sql immutable strict set search_path = public as $$
  select 12742000 * asin(sqrt(least(1.0, greatest(0.0,
    power(sin(radians(b_lat-a_lat)/2),2) + cos(radians(a_lat))*cos(radians(b_lat))*power(sin(radians(b_lng-a_lng)/2),2)))));
$$;

-- The caller never supplies an employee ID. Identity comes only from auth.uid().
-- Serialize each employee's writes; late offline uploads only add historical points.
create function public.ingest_employee_location(p jsonb)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid(); ts bigint := (p->>'timestamp')::bigint;
  lat float8 := (p->>'latitude')::float8; lng float8 := (p->>'longitude')::float8;
  acc float8 := (p->>'accuracy')::float8; sp float8 := (p->>'speed')::float8;
  hd float8 := (p->>'heading')::float8; bat integer := (p->>'battery')::integer;
  at_time timestamptz; route_day date; event_type text; prev public.location_history;
  nxt public.location_history; cur public.current_locations; is_working boolean;
begin
  if uid is null then raise insufficient_privilege; end if;
  if p->>'employee_id' is distinct from uid::text then raise insufficient_privilege; end if;
  if ts is null or lat is null or lng is null or not(lat between -90 and 90) or not(lng between -180 and 180)
    or (acc is not null and not(acc between 0 and 100)) or (sp is not null and not(sp between 0 and 80))
    or (hd is not null and not(hd >= 0 and hd < 360)) or (bat is not null and not(bat between 0 and 100)) then return 'invalid'; end if;
  at_time := to_timestamp(ts / 1000.0);
  if at_time < now()-interval '7 days' or at_time > now()+interval '60 seconds' then return 'expired'; end if;
  route_day := (at_time at time zone 'Asia/Ulaanbaatar')::date;
  select type into event_type from public.attendance where staff_id::text = uid::text
    and status is distinct from 'rejected' and created_at <= at_time
    and created_at >= at_time - interval '24 hours' and type in ('check_in','check_out')
    order by created_at desc, case when type='check_out' then 1 else 0 end desc limit 1;
  if event_type is distinct from 'check_in' then return 'outside-session'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select * into cur from public.current_locations where employee_id=uid;
  select * into prev from public.location_history where employee_id=uid and day=route_day and timestamp<ts order by timestamp desc limit 1;
  select * into nxt from public.location_history where employee_id=uid and day=route_day and timestamp>ts order by timestamp limit 1;
  if prev.timestamp is not null and public.tracking_distance(prev.latitude,prev.longitude,lat,lng) > (ts-prev.timestamp)/1000.0*80+coalesce(acc,0)+coalesce(prev.accuracy,0)+10 then return 'implausible'; end if;
  if nxt.timestamp is not null and public.tracking_distance(nxt.latitude,nxt.longitude,lat,lng) > (nxt.timestamp-ts)/1000.0*80+coalesce(acc,0)+coalesce(nxt.accuracy,0)+10 then return 'implausible'; end if;
  if cur.timestamp is not null and ts>cur.timestamp and public.tracking_distance(cur.latitude,cur.longitude,lat,lng) > (ts-cur.timestamp)/1000.0*80+coalesce(acc,0)+coalesce(cur.accuracy,0)+10 then return 'implausible'; end if;
  if prev.timestamp is null or public.tracking_distance(prev.latitude,prev.longitude,lat,lng) >= greatest(5,least(20,coalesce(acc,0))) then
    insert into public.location_history values(uid,route_day,ts,lat,lng,acc,sp,hd,bat) on conflict do nothing;
  end if;
  select type='check_in' into is_working from public.attendance where staff_id::text=uid::text
    and status is distinct from 'rejected' and created_at<=now() and created_at>=now()-interval '24 hours'
    and type in ('check_in','check_out') order by created_at desc,case when type='check_out' then 1 else 0 end desc limit 1;
  insert into public.current_locations values(uid,lat,lng,acc,sp,hd,bat,ts,coalesce(is_working,false))
    on conflict(employee_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,
      accuracy=excluded.accuracy,speed=excluded.speed,heading=excluded.heading,battery=excluded.battery,timestamp=excluded.timestamp,
      online=excluded.online where excluded.timestamp > current_locations.timestamp;
  -- Preserve legacy maps without letting delayed GPS overwrite their current position.
  update public.profiles set latitude=lat,longitude=lng,last_seen=at_time where id=uid and (last_seen is null or last_seen<at_time);
  delete from public.location_history where employee_id=uid and day < (now() at time zone 'Asia/Ulaanbaatar')::date-30;
  return 'accepted';
end;
$$;
revoke all on function public.ingest_employee_location(jsonb) from public, anon;
grant execute on function public.ingest_employee_location(jsonb) to authenticated;

create function public.ingest_employee_locations(points jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare point jsonb;
begin
  if jsonb_typeof(points) <> 'array' or jsonb_array_length(points)>100 then raise exception 'Maximum 100 points per batch'; end if;
  for point in select value from jsonb_array_elements(points) loop
    perform public.ingest_employee_location(point);
  end loop;
end; $$;
revoke all on function public.ingest_employee_locations(jsonb) from public,anon;
grant execute on function public.ingest_employee_locations(jsonb) to authenticated;

create function public.stop_employee_tracking() returns void language sql security definer set search_path=public,pg_temp as $$
  update public.current_locations set online=false where employee_id=auth.uid();
$$;
revoke all on function public.stop_employee_tracking() from public, anon;
grant execute on function public.stop_employee_tracking() to authenticated;

-- Also stop presence immediately when attendance is ended from another client.
create function public.attendance_stop_tracking() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.type='check_out' and new.status is distinct from 'rejected' then
    perform pg_advisory_xact_lock(hashtextextended(new.staff_id::text, 0));
    update public.current_locations set online=false where employee_id::text=new.staff_id::text and timestamp <= extract(epoch from new.created_at)*1000;
  end if;
  return new;
end; $$;
create trigger attendance_tracking_checkout after insert or update on public.attendance for each row execute function public.attendance_stop_tracking();

alter publication supabase_realtime add table public.current_locations;
alter publication supabase_realtime add table public.location_history;

-- Daily retention includes inactive employees. Existing pg_cron installations are reused.
create function public.prune_employee_tracking() returns void language sql security definer set search_path=public,pg_temp as $$
  delete from public.location_history where day < (now() at time zone 'Asia/Ulaanbaatar')::date-30;
$$;
revoke all on function public.prune_employee_tracking() from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('employee-tracking-retention','17 18 * * *','select public.prune_employee_tracking()');
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
