-- category багана баталгаажуулах
  alter table public.inventory add column if not exists category text default 'material';
  -- Бараа материал (category = 'material')
  insert into public.inventory (name, unit, quantity, price, barcode, category) values
    ('Router (чиглүүлэгч)', 'ширхэг', 25, 145000, '4820000000017', 'material'),
    ('Switch 8 порт', 'ширхэг', 18, 210000, '4820000000024', 'material'),
    ('Оптик кабель', 'метр', 1500, 1200, '4820000000031', 'material'),
    ('UTP кабель Cat6', 'метр', 2000, 900, '4820000000048', 'material'),
    ('RJ45 холбогч', 'ширхэг', 500, 500, '4820000000055', 'material'),
    ('ONU төхөөрөмж', 'ширхэг', 40, 95000, '4820000000062', 'material'),
    ('Access Point (WiFi)', 'ширхэг', 12, 320000, '4820000000079', 'material'),
    ('Медиа конвертер', 'ширхэг', 30, 65000, '4820000000086', 'material'),
    ('Патч панель 24 порт', 'ширхэг', 8, 180000, '4820000000093', 'material'),
    ('Оптик патч корд', 'ширхэг', 100, 8000, '4820000000109', 'material')
  on conflict do nothing;
  -- Багаж (category = 'tool')
  insert into public.inventory (name, unit, quantity, price, barcode, category) values
    ('Fast connector', 'ширхэг', 15, 45000, '4820000000116', 'tool'),
    ('Кабель тестер (LAN)', 'ширхэг', 10, 85000, '4820000000123', 'tool'),
    ('Оптик fusion splicer', 'ширхэг', 2, 3500000, '4820000000130', 'tool'),
    ('Оптик cleaver', 'ширхэг', 3, 250000, '4820000000147', 'tool'),
    ('OTDR хэмжигч', 'ширхэг', 2, 4200000, '4820000000154', 'tool'),
    ('Power meter (оптик)', 'ширхэг', 4, 320000, '4820000000161', 'tool'),
    ('Утас хусагч (stripper)', 'ширхэг', 20, 25000, '4820000000178', 'tool'),
    ('Шурагd эргүүлэгч багц', 'багц', 12, 55000, '4820000000185', 'tool'),
    ('Цахилгаан өрөм', 'ширхэг', 5, 180000, '4820000000192', 'tool'),
    ('Шат (2м)', 'ширхэг', 6, 120000, '4820000000208', 'tool')
  on conflict do nothing;

  