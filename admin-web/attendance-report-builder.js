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

/** Preview-д зориулсан хялбар хүснэгт — эхний хуудсын мөрүүд. */
export function sheetsToPreview(sheets) {
  const main = sheets.find((s) => s.name === 'Ирц' || s.name === 'Өдрөөр') || sheets[0];
  return {
    header: main.rows[0] || [],
    body: main.rows.slice(1),
    sheetName: main.name,
  };
}
