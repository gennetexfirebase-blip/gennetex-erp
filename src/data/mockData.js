// Улаанбаатар хотыг төв болгосон жишээ өгөгдөл.
// Бодит систем дээр эдгээрийг backend (Firebase гэх мэт)-ээс татаж авна.

// Агуулах — Бараа материал (material) ба Багаж (tool)
export const INITIAL_INVENTORY = [
  // ---- Бараа материал ----
  { id: 'i1', name: 'Router (чиглүүлэгч)', unit: 'ширхэг', quantity: 25, price: 145000, barcode: '4820000000017', category: 'material'},
  { id: 'i2', name: 'Switch 8 порт', unit: 'ширхэг', quantity: 18, price: 210000, barcode: '4820000000024', category: 'material'},
  { id: 'i3', name: 'Оптик кабель', unit: 'метр', quantity: 1500, price: 1200, barcode: '4820000000031', category: 'material'},
  { id: 'i4', name: 'UTP кабель Cat6', unit: 'метр', quantity: 2000, price: 900, barcode: '4820000000048', category: 'material'},
  { id: 'i5', name: 'RJ45 холбогч', unit: 'ширхэг', quantity: 500, price: 500, barcode: '4820000000055', category: 'material'},
  { id: 'i6', name: 'ONU төхөөрөмж', unit: 'ширхэг', quantity: 40, price: 95000, barcode: '4820000000062', category: 'material'},
  { id: 'i7', name: 'Access Point (WiFi)', unit: 'ширхэг', quantity: 12, price: 320000, barcode: '4820000000079', category: 'material'},
  { id: 'i8', name: 'Медиа конвертер', unit: 'ширхэг', quantity: 30, price: 65000, barcode: '4820000000086', category: 'material'},
  { id: 'i9', name: 'Патч панель 24 порт', unit: 'ширхэг', quantity: 8, price: 180000, barcode: '4820000000093', category: 'material'},
  { id: 'i10', name: 'Оптик патч корд', unit: 'ширхэг', quantity: 100, price: 8000, barcode: '4820000000109', category: 'material'},
  { id: 'i11', name: 'Кабелийн суваг (кабель канал)', unit: 'метр', quantity: 800, price: 1500, barcode: '4820000000215', category: 'material'},
  { id: 'i12', name: 'Тэжээлийн адаптер 12V', unit: 'ширхэг', quantity: 60, price: 12000, barcode: '4820000000222', category: 'material'},
  { id: 'i13', name: 'Кабель боолт (стяжка)', unit: 'багц', quantity: 120, price: 3000, barcode: '4820000000239', category: 'material'},
  { id: 'i14', name: 'Дюбель + шураг багц', unit: 'багц', quantity: 90, price: 2500, barcode: '4820000000246', category: 'material'},
  { id: 'i15', name: 'Оптик адаптер (SC/UPC)', unit: 'ширхэг', quantity: 200, price: 3500, barcode: '4820000000253', category: 'material'},

  // ---- Багаж ----
  { id: 't1', name: 'Кримп хавчаар (RJ45)', unit: 'ширхэг', quantity: 15, price: 45000, barcode: '4820000000116', category: 'tool'},
  { id: 't2', name: 'Кабель тестер (LAN)', unit: 'ширхэг', quantity: 10, price: 85000, barcode: '4820000000123', category: 'tool'},
  { id: 't3', name: 'Оптик fusion splicer', unit: 'ширхэг', quantity: 2, price: 3500000, barcode: '4820000000130', category: 'tool'},
  { id: 't4', name: 'Оптик cleaver', unit: 'ширхэг', quantity: 3, price: 250000, barcode: '4820000000147', category: 'tool'},
  { id: 't5', name: 'OTDR хэмжигч', unit: 'ширхэг', quantity: 2, price: 4200000, barcode: '4820000000154', category: 'tool'},
  { id: 't6', name: 'Power meter (оптик)', unit: 'ширхэг', quantity: 4, price: 320000, barcode: '4820000000161', category: 'tool'},
  { id: 't7', name: 'Утас хусагч (stripper)', unit: 'ширхэг', quantity: 20, price: 25000, barcode: '4820000000178', category: 'tool'},
  { id: 't8', name: 'Шураг эргүүлэгч багц', unit: 'багц', quantity: 12, price: 55000, barcode: '4820000000185', category: 'tool'},
  { id: 't9', name: 'Цахилгаан өрөм', unit: 'ширхэг', quantity: 5, price: 180000, barcode: '4820000000192', category: 'tool'},
  { id: 't10', name: 'Шат (2м)', unit: 'ширхэг', quantity: 6, price: 120000, barcode: '4820000000208', category: 'tool'},
];

// Дуудлага өгсөн айлууд (Google Maps дээр харуулна)
// Дуудлагын төрлүүд (үнэ/ангилал)
export const CALL_TYPES = [
  { key: 'new', label: 'Шинэ айл', icon: '', color: '#22c55e'},
  { key: 't30', label: 'Шилжүүлэг 30k', icon: '', color: '#3b82f6'},
  { key: 't100', label: 'Шилжүүлэг 100k', icon: '', color: '#8b5cf6'},
  { key: 'gombol', label: 'Гомбол', icon: '', color: '#f59e0b'},
  { key: 'repair', label: 'Засвар', icon: '', color: '#06b6d4'},
  { key: 'other', label: 'Бусад', icon: '', color: '#64748b'},
];

export const INITIAL_CALLS = [];

// Ажилчид (жишээ). staffId=me гэдэг нь энэ утсыг барьж яваа ажилтан.
export const STAFF = [
  { id: 'me', name: 'Би (энэ төхөөрөмж)', color: '#3b82f6'},
  { id: 's2', name: 'Дорж', color: '#22c55e', latitude: 47.9105, longitude: 106.8830 },
  { id: 's3', name: 'Сүхээ', color: '#f59e0b', latitude: 47.9250, longitude: 106.9300 },
];

// Байгууллагын машинууд (Supabase байхгүй үеийн жишээ / QR fallback)
export const VEHICLES = [
  { id: 'v1', code: 'VH-001', plate_number: '1234 УБА', liters_per_100km: 12, driver_name: 'Дорж'},
  { id: 'v2', code: 'VH-002', plate_number: '5678 УНЯ', liters_per_100km: 9.5, driver_name: 'Сүхээ'},
  { id: 'v3', code: 'VH-003', plate_number: '9012 УБВ', liters_per_100km: 14, driver_name: null },
];

// Бензиний анхны тохиргоо (админ засна)
export const DEFAULT_FUEL_SETTINGS = {
  litersPer100km: 12,
  pricePerLiter: 2600,
  idleLitersPerHour: 1.2, // тогтмол зогссон үед цагт зарцуулах литр
};
