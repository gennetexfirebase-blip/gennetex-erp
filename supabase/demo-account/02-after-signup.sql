-- ══════════════════════════════════════════════════════════════════
-- DEMO ДАНС · 2-Р АЛХАМ (нэвтрэх данс үүсгэсний ДАРАА)
--
-- ЗОРИЛГО:
--   Шинжээч нэвтрэхэд апп ХООСОН харагдвал "энэ юу хийдэг апп бэ"
--   гэсэн эргэлзээ төрж, татгалзах эрсдэл нэмэгдэнэ. Тиймээс сүүлийн
--   14 хоногийн ирц, ирэх долоо хоногийн ээлжийг хуурамгаар үүсгэнэ.
--
-- ⚠️ Энэ скриптийг Dashboard дээр хэрэглэгч үүсгэсний ДАРАА
--    ажиллуулна — тэр үед л `profiles` мөр үүсч, id нь мэдэгдэнэ.
--
-- ⚠️ `attendance.staff_id` нь uuid БИШ, TEXT. Шууд uuid-гаар
--    харьцуулбал "operator does not exist" гэж унана.
--
-- Дахин ажиллуулж болно — өмнөх demo өгөгдлийг эхэлж цэвэрлэнэ.
-- ══════════════════════════════════════════════════════════════════

do $$
declare
  demo_id   uuid;
  demo_name text;
  d         date;
  i         int;
begin
  select p.id, p.name || ' ' || coalesce(p.last_name, '')
    into demo_id, demo_name
  from public.profiles p
  where p.email = 'demo.review@gennetex.mn';

  if demo_id is null then
    raise exception
      'Demo профайл олдсонгүй. Эхлээд Supabase Dashboard → Authentication → Users → Add user дээр demo.review@gennetex.mn үүсгэнэ үү.';
  end if;

  -- ── Хуучин demo өгөгдлийг цэвэрлэх ─────────────────────────────
  delete from public.attendance      where staff_id = demo_id::text;
  delete from public.employee_shifts where user_id  = demo_id;

  -- ── Сүүлийн 14 хоногийн ирц ────────────────────────────────────
  -- Бямба, ням гаригийг алгасана — бодит хуваарь шиг харагдана.
  for i in 1..14 loop
    d := current_date - i;
    continue when extract(isodow from d) in (6, 7);

    -- Ирсэн: 08:52–09:08 хооронд
    insert into public.attendance (
      staff_id, staff_name, type, latitude, longitude,
      status, is_remote, distance_m, location_name, created_at
    ) values (
      demo_id::text, demo_name, 'check_in',
      47.918700, 106.917400,
      'approved', false, 12 + (i * 7) % 30, 'Төв оффис',
      d + time '08:52' + ((i * 97) % 16) * interval '1 minute'
    );

    -- Явсан: 18:00–18:25 хооронд
    insert into public.attendance (
      staff_id, staff_name, type, latitude, longitude,
      status, is_remote, distance_m, location_name, created_at
    ) values (
      demo_id::text, demo_name, 'check_out',
      47.918700, 106.917400,
      'approved', false, 9 + (i * 11) % 25, 'Төв оффис',
      d + time '18:00' + ((i * 53) % 26) * interval '1 minute'
    );
  end loop;

  -- ── Нэг удаагийн ЗАЙНААС бүртгэл ───────────────────────────────
  -- Шинжээч "зайнаас ирсэн" урсгал болон түүний зөвшөөрлийн
  -- төлөвийг харах боломжтой болно.
  insert into public.attendance (
    staff_id, staff_name, type, latitude, longitude,
    status, is_remote, distance_m, note, location_name, created_at
  ) values (
    demo_id::text, demo_name, 'check_in',
    47.905200, 106.883100,
    'approved', true, 1840, 'Талбар дээр ажиллав', 'Барилгын талбар',
    current_date - 3 + time '09:05'
  );

  -- ── Ирэх долоо хоногийн ээлж ───────────────────────────────────
  for i in 0..6 loop
    d := current_date + i;
    continue when extract(isodow from d) in (6, 7);
    insert into public.employee_shifts (
      user_id, user_name, shift_date, start_time, end_time, note, created_by
    ) values (
      demo_id, demo_name, d, '09:00', '18:00', 'Demo хуваарь', demo_id
    );
  end loop;

  raise notice 'Demo өгөгдөл бэлэн: % (%)', demo_name, demo_id;
end $$;

-- ── Шалгалт ──────────────────────────────────────────────────────
select
  (select count(*) from public.attendance
     where staff_id = (select id::text from public.profiles
                       where email = 'demo.review@gennetex.mn')) as ирц,
  (select count(*) from public.employee_shifts
     where user_id = (select id from public.profiles
                      where email = 'demo.review@gennetex.mn')) as ээлж;
