/**
 * Ирцийн Excel экспорт — мобайл тал.
 *
 * `admin-web/xlsx-chart.js`-ийг ашиглана (админ вэб мөн ЯГ ТЭР файлыг
 * ашигладаг тул хоёр талаас татсан тайлан ижил гарна). Мөрүүдийг
 * `attendanceReportBuilder`-ээс авна — тэр нь ч бас хуваалцсан.
 */
// SDK 54-д expo-file-system-ийн API /legacy руу шилжсэн
// (teamPerformanceExportService-тэй ижил шалтгаан).
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import XlsxChart from '../../admin-web/xlsx-chart.js';
import {
  buildDailyAttendanceSheets,
  buildRangeAttendanceSheets,
} from './attendanceReportBuilder';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function stamp(date) {
  return String(date || '').replace(/-/g, '');
}

async function writeAndShare(filename, bytes) {
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, XlsxChart.toBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  const canShare = await Sharing.isAvailableAsync().catch(() => false);
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: XLSX_MIME, dialogTitle: filename });
  }
  return uri;
}

/** Өдрийн бүх ажилтны ирц → .xlsx */
export async function exportDailyAttendanceExcel({ date, rows, orgName }) {
  const bytes = XlsxChart.build({
    sheets: buildDailyAttendanceSheets({ date, rows, orgName }),
  });
  return writeAndShare(`gennetex_irts_${stamp(date)}.xlsx`, bytes);
}

/** Нэг ажилтны хугацааны ирц → .xlsx */
export async function exportRangeAttendanceExcel({ employeeName, from, to, rows }) {
  const bytes = XlsxChart.build({
    sheets: buildRangeAttendanceSheets({ employeeName, from, to, rows }),
  });
  return writeAndShare(`gennetex_irts_${stamp(from)}_${stamp(to)}.xlsx`, bytes);
}
