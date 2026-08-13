-- ============================================================================
-- Давхар хамгаалалт: багана түвшний UPDATE эрх
-- ============================================================================
--
-- Өмнөх migration нь trigger-ээр `role`/`email` өөрчлөлтийг хаасан.
-- Trigger бол сайн, гэхдээ ХАМГИЙН ГАДНА давхарга нь GRANT юм:
--
--   GRANT    → PostgreSQL шууд татгалзана (RLS, trigger хүрэхгүй)
--   RLS      → мөр сонгоно
--   TRIGGER  → утга шалгана
--
-- Багана түвшний grant-ыг ямар ч policy, ямар ч trigger алдаа тойрч
-- чадахгүй. Тиймээс `role` болон `email`-ийг ЖАГСААЛТААС хасна.
--
-- ЯАГААД ЭНЭ НЬ ЮУГ Ч ЭВДЭХГҮЙ ВЭ:
--   Админ ролийг `admin_set_user_role` RPC-ээр солидог (authService.js:268).
--   `security definer` функц нь эзэмшигчийн эрхээр ажилладаг тул багана
--   түвшний хязгаарлалт түүнд хамаарахгүй. Өөрөөр хэлбэл админы урсгал
--   хэвээр ажиллана, харин ШУУД table update хийх зам хаагдана.
-- ============================================================================

do $$
declare
  -- Хэрэглэгч ӨӨРӨӨ бичиж болохгүй баганууд
  protected text[] := array['id', 'role', 'email', 'created_at'];
  cols text;
begin
  -- Эхлээд бүх update эрхийг авна
  revoke update on public.profiles from authenticated;

  -- Дараа нь хамгаалагдаагүй баганууд дээр л буцааж олгоно.
  -- Багануудыг information_schema-аас уншиж байгаа шалтгаан: энэ хүснэгтэд
  -- цаг хугацааны явцад багана нэмэгдсэн (last_name, address, face_uuid,
  -- report_signature_url г.м). Гараар жагсаалт бичвэл шинэ багана
  -- санамсаргүй хаагдаж, апп эвдэрнэ.
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and not (column_name = any(protected));

  if cols is null then
    raise exception 'profiles хүснэгт олдсонгүй';
  end if;

  execute format('grant update (%s) on public.profiles to authenticated', cols);
  raise notice 'profiles: update эрх дараах баганууд дээр олгогдлоо — %', cols;
end;
$$;

-- ---------------------------------------------------------------------------
-- Шалгах хэрэгсэл
-- ---------------------------------------------------------------------------
-- Нүх дахин нээгдсэн эсэхийг хэдийд ч шалгах боломжтой байх ёстой.
-- Хариу `false` байвал хамгаалалт байрандаа.
create or replace function public.security_selfcheck()
returns table (check_name text, is_vulnerable boolean, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'profiles.role бичих эрх'::text,
    exists (
      select 1 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'role' and privilege_type = 'UPDATE'
        and grantee in ('authenticated', 'anon', 'PUBLIC')
    ),
    'authenticated role баганыг шууд бичиж чадах эсэх'::text
  union all
  select
    'profiles.email бичих эрх'::text,
    exists (
      select 1 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'email' and privilege_type = 'UPDATE'
        and grantee in ('authenticated', 'anon', 'PUBLIC')
    ),
    'email солиод өөр бүртгэлтэй холбогдох эрсдэл'::text
  union all
  select
    'role хамгаалах trigger'::text,
    not exists (
      select 1 from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and tgname = 'a_protect_profile_columns'
        and not tgisinternal
    ),
    'trigger байхгүй бол утга шалгагдахгүй'::text;
$$;

revoke execute on function public.security_selfcheck() from public, anon;
grant  execute on function public.security_selfcheck() to authenticated;
