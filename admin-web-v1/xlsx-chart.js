/**
 * ГРАФИКТАЙ EXCEL (.xlsx) — бичих ба унших.
 *
 * ЯАГААД ӨӨРСДӨӨ БИЧСЭН БЭ:
 *   Тайланг «Excel дээр графиктай нь татах» шаардлагатай. Гэвч SheetJS
 *   (admin-web-ийн ашигладаг сан) ба ExcelJS хоёулаа ГРАФИК БИЧИЖ ЧАДДАГГҮЙ.
 *   Зураг болгож наавал Excel дотор тоо засахад шинэчлэгддэггүй «үхмэл»
 *   зураг болно. Тиймээс .xlsx (OOXML) файлыг өөрсдөө угсарч, Excel-ийн
 *   ЖИНХЭНЭ график (chart1.xml)-ийг дотор нь суулгав. Ингэснээр татсан
 *   файл дээрээ Excel дотор мөр нэмэх, өнгө солиход график дагаж өөрчлөгдөнө.
 *
 * ЯАГААД ХОЁР ТАЛД НЭГ ФАЙЛ ВЭ:
 *   Хоёртын формат — нэг байт зөрөхөд Excel «эвдэрсэн файл» гэж хэлнэ. Ийм
 *   кодыг хоёр газар хуулбарлаж барих нь эрсдэлтэй тул энэ файл НЭГ хувь:
 *     · admin-web  — <script src="xlsx-chart.js"> → window.XlsxChart
 *     · мобайл апп — src/services/teamPerformanceExportService.js доторх
 *                    import '../../admin-web/xlsx-chart.js'
 *   Тиймээс энд DOM (window/document) ашиглахгүй, ачаалах үедээ ямар ч
 *   орчны обьект уншихгүй — цэвэр JS байх ёстой.
 *
 * API:
 *   XlsxChart.build({sheets, charts})   → Uint8Array (.xlsx агуулга)
 *   XlsxChart.toBase64(bytes)           → мобайл дээр файл болгож бичихэд
 *   XlsxChart.fromBase64(text)          → мобайл дээр файл уншихад
 *   XlsxChart.readSheetMatrix(bytes,o)  → .xlsx-ийг эгнээ болгож унших (импорт)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.XlsxChart = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // =========================================================================
  // Байт ↔ тэмдэгт мөр
  // =========================================================================

  /** UTF-8 болгож кодлоно. RN дээр TextEncoder байхгүй байж болзошгүй тул гараар. */
  function utf8Bytes(str) {
    var s = String(str == null ? '' : str);
    var out = [];
    for (var i = 0; i < s.length; i += 1) {
      var c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        // Surrogate хос — эможи гэх мэт 4 байтын тэмдэгт.
        var cp = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(i + 1) - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        i += 1;
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return new Uint8Array(out);
  }

  /** UTF-8 байтыг тэмдэгт мөр болгоно. */
  function utf8Decode(bytes) {
    var out = '';
    var i = 0;
    while (i < bytes.length) {
      var c = bytes[i++];
      if (c < 0x80) out += String.fromCharCode(c);
      else if (c > 0xbf && c < 0xe0) out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
      else if (c > 0xdf && c < 0xf0) out += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
      else {
        var u = (((c & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)) - 0x10000;
        out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
      }
    }
    return out;
  }

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  /** Хоёртын өгөгдөл → base64 (мобайл дээр файлд бичихэд). */
  function toBase64(bytes) {
    var out = '';
    var i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    var rest = bytes.length - i;
    if (rest === 1) {
      var a = bytes[i] << 16;
      out += B64[(a >> 18) & 63] + B64[(a >> 12) & 63] + '==';
    } else if (rest === 2) {
      var b = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += B64[(b >> 18) & 63] + B64[(b >> 12) & 63] + B64[(b >> 6) & 63] + '=';
    }
    return out;
  }

  /** base64 → байт (мобайл дээр сонгосон файлыг унших). */
  function fromBase64(str) {
    var s = String(str || '').replace(/[^A-Za-z0-9+/=]/g, '');
    s = s.replace(/=+$/, '');
    var out = new Uint8Array(Math.floor((s.length * 3) / 4));
    var p = 0;
    for (var i = 0; i < s.length; i += 4) {
      var c0 = B64.indexOf(s[i]);
      var c1 = B64.indexOf(s[i + 1]);
      var c2 = B64.indexOf(s[i + 2]);
      var c3 = B64.indexOf(s[i + 3]);
      var n = (c0 << 18) | ((c1 < 0 ? 0 : c1) << 12) | ((c2 < 0 ? 0 : c2) << 6) | (c3 < 0 ? 0 : c3);
      if (p < out.length) out[p++] = (n >> 16) & 255;
      if (p < out.length) out[p++] = (n >> 8) & 255;
      if (p < out.length) out[p++] = n & 255;
    }
    return out;
  }

  // =========================================================================
  // ZIP — .xlsx бол зүгээр л zip архив
  // =========================================================================

  var CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    CRC_TABLE = new Uint32Array(256);
    for (var n = 0; n < 256; n += 1) {
      var c = n;
      for (var k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
    return CRC_TABLE;
  }

  function crc32(bytes) {
    var t = crcTable();
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i += 1) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /**
   * Файлуудыг zip болгоно — ШАХАЛТГҮЙ («stored»).
   *
   * Шахалтгүй нь: файл арай том боловч deflate бичих код хэрэггүй. Тайлангийн
   * XML нь хэдэн зуун КБ — асуудалгүй. Excel шахалтгүй zip-ийг хэвийн уншина.
   */
  function zip(files) {
    var chunks = [];
    var central = [];
    var offset = 0;

    files.forEach(function (f) {
      var nameB = utf8Bytes(f.name);
      var dataB = f.data;
      var crc = crc32(dataB);

      var local = new Uint8Array(30 + nameB.length);
      var dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);      // шаардлагатай хамгийн бага хувилбар
      dv.setUint16(6, 0x0800, true);  // нэр нь UTF-8
      dv.setUint16(8, 0, true);       // шахалтгүй
      dv.setUint16(10, 0, true);      // цаг
      dv.setUint16(12, 0x21, true);   // огноо (тогтмол — 1980-01-01)
      dv.setUint32(14, crc, true);
      dv.setUint32(18, dataB.length, true);
      dv.setUint32(22, dataB.length, true);
      dv.setUint16(26, nameB.length, true);
      local.set(nameB, 30);

      var cd = new Uint8Array(46 + nameB.length);
      var cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, dataB.length, true);
      cv.setUint32(24, dataB.length, true);
      cv.setUint16(28, nameB.length, true);
      cv.setUint32(42, offset, true);
      cd.set(nameB, 46);

      chunks.push(local, dataB);
      central.push(cd);
      offset += local.length + dataB.length;
    });

    var body = offset;
    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, body, true);

    var out = new Uint8Array(body + cdSize + 22);
    var pos = 0;
    chunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
    central.forEach(function (c) { out.set(c, pos); pos += c.length; });
    out.set(end, pos);
    return out;
  }

  // =========================================================================
  // XLSX бичих
  // =========================================================================

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 0 → A, 25 → Z, 26 → AA */
  function colLetter(index) {
    var s = '';
    var i = index + 1;
    while (i > 0) {
      var m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  function isNumeric(v) {
    return typeof v === 'number' && isFinite(v);
  }

  var XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  var NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  var NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  var NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
  var NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';

  /** Хуудасны нэр — Excel-ийн хориотой тэмдэгт, 31 тэмдэгтийн хязгаар. */
  function safeSheetName(name, index) {
    var s = String(name || '').replace(/[\\/*?:[\]]/g, ' ').trim();
    if (!s) s = 'Sheet' + (index + 1);
    return s.slice(0, 31);
  }

  /** Томьёон дотор хуудасны нэрийг иш татах: 'Өдрөөр'!$A$2 */
  function sheetRef(name) {
    return "'" + String(name).replace(/'/g, "''") + "'";
  }

  function columnWidths(rows) {
    var widths = [];
    (rows || []).forEach(function (row) {
      (row || []).forEach(function (cell, i) {
        var len = String(cell == null ? '' : cell).length;
        if (!widths[i] || widths[i] < len) widths[i] = len;
      });
    });
    return widths.map(function (w) {
      return Math.min(46, Math.max(9, (w || 0) + 2));
    });
  }

  function sheetXml(rows, drawingRelId) {
    var widths = columnWidths(rows);
    var cols = widths.length
      ? '<cols>' + widths.map(function (w, i) {
          return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
        }).join('') + '</cols>'
      : '';

    var body = (rows || []).map(function (row, r) {
      var cells = (row || []).map(function (value, c) {
        var ref = colLetter(c) + (r + 1);
        var style = r === 0 ? ' s="1"' : '';
        if (value == null || value === '') return '<c r="' + ref + '"' + style + '/>';
        if (isNumeric(value)) return '<c r="' + ref + '"' + style + '><v>' + value + '</v></c>';
        return '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' + esc(value) + '</t></is></c>';
      }).join('');
      return '<row r="' + (r + 1) + '">' + cells + '</row>';
    }).join('');

    return XML_HEAD +
      '<worksheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '">' +
      '<sheetFormatPr defaultRowHeight="15"/>' + cols +
      '<sheetData>' + body + '</sheetData>' +
      (drawingRelId ? '<drawing r:id="' + drawingRelId + '"/>' : '') +
      '</worksheet>';
  }

  function stylesXml() {
    return XML_HEAD +
      '<styleSheet xmlns="' + NS_MAIN + '">' +
      '<fonts count="2">' +
        '<font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF0F6FA8"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  var SERIES_COLORS = ['0099DB', '0B7A44', '6D4AA8', 'B45309', '0F766E', 'D92D20'];

  function richText(text, size, bold) {
    return '<c:rich><a:bodyPr/><a:lstStyle/><a:p>' +
      '<a:pPr><a:defRPr sz="' + size + '" b="' + (bold ? 1 : 0) + '"/></a:pPr>' +
      '<a:r><a:rPr lang="mn-MN" sz="' + size + '" b="' + (bold ? 1 : 0) + '"/><a:t>' + esc(text) + '</a:t></a:r>' +
      '</a:p></c:rich>';
  }

  /**
   * Нэг цуврал (series) — өгөгдлийн хуудасны БАГАНА руу заана.
   *
   * `strCache`/`numCache` нь заавал: Excel файлыг нээхэд томьёог дахин
   * тооцоолохоос ӨМНӨ графикийг эдгээр хадгалсан утгаар зурна. Кэшгүй бол
   * зарим хувилбар дээр хоосон график харагдана.
   */
  function seriesXml(chart, s, idx, ctx) {
    var ref = sheetRef(ctx.sheetName);
    var firstRow = ctx.firstDataRow;
    var lastRow = ctx.lastDataRow;
    var catCol = colLetter(chart.catCol || 0);
    var valCol = colLetter(s.col);
    var color = s.color || SERIES_COLORS[idx % SERIES_COLORS.length];

    var nameRef = ref + '!$' + valCol + '$1';
    var catRange = ref + '!$' + catCol + '$' + firstRow + ':$' + catCol + '$' + lastRow;
    var valRange = ref + '!$' + valCol + '$' + firstRow + ':$' + valCol + '$' + lastRow;

    var cats = ctx.rows.map(function (row) { return String(row[chart.catCol || 0] == null ? '' : row[chart.catCol || 0]); });
    var vals = ctx.rows.map(function (row) { return Number(row[s.col]) || 0; });

    var catCache = '<c:strCache><c:ptCount val="' + cats.length + '"/>' +
      cats.map(function (v, i) { return '<c:pt idx="' + i + '"><c:v>' + esc(v) + '</c:v></c:pt>'; }).join('') +
      '</c:strCache>';
    var valCache = '<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="' + vals.length + '"/>' +
      vals.map(function (v, i) { return '<c:pt idx="' + i + '"><c:v>' + v + '</c:v></c:pt>'; }).join('') +
      '</c:numCache>';

    var head = '<c:idx val="' + idx + '"/><c:order val="' + idx + '"/>' +
      '<c:tx><c:strRef><c:f>' + esc(nameRef) + '</c:f>' +
      '<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>' + esc(s.name || ('Цуврал ' + (idx + 1))) + '</c:v></c:pt></c:strCache>' +
      '</c:strRef></c:tx>';

    var fill = chart.type === 'line'
      ? '<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>'
      : '<c:spPr><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>';

    var data = '<c:cat><c:strRef><c:f>' + esc(catRange) + '</c:f>' + catCache + '</c:strRef></c:cat>' +
      '<c:val><c:numRef><c:f>' + esc(valRange) + '</c:f>' + valCache + '</c:numRef></c:val>';

    return '<c:ser>' + head + fill + data + (chart.type === 'line' ? '<c:smooth val="0"/>' : '') + '</c:ser>';
  }

  function chartXml(chart, ctx) {
    var axCat = 100000000 + ctx.chartIndex * 10;
    var axVal = axCat + 1;
    var sers = (chart.series || []).map(function (s, i) { return seriesXml(chart, s, i, ctx); }).join('');

    var plot = chart.type === 'line'
      ? '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' + sers +
        '<c:marker val="1"/><c:axId val="' + axCat + '"/><c:axId val="' + axVal + '"/></c:lineChart>'
      : '<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>' + sers +
        '<c:gapWidth val="60"/><c:overlap val="' + (chart.series && chart.series.length > 1 ? -10 : 0) + '"/>' +
        '<c:axId val="' + axCat + '"/><c:axId val="' + axVal + '"/></c:barChart>';

    return XML_HEAD +
      '<c:chartSpace xmlns:c="' + NS_C + '" xmlns:a="' + NS_A + '" xmlns:r="' + NS_REL + '">' +
      '<c:chart>' +
      '<c:title><c:tx>' + richText(chart.title || '', 1200, true) + '</c:tx><c:overlay val="0"/></c:title>' +
      '<c:autoTitleDeleted val="0"/>' +
      '<c:plotArea><c:layout/>' + plot +
      '<c:catAx><c:axId val="' + axCat + '"/><c:scaling><c:orientation val="minMax"/></c:scaling>' +
      '<c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="' + axVal + '"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/>' +
      '</c:catAx>' +
      '<c:valAx><c:axId val="' + axVal + '"/><c:scaling><c:orientation val="minMax"/></c:scaling>' +
      '<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/>' +
      '<c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="' + axCat + '"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>' +
      '</c:valAx>' +
      '</c:plotArea>' +
      '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' +
      '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>' +
      '</c:chart>' +
      '</c:chartSpace>';
  }

  /** График бүрийг графикийн хуудсан дээр дээрээс доош байрлуулна. */
  function drawingXml(charts) {
    var anchors = charts.map(function (chart, i) {
      var top = i * (chart.rowsTall || 20);
      var bottom = top + ((chart.rowsTall || 20) - 1);
      return '<xdr:twoCellAnchor>' +
        '<xdr:from><xdr:col>0</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>' + top + '</xdr:row><xdr:rowOff>76200</xdr:rowOff></xdr:from>' +
        '<xdr:to><xdr:col>' + (chart.colsWide || 11) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + bottom + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
        '<xdr:graphicFrame macro="">' +
        '<xdr:nvGraphicFramePr><xdr:cNvPr id="' + (i + 2) + '" name="График ' + (i + 1) + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
        '<a:graphic><a:graphicData uri="' + NS_C + '">' +
        '<c:chart xmlns:c="' + NS_C + '" xmlns:r="' + NS_REL + '" r:id="rId' + (i + 1) + '"/>' +
        '</a:graphicData></a:graphic>' +
        '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
    }).join('');
    return XML_HEAD + '<xdr:wsDr xmlns:xdr="' + NS_XDR + '" xmlns:a="' + NS_A + '">' + anchors + '</xdr:wsDr>';
  }

  /**
   * Графиктай .xlsx угсарна.
   *
   * @param {{
   *   sheets: {name: string, rows: any[][]}[],
   *   charts?: {title: string, type?: 'bar'|'line', sheet: string,
   *             catCol?: number, series: {col: number, name?: string, color?: string}[],
   *             rowsTall?: number, colsWide?: number}[],
   *   chartSheetName?: string
   * }} spec
   * @returns {Uint8Array}
   */
  function build(spec) {
    var dataSheets = (spec.sheets || []).map(function (sh, i) {
      return { name: safeSheetName(sh.name, i), rows: sh.rows || [[]] };
    });

    // Графикт заасан хуудас байхгүй бол тэр графикийг алгасана — файл
    // эвдрэхээс сэргийлнэ.
    var byName = {};
    dataSheets.forEach(function (sh) { byName[sh.name] = sh; });
    var charts = (spec.charts || []).filter(function (ch) {
      var sh = byName[safeSheetName(ch.sheet, 0)];
      return sh && sh.rows.length > 1 && (ch.series || []).length;
    }).map(function (ch) {
      return Object.assign({}, ch, { sheet: safeSheetName(ch.sheet, 0) });
    });

    var sheets = dataSheets.slice();
    var chartSheetIndex = -1;
    if (charts.length) {
      // График хуудсыг ХАМГИЙН ЭХЭНД — файлыг нээмэгц график харагдана.
      sheets.unshift({ name: safeSheetName(spec.chartSheetName || 'График', 0), rows: [] });
      chartSheetIndex = 0;
    }

    var files = [];
    var sheetPaths = sheets.map(function (_, i) { return 'xl/worksheets/sheet' + (i + 1) + '.xml'; });

    // -- [Content_Types].xml
    var types = XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheetPaths.map(function (p) {
        return '<Override PartName="/' + p + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      (charts.length ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '') +
      charts.map(function (_, i) {
        return '<Override PartName="/xl/charts/chart' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>';
      }).join('') +
      '</Types>';
    files.push({ name: '[Content_Types].xml', data: utf8Bytes(types) });

    // -- _rels/.rels
    files.push({
      name: '_rels/.rels',
      data: utf8Bytes(XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="' + NS_REL + '/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'),
    });

    // -- xl/workbook.xml
    files.push({
      name: 'xl/workbook.xml',
      data: utf8Bytes(XML_HEAD +
        '<workbook xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '"><sheets>' +
        sheets.map(function (sh, i) {
          return '<sheet name="' + esc(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
        }).join('') +
        '</sheets></workbook>'),
    });

    // -- xl/_rels/workbook.xml.rels
    files.push({
      name: 'xl/_rels/workbook.xml.rels',
      data: utf8Bytes(XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (_, i) {
          return '<Relationship Id="rId' + (i + 1) + '" Type="' + NS_REL + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
        }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + NS_REL + '/styles" Target="styles.xml"/>' +
        '</Relationships>'),
    });

    // -- хуудсууд
    sheets.forEach(function (sh, i) {
      files.push({
        name: sheetPaths[i],
        data: utf8Bytes(sheetXml(sh.rows, i === chartSheetIndex ? 'rId1' : null)),
      });
    });

    files.push({ name: 'xl/styles.xml', data: utf8Bytes(stylesXml()) });

    // -- зураг ба графикууд
    if (charts.length) {
      files.push({
        name: 'xl/worksheets/_rels/sheet' + (chartSheetIndex + 1) + '.xml.rels',
        data: utf8Bytes(XML_HEAD +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="' + NS_REL + '/drawing" Target="../drawings/drawing1.xml"/>' +
          '</Relationships>'),
      });
      files.push({ name: 'xl/drawings/drawing1.xml', data: utf8Bytes(drawingXml(charts)) });
      files.push({
        name: 'xl/drawings/_rels/drawing1.xml.rels',
        data: utf8Bytes(XML_HEAD +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          charts.map(function (_, i) {
            return '<Relationship Id="rId' + (i + 1) + '" Type="' + NS_REL + '/chart" Target="../charts/chart' + (i + 1) + '.xml"/>';
          }).join('') +
          '</Relationships>'),
      });
      charts.forEach(function (ch, i) {
        var sh = byName[ch.sheet];
        var dataRows = sh.rows.slice(1);
        files.push({
          name: 'xl/charts/chart' + (i + 1) + '.xml',
          data: utf8Bytes(chartXml(ch, {
            chartIndex: i,
            sheetName: ch.sheet,
            rows: dataRows,
            firstDataRow: 2,
            lastDataRow: sh.rows.length,
          })),
        });
      });
    }

    return zip(files);
  }

  // =========================================================================
  // XLSX унших — Excel дээр засаад буцааж импортлоход
  // =========================================================================

  // ---- deflate задлагч (tinf-ийн алгоритм) --------------------------------
  var LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var CLCIDX = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  function buildTree(lengths, off, num) {
    var table = new Uint16Array(16);
    var trans = new Uint16Array(num);
    var offs = new Uint16Array(16);
    var i;
    for (i = 0; i < num; i += 1) table[lengths[off + i]] += 1;
    table[0] = 0;
    var sum = 0;
    for (i = 0; i < 16; i += 1) { offs[i] = sum; sum += table[i]; }
    for (i = 0; i < num; i += 1) if (lengths[off + i]) trans[offs[lengths[off + i]]++] = i;
    return { table: table, trans: trans };
  }

  var FIXED_LT = null;
  var FIXED_DT = null;
  function fixedTrees() {
    if (FIXED_LT) return;
    var l = new Uint8Array(288);
    var i;
    for (i = 0; i < 144; i += 1) l[i] = 8;
    for (i = 144; i < 256; i += 1) l[i] = 9;
    for (i = 256; i < 280; i += 1) l[i] = 7;
    for (i = 280; i < 288; i += 1) l[i] = 8;
    FIXED_LT = buildTree(l, 0, 288);
    var d = new Uint8Array(30);
    for (i = 0; i < 30; i += 1) d[i] = 5;
    FIXED_DT = buildTree(d, 0, 30);
  }

  function nextByte(d) {
    return d.pos < d.src.length ? d.src[d.pos++] : 0;
  }

  function getBit(d) {
    if (!d.bitcnt) { d.tag = nextByte(d); d.bitcnt = 8; }
    var bit = d.tag & 1;
    d.tag >>>= 1;
    d.bitcnt -= 1;
    return bit;
  }

  function readBits(d, num, base) {
    if (!num) return base;
    while (d.bitcnt < 24) { d.tag |= nextByte(d) << d.bitcnt; d.bitcnt += 8; }
    var val = d.tag & (0xffff >>> (16 - num));
    d.tag >>>= num;
    d.bitcnt -= num;
    return val + base;
  }

  function decodeSymbol(d, t) {
    while (d.bitcnt < 24) { d.tag |= nextByte(d) << d.bitcnt; d.bitcnt += 8; }
    var sum = 0;
    var cur = 0;
    var len = 0;
    var tag = d.tag;
    do {
      cur = 2 * cur + (tag & 1);
      tag >>>= 1;
      len += 1;
      sum += t.table[len];
      cur -= t.table[len];
      if (len > 15) throw new Error('deflate: код таарахгүй');
    } while (cur >= 0);
    d.tag = tag;
    d.bitcnt -= len;
    return t.trans[sum + cur];
  }

  function decodeTrees(d) {
    var lengths = new Uint8Array(320);
    var hlit = readBits(d, 5, 257);
    var hdist = readBits(d, 5, 1);
    var hclen = readBits(d, 4, 4);
    var i;
    for (i = 0; i < 19; i += 1) lengths[i] = 0;
    for (i = 0; i < hclen; i += 1) lengths[CLCIDX[i]] = readBits(d, 3, 0);
    var codeTree = buildTree(lengths, 0, 19);
    for (i = 0; i < 320; i += 1) lengths[i] = 0;
    var num = 0;
    while (num < hlit + hdist) {
      var sym = decodeSymbol(d, codeTree);
      var length;
      if (sym === 16) {
        var prev = lengths[num - 1];
        length = readBits(d, 2, 3);
        while (length--) { lengths[num++] = prev; }
      } else if (sym === 17) {
        length = readBits(d, 3, 3);
        while (length--) { lengths[num++] = 0; }
      } else if (sym === 18) {
        length = readBits(d, 7, 11);
        while (length--) { lengths[num++] = 0; }
      } else lengths[num++] = sym;
    }
    return { lt: buildTree(lengths, 0, hlit), dt: buildTree(lengths, hlit, hdist) };
  }

  function push(d, byte) {
    if (d.destLen >= d.dest.length) {
      var bigger = new Uint8Array(d.dest.length * 2 + 1024);
      bigger.set(d.dest);
      d.dest = bigger;
    }
    d.dest[d.destLen++] = byte;
  }

  function inflateBlock(d, lt, dt) {
    for (;;) {
      var sym = decodeSymbol(d, lt);
      if (sym === 256) return;
      if (sym < 256) { push(d, sym); continue; }
      sym -= 257;
      var length = readBits(d, LENGTH_EXTRA[sym], LENGTH_BASE[sym]);
      var dsym = decodeSymbol(d, dt);
      var dist = readBits(d, DIST_EXTRA[dsym], DIST_BASE[dsym]);
      var offs = d.destLen - dist;
      if (offs < 0) throw new Error('deflate: буруу зай');
      for (var i = 0; i < length; i += 1) push(d, d.dest[offs + i]);
    }
  }

  function inflateStored(d) {
    d.bitcnt = 0;
    d.tag = 0;
    var len = nextByte(d) | (nextByte(d) << 8);
    nextByte(d);
    nextByte(d);
    for (var i = 0; i < len; i += 1) push(d, nextByte(d));
  }

  /** Түүхий deflate (zip доторх) урсгалыг задлана. */
  function inflateRaw(src, expectedLen) {
    fixedTrees();
    var d = {
      src: src,
      pos: 0,
      tag: 0,
      bitcnt: 0,
      dest: new Uint8Array(expectedLen || src.length * 4 + 1024),
      destLen: 0,
    };
    var final;
    do {
      final = getBit(d);
      var type = readBits(d, 2, 0);
      if (type === 0) inflateStored(d);
      else if (type === 1) inflateBlock(d, FIXED_LT, FIXED_DT);
      else if (type === 2) {
        var trees = decodeTrees(d);
        inflateBlock(d, trees.lt, trees.dt);
      } else throw new Error('deflate: тодорхойгүй блок');
    } while (!final);
    return d.dest.subarray(0, d.destLen);
  }

  // ---- zip задлагч --------------------------------------------------------
  function unzip(bytes) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var eocd = -1;
    for (var i = bytes.length - 22; i >= 0 && i > bytes.length - 70000; i -= 1) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Файл zip (xlsx) биш байна.');
    var count = dv.getUint16(eocd + 10, true);
    var cdOffset = dv.getUint32(eocd + 16, true);

    var out = {};
    var p = cdOffset;
    for (var n = 0; n < count; n += 1) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var compSize = dv.getUint32(p + 20, true);
      var uncompSize = dv.getUint32(p + 24, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commentLen = dv.getUint16(p + 32, true);
      var localOff = dv.getUint32(p + 42, true);
      var name = utf8Decode(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;

      // Хэмжээ нь ТӨВ каталогт үнэн (локал толгойд 0 байж болно).
      var lNameLen = dv.getUint16(localOff + 26, true);
      var lExtraLen = dv.getUint16(localOff + 28, true);
      var start = localOff + 30 + lNameLen + lExtraLen;
      var raw = bytes.subarray(start, start + compSize);
      out[name] = method === 0 ? raw : inflateRaw(raw, uncompSize);
    }
    return out;
  }

  // ---- XML → эгнээ --------------------------------------------------------
  function unescapeXml(s) {
    return String(s)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); })
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&amp;/g, '&');
  }

  function attr(tag, name) {
    var m = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '="([^"]*)"').exec(tag);
    return m ? unescapeXml(m[1]) : null;
  }

  function textOfTags(xml) {
    var re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    var out = '';
    var m;
    while ((m = re.exec(xml))) out += unescapeXml(m[1]);
    return out;
  }

  function parseSharedStrings(xml) {
    var re = /<si>([\s\S]*?)<\/si>/g;
    var list = [];
    var m;
    while ((m = re.exec(xml))) list.push(textOfTags(m[1]));
    return list;
  }

  /** "BC12" → 54 (0-ээс эхэлсэн баганын дугаар) */
  function refToCol(ref) {
    var m = /^([A-Z]+)/.exec(String(ref || '').toUpperCase());
    if (!m) return -1;
    var n = 0;
    for (var i = 0; i < m[1].length; i += 1) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }

  function parseSheet(xml, shared) {
    var rows = [];
    var rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
    var rowM;
    while ((rowM = rowRe.exec(xml))) {
      var cells = [];
      var cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      var cellM;
      while ((cellM = cellRe.exec(rowM[2]))) {
        var tag = cellM[1] || '';
        var inner = cellM[2] || '';
        var col = refToCol(attr(tag, 'r'));
        if (col < 0) col = cells.length;
        var type = attr(tag, 't');
        var value = '';
        if (type === 'inlineStr') value = textOfTags(inner);
        else {
          var vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
          var raw = vm ? unescapeXml(vm[1]) : '';
          if (type === 's') value = shared[Number(raw)] != null ? shared[Number(raw)] : '';
          else if (type === 'str' || type === 'e') value = raw;
          else if (raw === '') value = '';
          else value = isNaN(Number(raw)) ? raw : Number(raw);
        }
        while (cells.length < col) cells.push('');
        cells[col] = value;
      }
      var rowIndex = Number(attr(rowM[1], 'r') || rows.length + 1) - 1;
      while (rows.length < rowIndex) rows.push([]);
      rows[rowIndex] = cells;
    }
    return rows;
  }

  /**
   * .xlsx файлыг эгнээний массив болгож унших.
   *
   * @param {Uint8Array} bytes
   * @param {{prefer?: RegExp}} [opts] `prefer` таарсан нэртэй хуудсыг эхэлж
   *        хайна (жишээ нь бидний гаргасан «Импорт загвар» хуудас).
   * @returns {{matrix: any[][], sheetName: string, sheetNames: string[]}}
   */
  function readSheetMatrix(bytes, opts) {
    var files = unzip(bytes);
    var read = function (name) { return files[name] ? utf8Decode(files[name]) : null; };

    var wb = read('xl/workbook.xml');
    if (!wb) throw new Error('Excel файлын бүтэц танигдсангүй.');
    var relsXml = read('xl/_rels/workbook.xml.rels') || '';
    var rels = {};
    var relRe = /<Relationship\b([^>]*)\/>/g;
    var rm;
    while ((rm = relRe.exec(relsXml))) {
      var id = attr(rm[1], 'Id');
      var target = attr(rm[1], 'Target');
      if (id && target) rels[id] = String(target).replace(/^\/?xl\//, '').replace(/^\//, '');
    }

    var shared = [];
    var ssXml = read('xl/sharedStrings.xml');
    if (ssXml) shared = parseSharedStrings(ssXml);

    var sheets = [];
    var shRe = /<sheet\b([^>]*)\/>/g;
    var sm;
    while ((sm = shRe.exec(wb))) {
      sheets.push({
        name: attr(sm[1], 'name') || ('Sheet' + (sheets.length + 1)),
        path: 'xl/' + (rels[attr(sm[1], 'r:id')] || ('worksheets/sheet' + (sheets.length + 1) + '.xml')),
      });
    }
    if (!sheets.length) throw new Error('Excel дотор хуудас олдсонгүй.');

    var chosen = null;
    if (opts && opts.prefer) chosen = sheets.filter(function (s) { return opts.prefer.test(s.name); })[0];
    if (!chosen) {
      // Хоосон биш эхний хуудас (график хуудас нь хоосон байдаг).
      for (var i = 0; i < sheets.length && !chosen; i += 1) {
        var xml = read(sheets[i].path);
        if (xml && /<c\b/.test(xml)) chosen = sheets[i];
      }
    }
    if (!chosen) chosen = sheets[0];

    var sheetXmlText = read(chosen.path);
    if (!sheetXmlText) throw new Error('«' + chosen.name + '» хуудсыг уншиж чадсангүй.');
    return {
      matrix: parseSheet(sheetXmlText, shared),
      sheetName: chosen.name,
      sheetNames: sheets.map(function (s) { return s.name; }),
    };
  }

  return {
    build: build,
    toBase64: toBase64,
    fromBase64: fromBase64,
    readSheetMatrix: readSheetMatrix,
    // Туслах — шалгалт, дахин ашиглалтад
    zip: zip,
    unzip: unzip,
    inflateRaw: inflateRaw,
    utf8Bytes: utf8Bytes,
    utf8Decode: utf8Decode,
  };
});
