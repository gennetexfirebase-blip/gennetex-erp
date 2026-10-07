-- Ирэх цагийн байгууллагын нэгдсэн дүрэм:
-- 09:00 хүртэл цагтаа, 09:01-ээс хоцорсонд тооцно.

update public.employee_shifts
   set start_time = '09:00'
 where start_time is distinct from '09:00';

create or replace function public.compute_attendance_status(
  p_check_in    timestamptz,
  p_check_out   timestamptz,
  p_shift_start text,
  p_shift_end   text,
  p_tz          text default 'Asia/Ulaanbaatar'
)
returns table (
  late_minutes int,
  early_leave_minutes int,
  worked_minutes int,
  status text
)
language plpgsql
stable
as $$
declare
  d date;
  expected_start timestamptz;
  expected_end   timestamptz;
  late int := 0;
  early int := 0;
  worked int := null;
  st text;
begin
  d := coalesce(
    (p_check_in at time zone p_tz)::date,
    (p_check_out at time zone p_tz)::date,
    (now() at time zone p_tz)::date
  );

  -- Ирсэн хүн бүрт 09:00 босго үйлчилнэ. Харин p_shift_start нь тухайн
  -- өдөр ажиллах хуваарьтай эсэхийг ялгахад доор хэрэглэгдэнэ.
  expected_start := (d::text || ' 09:00')::timestamp at time zone p_tz;

  if p_shift_end is not null and p_shift_end <> '' then
    expected_end := (d::text || ' ' || p_shift_end)::timestamp at time zone p_tz;
  end if;

  -- Секундын зөрөөгөөр буруу хоцролт үүсгэхгүй: 09:00:59 хүртэл цагтаа,
  -- 09:01:00-ээс эхлэн нэг минут хоцорсонд тооцно.
  if p_check_in is not null and p_check_in >= expected_start + interval '1 minute' then
    late := floor(extract(epoch from (p_check_in - expected_start)) / 60)::int;
  end if;

  if p_check_out is not null and expected_end is not null and p_check_out < expected_end then
    early := round(extract(epoch from (expected_end - p_check_out)) / 60)::int;
  end if;

  if p_check_in is not null and p_check_out is not null then
    worked := round(extract(epoch from (p_check_out - p_check_in)) / 60)::int;
  end if;

  if p_check_in is null then
    if p_shift_start is null or p_shift_start = '' then
      st := 'not_scheduled';
    else
      st := 'absent';
    end if;
  elsif late > 0 then
    st := 'late';
  elsif early > 0 then
    st := 'early_leave';
  else
    st := 'on_time';
  end if;

  return query select late, early, worked, st;
end;
$$;

grant execute on function public.compute_attendance_status(
  timestamptz, timestamptz, text, text, text
) to authenticated;

comment on function public.compute_attendance_status(timestamptz, timestamptz, text, text, text) is
  'Ирэх цаг 09:00; 09:01-ээс хоцорсон гэж тооцдог нэгдсэн ирцийн дүрэм.';
