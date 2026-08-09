import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import { UNIVISION_LOGO_SVG } from '../lib/univisionLogo';
import { fetchInventory, fetchMovements } from './inventoryService';
import { MOVEMENT_TYPES } from '../lib/stockBalance';
import { callGeminiText } from './gennetexAiService';

const LOW_STOCK = 5;

const SHORTAGE_SYSTEM = `Чи бол Gennetex/Univision компанийн агуулахын нөөц хянагч AI.
Танд бараа материалын жагсаалт (нэр, нэгж, одоогийн үлдэгдэл, сүүлийн 30 хоногийн зарлага) өгнө.
Дутагдаж буй буюу нөхөх шаардлагатай бараануудыг ТОДОРХОЙЛ:
- Үлдэгдэл нь босго (lowThreshold)-оос бага, ЭСВЭЛ сарын зарлагаас бага бол дутагдалтай.
- need (шаардах тоо хэмжээ) = дараагийн 1 сарыг хүргэхэд шаардагдах нөхөлт (сарын зарлага + буфер − одоогийн үлдэгдэл), хамгийн багадаа босго хүртэл.
- Хангалттай нөөцтэй барааг ОРУУЛАХГҮЙ.

ЗӨВХӨН дараах JSON буцаа (өөр текст үгүй):
{
  "items": [
    { "name": "барааны нэр", "unit": "нэгж", "currentQuantity": 0, "need": 0, "reason": "богино шалтгаан" }
  ]
}`;

/**
 * AI-аар дутагдаж буй бараа материалыг тооцоод шаардах хуудсанд бэлэн мөр болгож буцаана.
 * Gemini түлхүүр байхгүй/алдаа гарвал детерминист (босго + зарлага) тооцоо руу шилжинэ.
 */
export async function computeShortageSuggestions({ useAi = true } = {}) {
  const inv = await fetchInventory();
  const materials = (inv || []).filter((i) => (i.category || 'material') === 'material');
  const movements = await fetchMovements(1000).catch(() => []);

  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const used = {};
  for (const m of movements) {
    if (m.movement_type !== MOVEMENT_TYPES.WITHDRAW) continue;
    const when = new Date(m.created_at).getTime();
    if (when >= since && m.item_id) {
      used[m.item_id] = (used[m.item_id] || 0) + (Number(m.quantity) || 0);
    }
  }

  const enriched = materials.map((it) => ({ it, monthly: used[it.id] || 0 }));

  const toRow = (it, need) => ({
    name: it.name || '',
    need: String(Math.max(0, Math.ceil(need)) || ''),
    regNo: it.barcode || '',
    techCode: it.model || it.serial || '',
    oldLoc: '',
    unit: it.unit || 'ш',
    qty: String(it.quantity ?? ''),
    newLoc: '',
  });

  const deterministic = () =>
    enriched
      .map(({ it, monthly }) => {
        const target = Math.max(monthly, LOW_STOCK * 2);
        const need = Math.max(0, Math.ceil(target - (Number(it.quantity) || 0)));
        const short = (Number(it.quantity) || 0) <= LOW_STOCK || (Number(it.quantity) || 0) < monthly;
        return { it, need, short };
      })
      .filter((x) => x.short && x.need > 0)
      .map((x) => toRow(x.it, x.need));

  if (useAi && enriched.length) {
    try {
      const payload = {
        lowThreshold: LOW_STOCK,
        items: enriched.map(({ it, monthly }) => ({
          name: it.name,
          unit: it.unit || 'ш',
          quantity: Number(it.quantity) || 0,
          monthlyUsed: monthly,
        })),
      };
      const parsed = await callGeminiText(SHORTAGE_SYSTEM, JSON.stringify(payload, null, 2), { json: true });
      const aiItems = Array.isArray(parsed?.items) ? parsed.items : [];
      if (aiItems.length) {
        const byName = {};
        materials.forEach((m) => {
          byName[String(m.name || '').trim().toLowerCase()] = m;
        });
        const rows = aiItems
          .map((a) => {
            const match = byName[String(a.name || '').trim().toLowerCase()];
            const base = match || { name: a.name, unit: a.unit, quantity: a.currentQuantity };
            const row = toRow(base, Number(a.need) || 0);
            if (a.need != null) row.need = String(Math.max(0, Math.ceil(Number(a.need))) || '');
            if (!match && a.currentQuantity != null) row.qty = String(a.currentQuantity);
            return row;
          })
          .filter((r) => r.name);
        if (rows.length) return rows;
      }
    } catch (e) {
      // Gemini алдаа — детерминист руу шилжинэ
    }
  }

  return deterministic();
}



function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Гарын үсгийн SVG-г HTML дотор аюулгүй байрлуулах (зөвхөн svg байвал)
function sigBlock(svg) {
  const s = String(svg || '').trim();
  if (s.startsWith('<svg')) return `<div class="sig-svg">${s}</div>`;
  return '<div class="sig-line"></div>';
}

function num(v) {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function fmt(n) {
  return (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function itemRows(items) {
  const rows = (items || []).filter(
    (it) => (it.name || '').trim() || String(it.qty ?? '').trim() || String(it.need ?? '').trim()
  );
  const dataRows = rows
    .map(
      (it, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td>${escHtml(it.name)}</td>
        <td>${escHtml(it.need || '')}</td>
        <td>${escHtml(it.regNo || '')}</td>
        <td>${escHtml(it.techCode || '')}</td>
        <td>${escHtml(it.oldLoc || '')}</td>
        <td class="c">${escHtml(it.unit || '')}</td>
        <td class="r">${it.qty ? fmt(num(it.qty)) : ''}</td>
        <td>${escHtml(it.newLoc || '')}</td>
      </tr>`
    )
    .join('');
  // Хуудсыг дүүргэх хоосон мөр
  const filler = Math.max(0, 6 - rows.length);
  const empty = Array.from({ length: filler })
    .map(
      (_, i) => `<tr class="empty">
        <td class="c">${rows.length + i + 1}</td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`
    )
    .join('');
  return dataRows + empty;
}

// A-цувралын жинхэнэ шугаман харьцаа (A4 = 1). Хуудас бага болох тусам агуулга ижил
// харьцаагаар багасаж, физик хэмжээндээ яг багтана.
const PAGE_SCALE = { A4: 1, A5: 0.707, A6: 0.5, A7: 0.354 };

// Хэвтээ (landscape) чиглэлд хуудас тус бүрийн бодит хэмжээ (point, 72dpi).
// expo-print нь @page size-ийг үл тоомсорлодог тул энэ хэмжээг шууд дамжуулна.
const PAGE_POINTS = {
  A4: { width: 841.89, height: 595.28 },
  A5: { width: 595.28, height: 419.53 },
  A6: { width: 419.53, height: 297.64 },
  A7: { width: 297.64, height: 209.76 },
};

export function buildRequisitionHtml(data = {}) {
  const {
    companyName = 'Юнивишн ХХК',
    docNo = '',
    date = new Date().toLocaleDateString('en-CA'),
    purpose = '',
    partner = '',
    name = '',
    position = '',
    company = '',
    items = [],
    receiverName = '',
    receiverSig = '',
    directorName = '',
    directorSig = '',
    pageSize = 'A5',
  } = data;

  const size = PAGE_SCALE[pageSize] ? pageSize : 'A5';
  const k = PAGE_SCALE[size];
  const s = (n) => (n * k).toFixed(1); // хэмжээнд тохируулан масштаблах (px)

  const total = (items || []).reduce((sum, it) => sum + num(it.qty), 0);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: ${size} landscape; margin: ${s(14)}px; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, "Segoe UI", sans-serif; color: #111827; margin: 0; padding: ${s(4)}px ${s(8)}px; font-size: ${s(12)}px; }
  .logos { display: flex; align-items: center; justify-content: flex-start; margin-bottom: ${s(4)}px; }
  .logos .uv svg { height: ${s(40)}px; width: auto; }
  .title { text-align: center; font-size: ${s(18)}px; font-weight: 800; letter-spacing: 0.5px; margin: ${s(2)}px 0 ${s(12)}px; }
  .head { display: flex; justify-content: space-between; gap: ${s(30)}px; margin-bottom: ${s(12)}px; }
  .head .col { flex: 1; }
  .kv { display: flex; margin-bottom: ${s(4)}px; }
  .kv .k { color: #4b5563; min-width: ${s(92)}px; }
  .kv .v { border-bottom: 1px solid #cbd5e1; flex: 1; padding-left: ${s(4)}px; }
  table { width: 100%; border-collapse: collapse; margin-top: ${s(4)}px; table-layout: fixed; }
  th, td { border: 1px solid #4b5563; padding: ${s(6)}px ${s(5)}px; font-size: ${s(11)}px; vertical-align: middle; word-wrap: break-word; }
  th { background: #e5e7eb; font-weight: 700; text-align: center; }
  td.c { text-align: center; }
  td.r { text-align: right; }
  tr.empty td { height: ${s(24)}px; }
  tr.total td { font-weight: 800; background: #f3f4f6; }
  .signs { display: flex; justify-content: space-between; margin-top: ${s(26)}px; gap: ${s(40)}px; }
  .sign { flex: 1; }
  .sign .role { font-size: ${s(12)}px; color: #374151; margin-bottom: ${s(2)}px; }
  .sig-svg { height: ${s(54)}px; display: flex; align-items: flex-end; }
  .sig-svg svg { max-height: ${s(52)}px; max-width: ${s(220)}px; }
  .sig-line { height: ${s(46)}px; border-bottom: 1px solid #111827; width: ${s(220)}px; }
  .sign .nm { margin-top: ${s(3)}px; font-size: ${s(11)}px; color: #6b7280; }
</style></head><body>
  <div class="logos">
    <div class="uv">${UNIVISION_LOGO_SVG}</div>
  </div>
  <div class="title">ШААРДАХ ХУУДАС ${docNo ? '№' + escHtml(docNo) : ''}</div>

  <div class="head">
    <div class="col">
      <div class="kv"><span class="k">№</span><span class="v">${escHtml(docNo)}</span></div>
      <div class="kv"><span class="k">Огноо:</span><span class="v">${escHtml(date)}</span></div>
      <div class="kv"><span class="k">Зорилулт:</span><span class="v">${escHtml(purpose)}</span></div>
      <div class="kv"><span class="k">Партнер/байршил:</span><span class="v">${escHtml(partner)}</span></div>
    </div>
    <div class="col">
      <div class="kv"><span class="k">Компаний нэр:</span><span class="v">${escHtml(companyName)}</span></div>
      <div class="kv"><span class="k">Нэр:</span><span class="v">${escHtml(name)}</span></div>
      <div class="kv"><span class="k">Албан тушаал:</span><span class="v">${escHtml(position)}</span></div>
      <div class="kv"><span class="k">Компани:</span><span class="v">${escHtml(company)}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:${s(30)}px">№</th>
        <th>Нэр төрөл: Бараа материал</th>
        <th style="width:${s(70)}px">Хэрэгцээ</th>
        <th style="width:${s(90)}px">Бүртгэлийн дугаар</th>
        <th style="width:${s(80)}px">Техникийн код</th>
        <th style="width:${s(90)}px">Хуучин байршил</th>
        <th style="width:${s(44)}px">Х.Н</th>
        <th style="width:${s(80)}px">Одоогийн тоо хэмжээ</th>
        <th style="width:${s(90)}px">Шинэ байршил</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows(items)}
      <tr class="total">
        <td colspan="7" class="r">Нийт:</td>
        <td class="r">${fmt(total)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="signs">
    <div class="sign">
      <div class="role">Санхүүгийн албад: / Хүлээн авсан:</div>
      ${sigBlock(receiverSig)}
      <div class="nm">${escHtml(receiverName || '')} /гарын үсэг/</div>
    </div>
    <div class="sign">
      <div class="role">Захирал: / Хүлээлгэн өгсөн:</div>
      ${sigBlock(directorSig)}
      <div class="nm">${escHtml(directorName || '')} /гарын үсэг/</div>
    </div>
  </div>
</body></html>`;
}

export async function exportRequisitionPdf(data = {}) {
  const html = buildRequisitionHtml(data);
  const size = PAGE_POINTS[data.pageSize] ? data.pageSize : 'A5';
  const { width, height } = PAGE_POINTS[size];
  const { uri } = await Print.printToFileAsync({ html, width, height });
  const filename = `shaardah_huudas_${Date.now()}.pdf`;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return uri;
  }
  await Share.share({ url: uri, title: filename, message: 'Шаардах хуудас' });
  return uri;
}
