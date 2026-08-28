-- Машины түлшний түвшин 0%-аас эхэлнэ.
--
-- ⚠️ АСУУДАЛ: `fuel_level_percent` нь 100 гэсэн анхдагчтай байв. Систем
--    машины савны бодит түлшийг МЭДЭХГҮЙ мөртлөө "дүүрэн" гэж
--    таамагладаг байлаа. Үр дагавар нь:
--      • цэнэглэхэд 100 + 22 → 100 дээр таслагдаж, авсан түлш алга
--        болно;
--      • дэлгэц дээр бүх машин 100% харагдаж, бодит зураг өгөхгүй.
--
--    Зөв зам: 0-ээс эхэлж, ЗӨВХӨН бүртгэгдсэн цэнэглэлтээр нэмэгдэж,
--    явсан замаар буурна. Ингэснээр харагдаж буй хувь нь системд
--    бодитоор мэдэгдэж буй түлшийг илэрхийлнэ.

alter table public.vehicles
  alter column fuel_level_percent set default 0;

-- Одоо байгаа машинуудын хуурамч 100%-ийг цэвэрлэнэ.
--
-- Мөнгөн дүнтэй (шинэ журмаар) хийгдсэн СҮҮЛИЙН цэнэглэлт байвал
-- түүний литрээр, эс бөгөөс 0-ээр тавина. Хуучин "100% болгох"
-- бүртгэлүүд нь литр, мөнгөгүй тул тооцоонд оруулах утгагүй.
update public.vehicles v
set fuel_level_percent = coalesce(
  (
    select least(100, round((l.liters / nullif(v.tank_capacity_liters, 0)) * 100, 1))
      from public.vehicle_logs l
     where l.vehicle_id = v.id
       and l.event = 'refuel'
       and l.price_per_liter is not null   -- зөвхөн шинэ журмынх
     order by l.created_at desc
     limit 1
  ),
  0
);

-- Цэнэглэлтгүй машины "цэнэглэсэн огноо" нь утгагүй — арилгана.
-- Эс бөгөөс дэлгэц дээр "08-09-нд цэнэглэсэн" гэж худал харагдана.
update public.vehicles v
set fuel_refilled_at = null
where not exists (
  select 1 from public.vehicle_logs l
   where l.vehicle_id = v.id
     and l.event = 'refuel'
     and l.price_per_liter is not null
);

notify pgrst, 'reload schema';
