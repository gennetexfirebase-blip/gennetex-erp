import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  STATUS_LABEL,
  WDAY,
  attentionList,
  fmtDateY,
  h1,
  hm,
  parse,
  type DayRec,
  type Status,
  type TrEmployee,
  type TrModel,
} from './timeReport';

(pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem(pdfFonts);

const COLOR: Record<Status, string> = { ok: '#2F7D5B', late: '#D99A2B', leave: '#6A5A8E', absent: '#B8473C', off: '#E3DED2', future: '#FFFFFF', na: '#FFFFFF' };

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const fileTag = (m: TrModel) => `${m.from.replace(/-/g, '')}_${m.to.replace(/-/g, '')}`;
const outText = (x: DayRec, today: string) => x.checkOut || (x.open ? (x.date === today ? 'ажил дээрээ' : 'бүртгээгүй') : '');

/* ───────── Excel ───────── */
type XlsxChartApi = { build: (o: unknown) => Uint8Array };
async function loadXlsx() {
  await import('../../../admin-web/xlsx-chart.js');
  return (globalThis as unknown as { XlsxChart: XlsxChartApi }).XlsxChart;
}

export type Sheet = { name: string; rows: (string | number)[][] };

export const excelFilename = (m: TrModel, emps: TrEmployee[]) =>
  `tsagiin_tailan${emps.length === 1 ? `_${emps[0].name.replace(/[^\p{L}\p{N}]+/gu, '')}` : ''}_${fileTag(m)}.xlsx`;

/** Excel-ийн хуудсууд — урьдчилан харах ба татах хоёр яг энэ мөрүүдийг ашиглана. */
export function excelSheets(m: TrModel, emps: TrEmployee[] = m.emps): Sheet[] {
  const summary: (string | number)[][] = [
    ['Ажилтан', 'Албан тушаал', 'Хэлтэс', 'Ажлын өдөр', 'Ирсэн', 'Цагтаа', 'Хоцорсон', 'Хоцорсон мин', 'Чөлөөтэй', 'Тасалсан', 'Ажилласан цаг', 'Илүү цаг', 'Дундаж ирэх цаг', 'Ирц %'],
  ];
  const daily: (string | number)[][] = [
    ['Ажилтан', 'Хэлтэс', 'Огноо', 'Гараг', 'Ирсэн', 'Явсан', 'Ажилласан цаг', 'Хоцорсон мин', 'Төлөв', 'Тэмдэглэл'],
  ];
  emps.forEach((e) => {
    const s = m.sum.get(e.id)!;
    summary.push([e.name, e.position, e.department, s.work, s.present, s.ok, s.late, s.lateMin, s.leave, s.absent, +s.hours.toFixed(2), +s.over.toFixed(2), s.avgIn != null ? hm(s.avgIn) : '', s.rate]);
    s.days.forEach((x) => {
      if (x.status === 'future' || x.status === 'na') return;
      daily.push([
        e.name,
        e.department,
        x.date,
        WDAY[parse(x.date).getDay()],
        x.checkIn || '',
        outText(x, m.today),
        x.hours ? +x.hours.toFixed(2) : '',
        x.lateMin || '',
        STATUS_LABEL[x.status],
        [x.remote ? 'Зайнаас' : '', x.pending ? 'Зөвшөөрөл хүлээж буй' : '', x.shift ? `Хуваарь ${x.shift}` : ''].filter(Boolean).join(', '),
      ]);
    });
  });
  const att = attentionList(m).filter((a) => emps.includes(a.emp));
  const attention: (string | number)[][] = [['Ажилтан', 'Хэлтэс', 'Ирц %', 'Хоцорсон', 'Хоцорсон мин', 'Тасалсан', 'Анхаарах шалтгаан']];
  att.forEach((a) => attention.push([a.emp.name, a.emp.department, a.s.rate, a.s.late, a.s.lateMin, a.s.absent, a.reasons.join('; ')]));
  return [
    { name: 'Нэгтгэл', rows: summary },
    { name: 'Өдөр бүрээр', rows: daily },
    ...(att.length ? [{ name: 'Анхаарах', rows: attention }] : []),
  ];
}

export async function downloadSheets(sheets: Sheet[], filename: string) {
  const X = await loadXlsx();
  const bytes = X.build({ sheets });
  save(new Blob([new Uint8Array(bytes).buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

export async function downloadExcel(m: TrModel, emps: TrEmployee[] = m.emps) {
  await downloadSheets(excelSheets(m, emps), excelFilename(m, emps));
}

/* ───────── PDF ───────── */
const th = (t: string) => ({ text: t, bold: true, fillColor: '#F3F0E8', color: '#5E5A52' });

function header(title: string, m: TrModel): Content[] {
  return [
    {
      columns: [
        { stack: [{ text: 'ЖЕННЕТЕКС ХХК', bold: true, color: '#24614F', fontSize: 9 }, { text: title, fontSize: 16, bold: true, margin: [0, 2, 0, 0] }] },
        { text: `${fmtDateY(m.from)} – ${fmtDateY(m.to)}\nҮүсгэсэн: ${new Date().toLocaleString('mn-MN')}`, alignment: 'right', fontSize: 8.5, color: '#5E5A52' },
      ],
      margin: [0, 0, 0, 12],
    },
  ];
}

function statsRow(items: [string, string][]): Content {
  return {
    table: {
      widths: items.map(() => '*'),
      body: [items.map(([k, v]) => ({ stack: [{ text: k, fontSize: 8, color: '#5E5A52' }, { text: v, fontSize: 15, bold: true, margin: [0, 3, 0, 0] }], margin: [6, 6, 6, 6] }))],
    },
    layout: { hLineColor: () => '#E0DACD', vLineColor: () => '#E0DACD' },
    margin: [0, 0, 0, 14],
  };
}

const tableLayout = {
  hLineColor: () => '#E0DACD',
  vLineColor: () => '#E0DACD',
  hLineWidth: (i: number) => (i <= 1 ? 1 : 0.5),
  vLineWidth: () => 0,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

/** Бүх ажилтны тайлан: нэгтгэл, анхаарах ажилтнууд, ажилтан бүрийн нэгтгэл, (≤31 хоног бол) өдрийн зураглал. */
function reportDoc(m: TrModel, emps: TrEmployee[]): TDocumentDefinitions {
  const S = emps.map((e) => m.sum.get(e.id)!);
  const tot = (k: 'present' | 'work' | 'leave' | 'late' | 'absent' | 'hours' | 'over' | 'lateMin') => S.reduce((a, s) => a + s[k], 0);
  const base = tot('work') - tot('leave');
  const rate = base ? Math.round((tot('present') / base) * 100) : 0;
  const att = attentionList(m).filter((a) => emps.includes(a.emp));

  const content: Content[] = [
    ...header('Цагийн тайлан', m),
    statsRow([
      ['Нийт ирц', `${rate}%`],
      ['Ажилтан', String(emps.length)],
      ['Хоцролт', `${tot('late')} удаа`],
      ['Тасалсан', `${tot('absent')} өдөр`],
      ['Ажилласан цаг', h1(tot('hours'))],
    ]),
  ];

  content.push({ text: `Анхаарах ажилтнууд (${att.length})`, bold: true, fontSize: 11, color: '#B8473C', margin: [0, 0, 0, 6] });
  if (att.length) {
    content.push({
      table: {
        headerRows: 1,
        widths: [120, 90, 38, 48, 44, 'auto', '*'],
        body: [
          [th('Ажилтан'), th('Хэлтэс'), th('Ирц'), th('Хоцорсон'), th('Тасалсан'), th('Цаг'), th('Анхаарах шалтгаан')],
          ...att.map((a) => [
            { text: a.emp.name, bold: true },
            a.emp.department,
            { text: `${a.s.rate}%`, color: a.s.rate >= 90 ? '#2F7D5B' : a.s.rate >= 75 ? '#D99A2B' : '#B8473C', bold: true },
            `${a.s.late} (${a.s.lateMin}м)`,
            String(a.s.absent),
            h1(a.s.hours),
            { text: a.reasons.join('; '), color: '#B8473C' },
          ]),
        ],
      },
      layout: tableLayout,
      fontSize: 8.5,
      margin: [0, 0, 0, 16],
    });
  } else {
    content.push({ text: 'Энэ хугацаанд анхаарах ажилтан алга.', color: '#5E5A52', fontSize: 9, margin: [0, 0, 0, 16] });
  }

  content.push({ text: 'Ажилтан бүрийн нэгтгэл', bold: true, fontSize: 11, margin: [0, 0, 0, 6] });
  content.push({
    table: {
      headerRows: 1,
      widths: ['*', 90, 42, 40, 52, 42, 44, 44, 40, 44, 34],
      body: [
        [th('Ажилтан'), th('Хэлтэс'), th('Ирсэн'), th('Цагтаа'), th('Хоцорсон'), th('Чөлөө'), th('Тасалсан'), th('Цаг'), th('Илүү'), th('Дундаж'), th('Ирц')],
        ...emps.map((e) => {
          const s = m.sum.get(e.id)!;
          return [
            { text: e.name, bold: true },
            e.department,
            `${s.present}/${s.work}`,
            String(s.ok),
            s.late ? `${s.late} (${s.lateMin}м)` : '—',
            String(s.leave),
            s.absent ? { text: String(s.absent), color: '#B8473C', bold: true } : '0',
            h1(s.hours),
            h1(s.over),
            s.avgIn != null ? hm(s.avgIn) : '—',
            { text: `${s.rate}%`, bold: true, color: s.rate >= 90 ? '#2F7D5B' : s.rate >= 75 ? '#D99A2B' : '#B8473C' },
          ];
        }),
      ],
    },
    layout: tableLayout,
    fontSize: 8.5,
  });

  if (m.list.length <= 31) {
    content.push({ text: 'Ирцийн зураглал', bold: true, fontSize: 11, margin: [0, 16, 0, 6], pageBreak: 'before' });
    const dayW = Math.min(16, Math.floor(560 / m.list.length));
    content.push({
      table: {
        headerRows: 1,
        widths: [110, ...m.list.map(() => dayW)],
        body: [
          [th('Ажилтан'), ...m.list.map((d) => ({ text: `${parse(d).getDate()}\n${WDAY[parse(d).getDay()]}`, alignment: 'center' as const, fontSize: 6, color: '#5E5A52', fillColor: '#F3F0E8' }))],
          ...emps.map((e) => [
            { text: e.name, fontSize: 7.5 },
            ...m.sum.get(e.id)!.days.map((x) => ({
              text: x.status === 'late' ? '•' : x.status === 'off' ? '' : '',
              fillColor: x.status === 'future' || x.status === 'na' ? undefined : COLOR[x.status],
              color: '#FFFFFF',
              alignment: 'center' as const,
              fontSize: 7,
            })),
          ]),
        ],
      },
      layout: { hLineColor: () => '#FFFFFF', vLineColor: () => '#FFFFFF', hLineWidth: () => 1.5, vLineWidth: () => 1.5 },
      fontSize: 7,
    });
    content.push({
      columns: (['ok', 'late', 'leave', 'absent', 'off'] as Status[]).map((k) => ({
        text: [{ text: '■ ', color: COLOR[k] }, STATUS_LABEL[k]],
        fontSize: 8,
        color: '#5E5A52',
      })),
      margin: [0, 8, 0, 0],
    });
  }

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 26, 28, 30],
    defaultStyle: { fontSize: 9, color: '#2A2925' },
    footer: (page, count) => ({ text: `Gennetex ERP · Цагийн тайлан · ${page}/${count}`, alignment: 'center', fontSize: 7.5, color: '#857F73', margin: [0, 8, 0, 0] }),
    content,
  };
}

/** Нэг ажилтны дэлгэрэнгүй — өдөр бүрийн бүртгэлтэй. */
function employeeDoc(m: TrModel, e: TrEmployee): TDocumentDefinitions {
  const s = m.sum.get(e.id)!;
  const rows = s.days.filter((x) => !['future', 'na'].includes(x.status) && (x.status !== 'off' || x.checkIn));
  return {
    pageSize: 'A4',
    pageMargins: [32, 28, 32, 32],
    defaultStyle: { fontSize: 9, color: '#2A2925' },
    footer: (page, count) => ({ text: `Gennetex ERP · ${e.name} · ${page}/${count}`, alignment: 'center', fontSize: 7.5, color: '#857F73', margin: [0, 8, 0, 0] }),
    content: [
      ...header(`${e.name} — ирцийн тайлан`, m),
      { text: [e.position, e.department].filter(Boolean).join(', '), color: '#5E5A52', margin: [0, -6, 0, 12] },
      statsRow([
        ['Ирц', `${s.rate}%`],
        ['Ирсэн өдөр', `${s.present}/${s.work}`],
        ['Хоцорсон', `${s.late} удаа`],
        ['Тасалсан', `${s.absent} өдөр`],
        ['Ажилласан', `${h1(s.hours)} ц`],
      ]),
      {
        table: {
          headerRows: 1,
          widths: [70, 30, 50, 60, 56, '*'],
          body: [
            [th('Огноо'), th('Гараг'), th('Ирсэн'), th('Явсан'), th('Цаг'), th('Төлөв')],
            ...rows.map((x) => [
              fmtDateY(x.date),
              WDAY[parse(x.date).getDay()],
              x.checkIn || '—',
              outText(x, m.today) || '—',
              x.hours ? h1(x.hours) : '—',
              {
                text: STATUS_LABEL[x.status] + (x.status === 'late' ? ` ${x.lateMin} мин` : '') + (x.remote ? ' · зайнаас' : ''),
                color: x.status === 'off' ? '#857F73' : COLOR[x.status],
                bold: true,
              },
            ]),
          ],
        },
        layout: tableLayout,
      },
    ],
  };
}

/**
 * PDF — `employee` өгвөл нэг ажилтны дэлгэрэнгүй, үгүй бол бүх (шүүсэн) ажилтны тайлан.
 * Урьдчилан харах (blob) ба татах хоёр яг ижил баримтаас гарна.
 */
export function buildPdf(m: TrModel, emps: TrEmployee[], employee?: TrEmployee) {
  return employee
    ? { doc: employeeDoc(m, employee), filename: `irts_${employee.name.replace(/[^\p{L}\p{N}]+/gu, '')}_${fileTag(m)}.pdf` }
    : { doc: reportDoc(m, emps), filename: `tsagiin_tailan_${fileTag(m)}.pdf` };
}

export const pdfBlob = (doc: TDocumentDefinitions): Promise<Blob> => pdfMake.createPdf(doc).getBlob();
