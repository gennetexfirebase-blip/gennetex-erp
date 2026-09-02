/**
 * Ирцийн Excel тайлангийн МӨРҮҮДИЙГ угсрах — mobile болон admin-web
 * ХОЁУЛАА энэ файлыг ашиглана.
 *
 * ЯАГААД тусад нь: тайлангийн багана, дараалал, тооцоолол нэг л газарт
 * байх ёстой. Эс бөгөөс аппаас татсан Excel болон вэбээс татсан Excel
 * хоёр өөр гарч, аль нь зөв нь ойлгомжгүй болно.
 *
 * ⚠️ ЯАГААД `src/` БИШ, `admin-web/` ДОТОР БАЙНА ВЭ:
 *   `.vercelignore` нь `/src/`-ийг Vercel-ийн build-аас ХАСДАГ (мобайл
 *   код вэбэд хэрэггүй тул). Тиймээс энэ файл `src/` дотор байвал вэб
 *   build дээр ОЛДОХГҮЙ бөгөөд deploy унана. `xlsx-chart.js` мөн яг
 *   энэ шалтгаанаар эндээ байдаг.
 *
 * `teamPerformanceService.buildExportSheets`-тэй ижил хэлбэрийг барина:
 *   [{ name: 'Хуудасны нэр', rows: [[...], [...]] }]
 */

export const STATUS_LABEL = {
  on_time: 'Цагтаа ирсэн',
  late: 'Хоцорсон',
  early_leave: 'Эрт явсан',
  absent: 'Тасалсан',
  leave: 'Чөлөөтэй',
  rest: 'Амралт',
  not_scheduled: 'Хуваарьгүй',
  upcoming: 'Ирээгүй',
};

function hhmm(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function minutesToHours(min) {
  if (!min) return 0;
  return Math.round((min / 60) * 100) / 100;
}

/**
 * Өдрийн ирцийн тайлан.
 *
 * @param {object} p
 * @param {string} p.date        'YYYY-MM-DD'
 * @param {Array}  p.rows        `fetch_department_attendance_today`-ийн мөрүүд
 * @param {string} [p.orgName]
 */
export function buildDailyAttendanceSheets({ date, rows = [], orgName = 'ЖЕННЕТЕКС ХХК' }) {
  const count = (s) => rows.filter((r) => r.status === s).length;
  const checkedIn = rows.filter((r) => r.check_in_at).length;
  const totalWorked = rows.reduce((sum, r) => sum + (r.worked_minutes || 0), 0);
  const totalLate = rows.reduce((sum, r) => sum + (r.late_minutes || 0), 0);

  return [
    {
      name: 'Нэгтгэл',
      rows: [
        ['Үзүүлэлт', 'Утга'],
        ['Байгууллага', orgName],
        ['Огноо', date],
        ['Нийт ажилтан', rows.length],
        ['Ирц бүртгүүлсэн', checkedIn],
        ['Цагтаа ирсэн', count('on_time')],
        ['Хоцорсон', count('late')],
        ['Эрт явсан', count('early_leave')],
        ['Тасалсан', count('absent')],
        ['Зөвшөөрөл хүлээж буй', rows.filter((r) => r.is_pending).length],
        ['Чөлөөтэй', count('leave')],
        ['Амралт', count('rest')],
        ['Нийт ажилласан (цаг)', minutesToHours(totalWorked)],
        ['Нийт хоцролт (мин)', totalLate],
        ['Тайлан гаргасан', new Date().toLocaleString('mn-MN')],
      ],
    },
    {
      name: 'Ирц',
      rows: [
        [
          '№',
          'Ажилтан',
          'Алба хэлтэс',
          'Хуваарь',
          'Ирсэн',
          'Явсан',
          'Ажилласан (цаг)',
          'Хоцорсон (мин)',
          'Эрт явсан (мин)',
          'Зайнаас',
          'Зөвшөөрөл',
          'Төлөв',
        ],
        ...rows.map((r, i) => [
          i + 1,
          r.employee_name || '',
          r.department_name || '',
          r.shift_start && r.shift_end ? `${r.shift_start}-${r.shift_end}` : '',
          hhmm(r.check_in_at),
          hhmm(r.check_out_at),
          minutesToHours(r.worked_minutes),
          r.late_minutes || 0,
          r.early_leave_minutes || 0,
          r.is_remote ? 'Тийм' : '',
          r.is_pending ? 'Хүлээгдэж байна' : r.check_in_at ? 'Баталгаажсан' : '',
          STATUS_LABEL[r.status] || r.status || '',
        ]),
      ],
    },
  ];
}

/**
 * Хугацааны (сар) ирцийн тайлан — нэг ажилтны өдөр бүрийн задаргаа.
 *
 * @param {object} p
 * @param {string} p.employeeName
 * @param {string} p.from  'YYYY-MM-DD'
 * @param {string} p.to
 * @param {Array}  p.rows  `fetch_attendance_summary`-ийн мөрүүд
 */
export function buildRangeAttendanceSheets({ employeeName, from, to, rows = [] }) {
  const worked = rows.reduce((s, r) => s + (r.worked_minutes || 0), 0);
  const late = rows.reduce((s, r) => s + (r.late_minutes || 0), 0);
  const absent = rows.filter((r) => r.status === 'absent').length;

  return [
    {
      name: 'Нэгтгэл',
      rows: [
        ['Үзүүлэлт', 'Утга'],
        ['Ажилтан', employeeName || ''],
        ['Хугацаа', `${from} — ${to}`],
        ['Нийт ажилласан (цаг)', minutesToHours(worked)],
        ['Нийт хоцролт (мин)', late],
        ['Тасалсан өдөр', absent],
      ],
    },
    {
      name: 'Өдрөөр',
      rows: [
        [
          'Огноо',
          'Хуваарь',
          'Байршил',
          'Ирсэн',
          'Явсан',
          'Ажилласан (цаг)',
          'Хоцорсон (мин)',
          'Эрт явсан (мин)',
          'Төлөв',
        ],
        ...rows.map((r) => [
          r.work_date,
          r.shift_start && r.shift_end ? `${r.shift_start}-${r.shift_end}` : '',
          r.location_name || '',
          hhmm(r.check_in_at),
          hhmm(r.check_out_at),
          minutesToHours(r.worked_minutes),
          r.late_minutes || 0,
          r.early_leave_minutes || 0,
          STATUS_LABEL[r.status] || r.status || '',
        ]),
      ],
    },
  ];
}

/**
 * Багаж/бараа ОЛГОЛТЫН тайлан — хэн, хэнд, юуг, хэзээ.
 *
 * Цагийг СЕКУНД хүртэл харуулна: нэг өдөрт олон удаа олгосон тохиолдолд
 * дараалал нь тодорхой байх ёстой.
 *
 * @param {object} p
 * @param {string} p.from  'YYYY-MM-DD'
 * @param {string} p.to
 * @param {Array}  p.rows  `stock_movements`-ийн мөрүүд
 */
export function buildStockIssueSheets({ from, to, rows = [] }) {
  const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
      d.getMinutes()
    )}:${p(d.getSeconds())}`;
  };

  const issued = rows.filter((r) => r.movement_type === 'withdraw');
  const byIssuer = {};
  issued.forEach((r) => {
    const k = r.issued_by_name || '—';
    byIssuer[k] = (byIssuer[k] || 0) + 1;
  });

  return [
    {
      name: 'Нэгтгэл',
      rows: [
        ['Үзүүлэлт', 'Утга'],
        ['Хугацаа', `${from} — ${to}`],
        ['Нийт олголт', issued.length],
        ['Нийт хөдөлгөөн', rows.length],
        ['Тайлан гаргасан', fmt(new Date().toISOString())],
        [],
        ['Олгосон админ', 'Олголтын тоо'],
        ...Object.entries(byIssuer).map(([k, v]) => [k, v]),
      ],
    },
    {
      name: 'Олголт',
      rows: [
        [
          '№',
          'Огноо / цаг',
          'Олгосон (админ)',
          'Хүлээн авсан',
          'Бараа / багаж',
          'Тоо',
          'Нэгж',
          'Төрөл',
        ],
        ...rows.map((r, i) => [
          i + 1,
          fmt(r.created_at),
          r.issued_by_name || '—',
          r.user_name || '',
          r.item_name || '',
          Number(r.quantity) || 0,
          r.unit || '',
          r.movement_type === 'withdraw'
            ? 'Олгосон'
            : r.movement_type === 'consume'
              ? 'Зарцуулсан'
              : r.movement_type || '',
        ]),
      ],
    },
  ];
}

const CATEGORY_LABEL = {
  material: 'Бараа материал',
  tool: 'Багаж',
  supply: 'Хангамж',
};

/**
 * Ажилтан бүрийн гар дээрх үлдэгдэл — "хэн юу барьж байна".
 *
 * `holders` нь `computeBalancesByUser`-ийн гаралт:
 *   [{ user_id, user_name, items: [{ item_name, unit, category, quantity }] }]
 *
 * Хоёр хуудас гаргана:
 *   Нэгтгэл — ажилтан бүрийн нийт нэр төрөл, ангилал тус бүрийн тоо
 *   Дэлгэрэнгүй — ажилтан × бараа бүрийн мөр
 */
export function buildStockHoldingSheets({ holders = [], orgName = 'ЖЕННЕТЕКС ХХК' }) {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stampedAt = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(
    now.getHours()
  )}:${p(now.getMinutes())}`;

  const countBy = (items, cat) =>
    items.filter((it) => (it.category || 'material') === cat).length;

  const totalItems = holders.reduce((s, h) => s + h.items.length, 0);
  const totalQty = holders.reduce(
    (s, h) => s + h.items.reduce((q, it) => q + (Number(it.quantity) || 0), 0),
    0
  );

  const detail = [];
  holders.forEach((h) => {
    h.items.forEach((it) => {
      detail.push([
        detail.length + 1,
        h.user_name || '—',
        CATEGORY_LABEL[it.category || 'material'] || 'Бараа материал',
        it.item_name || '—',
        Number(it.quantity) || 0,
        it.unit || 'ширхэг',
      ]);
    });
  });

  return [
    {
      name: 'Нэгтгэл',
      rows: [
        [orgName],
        ['Ажилтны гар дээрх бараа, багаж, хангамж'],
        ['Тайлан гаргасан', stampedAt],
        [],
        ['Эзэмшигч ажилтан', holders.length],
        ['Нийт нэр төрөл', totalItems],
        ['Нийт тоо ширхэг', totalQty],
        [],
        ['Ажилтан', 'Бараа материал', 'Багаж', 'Хангамж', 'Нийт нэр төрөл', 'Нийт тоо'],
        ...holders.map((h) => [
          h.user_name || '—',
          countBy(h.items, 'material'),
          countBy(h.items, 'tool'),
          countBy(h.items, 'supply'),
          h.items.length,
          h.items.reduce((q, it) => q + (Number(it.quantity) || 0), 0),
        ]),
      ],
    },
    {
      name: 'Дэлгэрэнгүй',
      rows: [
        ['№', 'Ажилтан', 'Ангилал', 'Бараа / багаж', 'Тоо', 'Нэгж'],
        ...detail,
      ],
    },
  ];
}

/** Preview-д зориулсан хялбар хүснэгт — эхний хуудсын мөрүүд. */
export function sheetsToPreview(sheets) {
  /**
   * ⚠️ Урьдчилан харах хуудас нь ЭХНИЙ МӨРӨӨ толгой гэж үзнэ
   *    (`rows[0]`). Тиймээс энд нэрлэгдсэн хуудсууд нь гарчиг,
   *    огнооны мөргүйгээр ШУУД толгойгоор эхэлсэн байх ёстой.
   *    "Нэгтгэл" хуудас нь байгууллагын нэрээр эхэлдэг тул урьдчилан
   *    харахад тохирохгүй — нэг нүдтэй толгой гарч, хүснэгт эвдэрнэ.
   */
  const main =
    sheets.find((s) =>
      ['Ирц', 'Өдрөөр', 'Олголт', 'Цэнэглэлт бүр'].includes(s.name)
    ) || sheets[0];
  return {
    header: main.rows[0] || [],
    body: main.rows.slice(1),
    sheetName: main.name,
  };
}

/**
 * Шатахууны зарцуулалтын Excel — машин бүрийн нэгтгэл + цэнэглэлт бүр.
 *
 * ⚠️ УЛСЫН ДУГААР бүх хуудсанд ЗААВАЛ орно. Тайланг санхүү рүү
 *    дамжуулахад "аль машины зардал вэ" гэдэг нь цорын ганц чухал
 *    багана — код эсвэл жолоочийн нэрээр таних боломжгүй (жолооч
 *    солигддог, код нь дотоод дугаар).
 *
 * @param {Array} vehicles `fetchFuelSpendReport()`-ийн мөрүүд
 * @param {Array} refuels  Цэнэглэлт бүр (сонголт) — огноо, цаг, литр, үнэ
 */
export function buildFuelSpendSheets({
  vehicles = [],
  refuels = [],
  periodLabel = 'Бүх хугацаа',
  orgName = 'ЖЕННЕТЕКС ХХК',
}) {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stampedAt = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(
    now.getHours()
  )}:${p(now.getMinutes())}`;

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
      d.getMinutes()
    )}`;
  };

  const withSpend = vehicles.filter((v) => (Number(v.totalCost) || 0) > 0);
  const totalCost = withSpend.reduce((s, v) => s + (Number(v.totalCost) || 0), 0);
  const totalLiters = withSpend.reduce((s, v) => s + (Number(v.totalLiters) || 0), 0);
  const totalFills = withSpend.reduce((s, v) => s + (Number(v.refuelCount) || 0), 0);

  const summary = withSpend.map((v, i) => [
    i + 1,
    v.plateNumber || '—',
    v.driverName || '—',
    FUEL_LABEL[v.fuelType] || v.fuelType || '—',
    Number(v.refuelCount) || 0,
    Number((Number(v.totalLiters) || 0).toFixed(2)),
    Number(v.totalCost) || 0,
    v.avgPrice == null ? '—' : Number(v.avgPrice),
    fmtDateTime(v.firstAt),
    fmtDateTime(v.lastAt),
  ]);

  const detail = refuels.map((r, i) => [
    i + 1,
    r.plate_number || '—',
    fmtDateTime(r.created_at),
    Number((Number(r.liters) || 0).toFixed(2)),
    Number(r.price_per_liter) || 0,
    Number(r.cost) || 0,
    r.discounted ? 'Тийм' : '—',
    r.user_name || '—',
  ]);

  const sheets = [
    {
      name: 'Нэгтгэл',
      rows: [
        [orgName],
        ['Шатахууны зарцуулалт'],
        ['Хугацаа', periodLabel],
        ['Тайлан гаргасан', stampedAt],
        [],
        ['Машины тоо', withSpend.length],
        ['Нийт цэнэглэлт', totalFills],
        ['Нийт литр', Number(totalLiters.toFixed(2))],
        ['НИЙТ ЗАРДАЛ (₮)', totalCost],
        [
          'Дундаж 1 литр (₮)',
          totalLiters > 0 ? Math.round(totalCost / totalLiters) : '—',
        ],
        [],
        [
          '№',
          'Улсын дугаар',
          'Жолооч',
          'Түлшний төрөл',
          'Цэнэглэсэн тоо',
          'Нийт литр',
          'Нийт зардал (₮)',
          'Дундаж 1л (₮)',
          'Эхний цэнэглэлт',
          'Сүүлийн цэнэглэлт',
        ],
        ...summary,
      ],
    },
  ];

  if (detail.length) {
    sheets.push({
      name: 'Цэнэглэлт бүр',
      // ⚠️ Гарчгийн мөр ОРУУЛАХГҮЙ — энэ хуудас урьдчилан харахад
      //    ашиглагддаг тул эхний мөр нь толгой байх ёстой.
      rows: [
        [
          '№',
          'Улсын дугаар',
          'Огноо, цаг',
          'Литр',
          '1 литрийн үнэ (₮)',
          'Төлсөн дүн (₮)',
          'Хөнгөлөлттэй',
          'Цэнэглэсэн',
        ],
        ...detail,
      ],
    });
  }

  return sheets;
}

const FUEL_LABEL = {
  ai80: 'А-80',
  ai92: 'АИ-92',
  ai95: 'АИ-95',
  diesel: 'Дизель',
  ai92_euro: 'АИ-92 Евро',
  ai95_euro: 'АИ-95 Евро',
  diesel_euro: 'Дизель Евро',
};
