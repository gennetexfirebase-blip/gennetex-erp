/**
 * Ажилчдын гүйцэтгэл — Excel ЭКСПОРТ ба ИМПОРТ (мобайл тал).
 *
 * ТАТАХ:   .xlsx — Excel-ийн ЖИНХЭНЭ графиктай. Файлыг угсрах кодыг
 *          `admin-web/xlsx-chart.js` дотор бичсэн (админ вэб мөн ЯГ ТЭР
 *          файлыг ашигладаг тул хоёр талаас татсан тайлан ижил гарна).
 * ОРУУЛАХ: .xlsx ба .csv хоёулаа. Excel дээрээ засаад буцааж оруулж болно.
 *
 * Загварыг эндээс татаад (`shareImportTemplate`) бөглөнө — толгой мөр нь
 * `teamPerformanceService.IMPORT_HEADER`-тэй яг таарна.
 */
// SDK 54-д expo-file-system-ийн API шинэчлэгдэж, `cacheDirectory` болон
// `EncodingType` нь /legacy руу шилжсэн (PayrollExportScreen-тэй ижил шалтгаан).
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
// Хоёртын .xlsx бичих/унших код. Апп ба админ вэб НЭГ файлыг хуваалцаж
// байгаа тул зөрүү гарахгүй — дэлгэрэнгүйг тэр файлын толгойд бичсэн.
import XlsxChart from '../../admin-web/xlsx-chart.js';
import {
  buildExportSheets,
  buildExportCharts,
  buildTemplateMatrix,
  parseImportMatrix,
} from './teamPerformanceService';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

async function share(uri, filename, mimeType) {
  const canShare = await Sharing.isAvailableAsync().catch(() => false);
  if (canShare) await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  return uri;
}

/** Хоёртын файлыг түр санд бичээд хуваалцана. */
async function writeBinaryAndShare(filename, bytes, mimeType) {
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, XlsxChart.toBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return share(uri, filename, mimeType);
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------

/** Бэлэн тайланг ГРАФИКТАЙ Excel болгож хуваалцана. */
export async function exportPerformanceExcel(result) {
  const bytes = XlsxChart.build({
    sheets: buildExportSheets(result),
    charts: buildExportCharts(result),
    chartSheetName: 'График',
  });
  return writeBinaryAndShare(`gennetex_guitsetgel_${stamp()}.xlsx`, bytes, XLSX_MIME);
}

/** Импортын хоосон загвар — .xlsx (Excel дээр шууд бөглөнө). */
export async function shareImportTemplate() {
  const bytes = XlsxChart.build({
    sheets: [{ name: 'Импорт загвар', rows: buildTemplateMatrix() }],
  });
  return writeBinaryAndShare('gennetex_guitsetgel_zagvar.xlsx', bytes, XLSX_MIME);
}

// ---------------------------------------------------------------------------
// CSV — Excel байхгүй газар ажиллах нөөц зам
// ---------------------------------------------------------------------------

/**
 * CSV задлагч — хашилт, доторх таслал/мөр шилжилтийг зөв уншина.
 * Таслал ба цэг таслал хоёуланг нь тусгаарлагч болгож хүлээж авна
 * (Excel нь бүсийн тохиргооноос хамаарч ';' бичдэг).
 */
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split('\n')[0] || '';
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Импорт
// ---------------------------------------------------------------------------

/**
 * Файл сонгуулж уншаад шалгасан мөрүүдийг буцаана.
 *
 * @returns {Promise<null | {rows: any[], errors: string[], skipped: number, fileName: string, sheetName?: string}>}
 *          Хэрэглэгч цуцалбал `null`.
 */
export async function pickAndParseImportFile() {
  const res = await DocumentPicker.getDocumentAsync({
    type: [XLSX_MIME, 'text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled) return null;
  const file = res.assets?.[0];
  if (!file?.uri) return null;

  const name = file.name || 'import.csv';

  if (/\.xlsx$/i.test(name)) {
    const b64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // Бидний татсан файлыг буцааж оруулбал «Импорт загвар» хуудас нь зөв
    // бүтэцтэй тул түүнийг эхэлж хайна.
    const sheet = XlsxChart.readSheetMatrix(XlsxChart.fromBase64(b64), {
      prefer: /импорт|загвар|import/i,
    });
    return { ...parseImportMatrix(sheet.matrix), fileName: name, sheetName: sheet.sheetName };
  }

  if (/\.xls$/i.test(name)) {
    throw new Error(
      'Хуучин .xls хэлбэрийг уншиж чадахгүй. Excel дээрээ "Save as → Excel Workbook (.xlsx)" эсвэл "CSV UTF-8" болгож хадгалаад дахин оруулна уу.'
    );
  }

  const text = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
  return { ...parseImportMatrix(parseCsv(text)), fileName: name };
}
