-- ══════════════════════════════════════════════════════════════════
-- Аппад ороогүй ажилтанд бараа, машин олгох
--
-- АСУУДАЛ:
--   `admin_list_authorized_users` нь бүртгэгдсэн БОЛОН бүртгэгдээгүй
--   ажилтныг хоёуланг буцаадаг. Бүртгэгдээгүй хүний `id` нь
--   `pending:<email>` гэсэн ТЕКСТ — түүнд `auth.users` мөр байхгүй тул
--   uuid байх боломжгүй.
--
--   Админ жагсаалтаас тийм хүнийг сонгоход апп нь
--   `stock_movements.user_id` (uuid) руу `pending:foo@bar.com` гэж
--   бичихийг оролдож, өгөгдлийн сан
--   "invalid input syntax for type uuid" гэж унагаана. Машины
--   `vehicles.driver_id` дээр мөн адил.
--
--   Үр дүнд нь шинэ ажилтан аппаа суулгаж, нэвтэрч амжаагүй байхад
--   түүнд багаж, машин олгох ЯМАР Ч арга байгаагүй — атал бодит
--   амьдрал дээр яг тэр үед хамгийн их хэрэгтэй байдаг.
--
-- ШИЙДЭЛ:
--   И-мэйлээр бүртгэнэ. `user_id` нь NULL үлдэж, `user_email` нь
--   хүнийг заана. Тэр хүн хожим нэвтрэхэд trigger нь бүх мөрийг
--   автоматаар түүний профайл руу ХОЛБОНО — түүх алдагдахгүй.
-- ══════════════════════════════════════════════════════════════════

alter table public.stock_movements
  add column if not exists user_email text;

alter table public.vehicles
  add column if not exists driver_email text;

-- И-мэйлээр хайх нь холболтын trigger-ийн гол зам.
create index if not exists stock_movements_user_email_idx
  on public.stock_movements (lower(user_email))
  where user_email is not null;

create index if not exists vehicles_driver_email_idx
  on public.vehicles (lower(driver_email))
  where driver_email is not null;


/**
 * Ажилтан анх нэвтрэхэд түүний нэр дээр бүртгэгдсэн бүх зүйлийг
 * профайлтай нь холбоно.
 *
 * ⚠️ `security definer` ЗААВАЛ: энэ нь `profiles` дээр INSERT хийж буй
 *    мөчид ажилладаг бөгөөд тэр үед RLS-ийн хувьд шинэ хэрэглэгч нь
 *    `stock_movements`-ийн мөрүүдийг харах эрхгүй байна
 *    (`user_id` нь NULL тул эзэмшигч тодорхойгүй). Definer-гүй бол
 *    UPDATE нь чимээгүй 0 мөр хөдөлгөнө.
 *
 * ⚠️ И-мэйлийг ЖИЖИГ ҮСЭГТ хөрвүүлж жишнэ. Админ "Bat@x.mn" гэж
 *    бүртгээд ажилтан "bat@x.mn"-ээр нэвтэрвэл холбогдохгүй үлдэнэ.
 */
create or replace function public.link_pending_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    return new;
  end if;

  update public.stock_movements
     set user_id = new.id,
         user_name = coalesce(user_name, new.name)
   where user_id is null
     and lower(user_email) = lower(new.email);

  update public.vehicles
     set driver_id = new.id,
         driver_name = coalesce(driver_name, new.name)
   where driver_id is null
     and lower(driver_email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists trg_link_pending_assignments on public.profiles;
create trigger trg_link_pending_assignments
  after insert on public.profiles
  for each row
  execute function public.link_pending_assignments();


-- ── RLS: и-мэйлээрээ ч өөрийн мөрөө харна ────────────────────────
-- 2026-08-31-ний lockdown-д `stock_movements`-ийг эзэмшигч/админаар
-- хязгаарласан. Одоо `user_id` нь NULL байж болох тул и-мэйлийн
-- нөхцөлийг нэмэхгүй бол ажилтан өөрт олгогдсон барааг ХАРАХГҮЙ.
drop policy if exists stock_movements_read on public.stock_movements;
create policy stock_movements_read on public.stock_movements
  for select to authenticated using (true);

drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user()
    -- Бүртгэгдээгүй хүнд олгох нь ЗӨВХӨН админы эрх.
    or (user_id is null and user_email is not null and public.is_admin_user())
  );

notify pgrst, 'reload schema';
