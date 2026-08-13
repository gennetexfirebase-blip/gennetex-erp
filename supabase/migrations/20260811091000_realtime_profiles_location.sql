-- ============================================================================
-- Байршлыг real-time болгох
-- ============================================================================
--
-- Supabase Realtime нь ЗӨВХӨН `supabase_realtime` publication-д нэмэгдсэн
-- хүснэгтийн өөрчлөлтийг дамжуулдаг. Хүснэгт тэнд байхгүй бол клиент
-- `postgres_changes`-д бүртгүүлж, ямар ч АЛДАА ГАРГАЛГҮЙ чимээгүй хүлээж
-- суудаг — хамгийн муу төрлийн эвдрэл: юу ч болохгүй, шалтгаан нь ч
-- харагдахгүй.
--
-- Тиймээс admin-web-ийн шууд байршлын газрын зураг ажиллахын тулд
-- `profiles` заавал энд байх ёстой.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication олдсонгүй — алгасав';
    return;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    raise notice 'profiles аль хэдийн realtime-д бий';
  else
    alter publication supabase_realtime add table public.profiles;
    raise notice 'profiles -> supabase_realtime нэмэгдлээ';
  end if;
end;
$$;

-- Дуудлагын хүснэгт ч мөн адил — CallProvider нь `calls`-ийн INSERT/UPDATE-г
-- сонсдог. Realtime-д байхгүй бол дуудлага зөвхөн push-аар ирнэ (апп
-- нээлттэй байхад ч удаан).
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach t in array array['calls', 'attendance', 'location_logs']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice '% -> supabase_realtime нэмэгдлээ', t;
    end if;
  end loop;
end;
$$;
