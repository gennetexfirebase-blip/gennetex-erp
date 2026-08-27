// Хуваалцсан JS модулиуд — mobile апптай НЭГ эх сурвалж, тиймээс хоёр
// талаас татсан Excel яг ижил гарна.
//
// ⚠️ `xlsx-chart.js` нь UMD (CommonJS + global) бөгөөд ESM `default`
// export ГАРГАДАГГҮЙ. Metro нь interop хийдэг ч Rollup хийдэггүй тул
// side-effect-ээр ачаалаад `globalThis.XlsxChart`-аас уншина.
import '../../../admin-web/xlsx-chart.js';
import {
  buildDailyAttendanceSheets,
  sheetsToPreview,
} from '../../../admin-web/attendance-report-builder.js';
import type { AttendanceRow } from './data';

type XlsxChartApi = { build: (o: unknown) => Uint8Array };
const XlsxChart = (globalThis as unknown as { XlsxChart: XlsxChartApi }).XlsxChart;

export type Sheet = { name: string; rows: (string | number)[][] };
export type Preview = { header: string[]; body: (string | number)[][]; sheetName: string };

export function dailySheets(date: string, rows: AttendanceRow[]): Sheet[] {
  return buildDailyAttendanceSheets({ date, rows });
}

export function toPreview(sheets: Sheet[]): Preview {
  return sheetsToPreview(sheets);
}

/**
 * .xlsx болгож татна.
 *
 * `xlsx-chart.js` нь Uint8Array буцаана — түүнийг Blob болгож браузераар
 * татуулна. Мобайл тал ЯГ ижил bytes-ыг файл болгож хадгалдаг тул хоёр
 * талаас татсан файл ялгаагүй.
 */
export function downloadDailyExcel(date: string, rows: AttendanceRow[]) {
  const bytes = XlsxChart.build({ sheets: dailySheets(date, rows) });
  // `Uint8Array<ArrayBufferLike>`-ийг Blob хүлээж авахын тулд ArrayBuffer
  // болгож хуулна (TS-ийн шинэ lib дээр шууд дамжуулахыг зөвшөөрдөггүй).
  const blob = new Blob([new Uint8Array(bytes).buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gennetex_irts_${date.replace(/-/g, '')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Санах ойг чөлөөлнө — эс бөгөөс олон удаа татахад blob хуримтлагдана.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
