-- ============================================================================
-- CRITICAL: Эрх хулгайлах (privilege escalation) нүхийг хаах
-- ============================================================================
--
-- АСУУДАЛ:
--   `profiles_self_update` policy нь ингэж бичигдсэн байв:
--
--     for update using (auth.uid() = id) with check (auth.uid() = id)
--
--   PostgreSQL-ийн RLS нь МӨР түвшинд ажилладаг, БАГАНА түвшинд БИШ.
--   Тиймээс энэ policy нь хэрэглэгчид өөрийн мөрийн БҮХ баганыг —
--   `role`-ыг оруулаад — өөрчлөхийг зөвшөөрч байсан.
--
--   Дурын ажилтан өөрийн JWT-ээр дараахыг илгээхэд:
--       PATCH /rest/v1/profiles?id=eq.<өөрийн-id>   {"role":"zahiral"}
--   захирлын эрх авч, бүх ажилтны байршил, цалин, ирц рүү нэвтэрч байв.
--
--   Байсан ганц хамгаалалт (`protect_superadmin_profile` trigger) нь
--   ЗӨВХӨН `superadmin` утгыг хаадаг байсан тул `admin`, `zahiral`,
--   `ahlah`, `nyrav` бүгд чөлөөтэй авагдана.
--
--   Клиент дэх `employeeAllowed` цагаан жагсаалт (AppContext.js) нь
--   ЗӨВХӨН UI-д нөлөөлдөг — REST API-г шууд дуудахад огт саад болохгүй.
--
-- ШИЙДЭЛ:
--   Хамгаалагдсан баганууд өөрчлөгдөхийг trigger дээр хаана. Trigger нь
--   RLS-ээс ХОЙШ, багана бүр дээр ажилладаг тул энэ нь зөв давхарга.
--
--   Мөн ЗӨВХӨН хаахгүй — эрхгүй хүн өөрчлөхийг оролдвол хуучин утгыг
--   нь эргүүлж тавина (чимээгүй үл тоомсорлох). Ингэснээр хууль ёсны
--   `updateMyProfile` дуудлага (нэр, зураг зэрэг зөвшөөрөгдсөн талбар
--   агуулсан) алдаагүй үргэлжилнэ.
-- ============================================================================

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_rank int;
begin
  select p.role into actor_role from public.profiles p where p.id = auth.uid();
  actor_rank := public.role_rank(actor_role);

  -- ── 1. Өөрийн ROLE-ыг хэн ч өөрчилж болохгүй ────────────────────────
  -- Админ ч гэсэн ӨӨРИЙГӨӨ дэвшүүлж болохгүй — эс тэгвээс admin →
  -- zahiral → superadmin гэж дээшлэх зам нээлттэй үлдэнэ.
  if new.role is distinct from old.role and new.id = auth.uid() then
    new.role := old.role;
  end if;

  -- ── 2. БУСДЫН role-ыг зөвхөн admin+ өөрчилнө, өөрөөсөө доош ─────────
  if new.role is distinct from old.role and new.id <> auth.uid() then
    if actor_rank < 3 then
      raise exception 'role_change_denied';
    end if;
    -- Өөрөөсөө дээш эрх олгох боломжгүй
    if public.role_rank(new.role) >= actor_rank and actor_role <> 'superadmin' then
      raise exception 'cannot_grant_higher_role';
    end if;
  end if;

  -- ── 3. EMAIL-ийг хэрэглэгч өөрөө өөрчилж болохгүй ───────────────────
  -- `authorized_users.email` нь нэвтрэх эрхийн ТҮЛХҮҮР. Хэрэглэгч
  -- өөрийн email-ээ өөрчилвөл өөр хүний бүртгэлтэй холбогдох эрсдэлтэй.
  if new.email is distinct from old.email and actor_rank < 3 then
    new.email := old.email;
  end if;

  -- ── 4. must_change_password-ыг өөрөө арилгаж болохгүй ───────────────
  if new.must_change_password is distinct from old.must_change_password
     and new.id = auth.uid() and actor_rank < 3 then
    new.must_change_password := old.must_change_password;
  end if;

  return new;
end;
$$;

-- Дараалал чухал: энэ trigger нь superadmin хамгаалалтаас ӨМНӨ ажиллах
-- ёсгүй. PostgreSQL нь ижил үеийн trigger-ийг НЭРЭЭР нь цагаан толгойн
-- дарааллаар ажиллуулдаг тул нэрийг `a_`-аар эхлүүлж эхэнд байлгав —
-- ингэснээр role-ыг эргүүлж тавьсны дараа superadmin шалгалт зөв утга
-- дээр ажиллана.
drop trigger if exists a_protect_profile_columns on public.profiles;
create trigger a_protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Ирц: нэг өдөрт нэг л удаа ирсэн/явсан
-- ---------------------------------------------------------------------------
-- Давхар дарах, сүлжээ удаашрахад хоёр мөр үүсэх боломжтой байв. Клиент
-- талын `busy` туг нь хоёр төхөөрөмжөөс зэрэг илгээхээс хамгаалахгүй.
-- Индексийн илэрхийлэл нь нэмэлт хаалт шаардана — `::` cast нь хаалтгүй
-- үед индексийн синтакстай зөрчилдөнө.
create unique index if not exists attendance_one_per_day_idx
  on public.attendance (
    staff_id,
    type,
    (((created_at at time zone 'Asia/Ulaanbaatar'))::date)
  )
  where staff_id is not null and status <> 'rejected';
