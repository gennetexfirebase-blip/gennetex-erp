/**
 * Demo горимын ХУУРАМЧ өгөгдөл.
 *
 * ЯАГААД БҮРЭН ХУУРАМЧ ВЭ:
 *   App Store болон Google Play-ийн шинжээч аппыг нээж үзэхийн тулд
 *   нэвтрэх данс шаарддаг бөгөөд хүн өөрөө аппыг ажиллуулж туршдаг.
 *
 *   Хэрэв тэдэнд бодит админ эрх өгвөл танай ажилтнуудын ЦАЛИН,
 *   ХУВИЙН ЧАТ, БАЙРШИЛ бүгд харагдана. Шинжээч нууцлал сахидаг ч
 *   тэдэнд үзүүлэх шаардлага огт байхгүй.
 *
 *   Тиймээс demo данс нь өгөгдлийн санд ОГТ ХАНДАХГҮЙ — бүх мөр
 *   эндээс ирнэ. Ингэснээр бодит өгөгдөл алдагдах боломж
 *   математикийн хувьд тэг болно.
 *
 * ⚠️ Энэ нь шинжээчийг ХУУРАХ зорилготой БИШ. Апп нь эдгээр
 *    функцийг бодитоор агуулдаг; зөвхөн ӨГӨГДӨЛ нь жишээ. Дэлгүүрт
 *    өгөх тэмдэглэлд "sandbox demo account with sample data" гэж
 *    ил бичнэ — энэ нь байгууллагын аппуудын жишиг практик.
 */

const DAY = 86400000;

/** `2026-09-01T09:02:00+08:00` маягийн ISO — өнөөдрөөс `d` хоногийн өмнө. */
function at(daysAgo, hh, mm) {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function iso(daysFromNow) {
  return new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10);
}

// ── Хэлтэс ────────────────────────────────────────────────────────
export const DEMO_DEPARTMENTS = [
  { id: 'dm-dep-1', name: 'Сүлжээний засвар', kind: 'org', active: true, parent_id: null, note: 'Талбарын багууд' },
  { id: 'dm-dep-2', name: 'Угсралт, суурилуулалт', kind: 'org', active: true, parent_id: null, note: null },
  { id: 'dm-dep-3', name: 'Агуулах, ложистик', kind: 'org', active: true, parent_id: null, note: null },
  { id: 'dm-dep-4', name: 'Захиргаа, санхүү', kind: 'org', active: true, parent_id: null, note: null },
];

// ── Demo админ (нэвтэрсэн хүн) ────────────────────────────────────
export const DEMO_USER = {
  id: 'dm-user-0',
  name: 'Gennetex',
  last_name: 'Demo',
  email: 'demo@gennetex.mn',
  role: 'admin',
  position: 'Демо администратор',
  phone: '9900-0000',
  department_id: 'dm-dep-4',
  avatar_url: null,
  face_enrolled: true,
  can_take_calls: true,
  permissions: null,
  badge_code: 'DEMO-001',
  created_at: at(120, 9, 0),
};

// ── Хуурамч ажилтнууд ─────────────────────────────────────────────
export const DEMO_PROFILES = [
  DEMO_USER,
  mk('dm-user-1', 'Батбаатар', 'Дорж', 'Сүлжээний инженер', 'dm-dep-1', 'employee'),
  mk('dm-user-2', 'Сарантуяа', 'Ганбат', 'Ахлах инженер', 'dm-dep-1', 'ahlah'),
  mk('dm-user-3', 'Энхбаяр', 'Цэрэн', 'Угсралтын техникч', 'dm-dep-2', 'employee'),
  mk('dm-user-4', 'Оюунчимэг', 'Бат', 'Агуулахын нярав', 'dm-dep-3', 'employee'),
  mk('dm-user-5', 'Мөнхбат', 'Сүх', 'Жолооч', 'dm-dep-2', 'employee'),
  mk('dm-user-6', 'Алтанцэцэг', 'Нэргүй', 'Нягтлан бодогч', 'dm-dep-4', 'menejer'),
  mk('dm-user-7', 'Ганзориг', 'Пүрэв', 'Угсралтын техникч', 'dm-dep-2', 'employee'),
];

function mk(id, name, last, position, dept, role) {
  return {
    id,
    name,
    last_name: last,
    email: `${id}@demo.local`,
    role,
    position,
    phone: `99${id.slice(-1)}0-${1000 + Number(id.slice(-1)) * 111}`,
    department_id: dept,
    avatar_url: null,
    face_enrolled: Number(id.slice(-1)) % 2 === 0,
    can_take_calls: true,
    permissions: null,
    badge_code: `DEMO-${id.slice(-1).padStart(3, '0')}`,
    created_at: at(90, 9, 0),
  };
}

// ── Ирц — сүүлийн 21 хоног ────────────────────────────────────────
function buildAttendance() {
  const rows = [];
  let n = 0;
  for (let d = 1; d <= 21; d++) {
    const dow = new Date(Date.now() - d * DAY).getDay();
    if (dow === 0 || dow === 6) continue; // амралт
    for (const p of DEMO_PROFILES) {
      // Нэг хүн санамсаргүй нэг өдөр ирээгүй — бодит мэт харагдана.
      if ((d * 7 + Number(p.id.slice(-1))) % 23 === 0) continue;
      const remote = (d + Number(p.id.slice(-1))) % 11 === 0;
      rows.push({
        id: `dm-att-${n++}`,
        staff_id: p.id,
        staff_name: `${p.name} ${p.last_name}`,
        type: 'check_in',
        latitude: 47.9187 + (n % 7) * 0.0004,
        longitude: 106.9174 + (n % 5) * 0.0004,
        status: 'approved',
        is_remote: remote,
        distance_m: remote ? 1200 + n * 13 : 8 + (n % 26),
        note: remote ? 'Талбар дээр ажиллав' : null,
        location_name: remote ? 'Барилгын талбар' : 'Төв оффис',
        photo_url: null,
        site_photo_url: null,
        created_at: at(d, 8, 45 + ((n * 7) % 20)),
      });
      rows.push({
        id: `dm-att-${n++}`,
        staff_id: p.id,
        staff_name: `${p.name} ${p.last_name}`,
        type: 'check_out',
        latitude: 47.9187,
        longitude: 106.9174,
        status: 'approved',
        is_remote: false,
        distance_m: 6 + (n % 20),
        note: null,
        location_name: 'Төв оффис',
        photo_url: null,
        site_photo_url: null,
        created_at: at(d, 18, (n * 11) % 30),
      });
    }
  }

  // Өнөөдөр — demo админ ажил дээрээ (карт "ажиллаж байна" гэж харагдана)
  rows.push({
    id: 'dm-att-today',
    staff_id: DEMO_USER.id,
    staff_name: `${DEMO_USER.name} ${DEMO_USER.last_name}`,
    type: 'check_in',
    latitude: 47.9187,
    longitude: 106.9174,
    status: 'approved',
    is_remote: false,
    distance_m: 11,
    note: null,
    location_name: 'Төв оффис',
    photo_url: null,
    site_photo_url: null,
    created_at: at(0, 8, 58),
  });

  // Хүлээгдэж буй нэг хүсэлт — админ баталгаажуулах урсгалыг үзүүлнэ
  rows.push({
    id: 'dm-att-pending',
    staff_id: 'dm-user-3',
    staff_name: 'Энхбаяр Цэрэн',
    type: 'check_in',
    latitude: 47.9051,
    longitude: 106.8831,
    status: 'pending',
    is_remote: true,
    distance_m: 2140,
    note: 'Хайрхан дүүрэгт суурилуулалт хийж байна',
    location_name: 'Талбар',
    photo_url: null,
    site_photo_url: null,
    created_at: at(0, 9, 12),
  });

  return rows;
}

export const DEMO_ATTENDANCE = buildAttendance();

// ── Ээлж — ирэх 14 хоног ──────────────────────────────────────────
export const DEMO_SHIFTS = (() => {
  const out = [];
  let n = 0;
  for (let d = 0; d < 14; d++) {
    const dow = new Date(Date.now() + d * DAY).getDay();
    if (dow === 0 || dow === 6) continue;
    for (const p of DEMO_PROFILES) {
      out.push({
        id: `dm-shift-${n++}`,
        user_id: p.id,
        user_name: `${p.name} ${p.last_name}`,
        shift_date: iso(d),
        start_time: p.department_id === 'dm-dep-1' ? '08:00' : '09:00',
        end_time: p.department_id === 'dm-dep-1' ? '17:00' : '18:00',
        location_id: null,
        note: null,
        created_by: DEMO_USER.id,
        created_at: at(3, 10, 0),
      });
    }
  }
  return out;
})();

// ── Агуулах ───────────────────────────────────────────────────────
export const DEMO_PRODUCTS = [
  p('dm-pr-1', 'Оптик кабель 4 core', 'ш', 340, 'метр'),
  p('dm-pr-2', 'Splice хамгаалагч', 'ш', 1200, 'ширхэг'),
  p('dm-pr-3', 'ONU төхөөрөмж', 'ш', 58, 'ширхэг'),
  p('dm-pr-4', 'Патч корд SC/APC 3м', 'ш', 210, 'ширхэг'),
  p('dm-pr-5', 'Дуулга (хамгаалалт)', 'ш', 24, 'ширхэг'),
  p('dm-pr-6', 'Fusion splicer', 'ш', 4, 'ширхэг'),
];
function p(id, name, sku, qty, unit) {
  return { id, name, sku, quantity: qty, unit, min_quantity: 10, category: 'Материал', created_at: at(60, 9, 0) };
}

// ── Тээвэр ────────────────────────────────────────────────────────
export const DEMO_VEHICLES = [
  { id: 'dm-veh-1', plate: '1234 УБА', model: 'Toyota Hiace', driver_id: 'dm-user-5', fuel_level: 62, fuel_type: 'petrol', year: 2019, created_at: at(200, 9, 0) },
  { id: 'dm-veh-2', plate: '5678 УНС', model: 'Mitsubishi Delica', driver_id: 'dm-user-3', fuel_level: 38, fuel_type: 'diesel', year: 2017, created_at: at(200, 9, 0) },
];

// ── Мэдээллийн урсгал ─────────────────────────────────────────────
export const DEMO_POSTS = [
  { id: 'dm-post-1', author_id: 'dm-user-6', author_name: 'Алтанцэцэг Нэргүй', content: 'Энэ сарын цалин 25-нд олгогдоно. Ирцийн бүртгэлээ шалгаж, дутуу бол хүсэлт илгээнэ үү.', image_url: null, created_at: at(1, 14, 20) },
  { id: 'dm-post-2', author_id: 'dm-user-2', author_name: 'Сарантуяа Ганбат', content: 'Маргааш 09:00-т аюулгүй ажиллагааны сургалт болно. Талбарын бүх ажилтан оролцоно.', image_url: null, created_at: at(2, 11, 5) },
  { id: 'dm-post-3', author_id: DEMO_USER.id, author_name: 'Gennetex Demo', content: 'Шинэ fusion splicer 2 ширхэг агуулахад ирлээ. Хэрэгтэй багууд няраваас авна уу.', image_url: null, created_at: at(4, 16, 40) },
];

/**
 * Хүснэгтийн нэр → мөрүүд.
 *
 * Энд байхгүй хүснэгт нь ХООСОН массив буцаана — унахгүй, зүгээр л
 * "мэдээлэл алга" гэж харагдана. Шинжээчид энэ нь хангалттай.
 */
export function demoTable(name) {
  switch (name) {
    case 'profiles': return DEMO_PROFILES;
    case 'departments': return DEMO_DEPARTMENTS;
    case 'attendance': return DEMO_ATTENDANCE;
    case 'employee_shifts': return DEMO_SHIFTS;
    case 'products': return DEMO_PRODUCTS;
    case 'vehicles': return DEMO_VEHICLES;
    case 'posts': return DEMO_POSTS;
    case 'authorized_users':
      return DEMO_PROFILES.map((x) => ({
        email: x.email, name: x.name, last_name: x.last_name,
        position: x.position, role: x.role, active: true,
        department_id: x.department_id, linked_user_id: x.id,
      }));
    default: return [];
  }
}
