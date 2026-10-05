/**
 * Агуулахын Excel экспорт — мобайл тал.
 *
 * `admin-web/xlsx-chart.js` болон `attendance-report-builder.js`-ийг
 * ашиглана — админ вэб мөн ЯГ ТЭР файлуудыг ашигладаг тул хоёр талаас
 * татсан тайлан ижил гарна.
 */
// SDK 54-д expo-file-system-ийн API /legacy руу шилжсэн
// (attendanceExportService-тэй ижил шалтгаан).
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import XlsxChart from '../../admin-web/xlsx-chart.js';
import { buildStockHoldingSheets, buildFuelSpendSheets } from '../../admin-web/attendance-report-builder.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function todayStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
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

/**
 * Ажилтан бүрийн гар дээрх үлдэгдэл → .xlsx
 *
 * `holders` нь `computeBalancesByUser`-ийн гаралт байх ёстой.
 */
export async function exportStockHoldingExcel({ holders }) {
  const bytes = XlsxChart.build({ sheets: buildStockHoldingSheets({ holders }) });
  return writeAndShare(`gennetex_ezemshil_${todayStamp()}.xlsx`, bytes);
}

/**
 * Шатахууны зарцуулалт → .xlsx
 *
 * Хоёр хуудас: машин бүрийн нэгтгэл, цэнэглэлт бүрийн дэлгэрэнгүй.
 * Улсын дугаар хоёуланд нь орно — санхүү рүү дамжуулахад машиныг
 * таних цорын ганц найдвартай багана.
 */
export async function exportFuelSpendExcel({ vehicles, refuels, periodLabel }) {
  const bytes = XlsxChart.build({
    sheets: buildFuelSpendSheets({ vehicles, refuels, periodLabel }),
  });
  return writeAndShare(`gennetex_shatahuun_${todayStamp()}.xlsx`, bytes);
}
