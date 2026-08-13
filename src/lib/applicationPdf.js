import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Ажилд орох анкетыг PDF болгож харуулах / хуваалцах.
 *
 * Өмнө нь мобайл дээр зөвхөн `Linking.openURL(cv_url)` хийдэг байсан —
 * тэр нь зөвхөн хавсаргасан файлыг браузерт нээдэг, анкетын бүрэн агуулгыг
 * (боловсрол, ажлын туршлага, гэр бүл, гарын үсэг) харуулдаггүй байв.
 *
 * Энэ модуль нь `job_applications.form_data` доторх бүтэцлэгдсэн өгөгдлөөс
 * бүтэн хуудас угсарч, `expo-print`-ээр PDF болгоно.
 *
 * Загварыг public-web/src/lib/jobApplicationPaper.ts-тэй нийцүүлсэн —
 * вэб болон мобайлаас гарсан баримт ижил харагдана.
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DASH = '—';

function val(v) {
  const s = String(v ?? '').trim();
  return s ? esc(s) : DASH;
}

/** Хоёр баганат мэдээллийн мөр. */
function row(label, value) {
  return `<tr><th>${esc(label)}</th><td>${val(value)}</td></tr>`;
}

/** Олон мөрт хүснэгт — гэр бүл, боловсрол, ажлын туршлага зэрэгт. */
function table(headers, rows) {
  if (!rows?.length) {
    return `<table class="grid"><thead><tr>${headers
      .map((h) => `<th>${esc(h)}</th>`)
      .join('')}</tr></thead><tbody><tr><td colspan="${headers.length}" class="empty">${DASH}</td></tr></tbody></table>`;
  }
  return `<table class="grid">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${val(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody>
  </table>`;
}

function section(no, title, body) {
  return `<section><h2><span class="no">${no}</span>${esc(title)}</h2>${body}</section>`;
}

/**
 * @param {object} app  job_applications мөр
 * @returns {string} HTML
 */
export function buildApplicationHtml(app) {
  const d = app?.form_data || {};
  const g = d.general || {};
  const name = [g.lastName || app?.last_name, g.firstName || app?.name]
    .filter(Boolean)
    .join(' ')
    .trim() || app?.name || 'Нэргүй';

  const photo = app?.photo_url || g.photoUrl;
  const sig = app?.signature_svg;

  const family = (d.family?.members || []).map((m) => [
    m.name, m.relation, m.birthYear, m.workplace, m.phone,
  ]);
  const education = (d.education?.items || []).map((e) => [
    e.place, e.school, e.startYear, e.endYear, e.profession, e.degree, e.certificate,
  ]);
  const work = (d.work?.items || []).map((w) => [
    w.organization, w.activity, w.position, w.startYear, w.endYear, w.salary, w.reason,
  ]);
  const languages = (d.languages?.items || []).map((l) => [
    l.language, l.listening, l.speaking, l.reading, l.writing,
  ]);

  return `<!DOCTYPE html><html lang="mn"><head><meta charset="utf-8"/>
<style>
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #201e1f; font-size: 10.5px; line-height: 1.45; margin: 0;
  }
  .head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
  .head-main { flex: 1; text-align: center; }
  .org { font-size: 13px; font-weight: 800; letter-spacing: .4px; }
  .doc { font-size: 12px; font-weight: 700; margin-top: 3px; }
  .photo {
    width: 96px; height: 120px; object-fit: cover;
    border: 1px solid #c8c8cd; border-radius: 2px; flex-shrink: 0;
  }
  .photo-ph {
    width: 96px; height: 120px; border: 1px dashed #c8c8cd; border-radius: 2px;
    display: flex; align-items: center; justify-content: center;
    color: #9c9ca4; font-size: 9px; text-align: center; flex-shrink: 0;
  }
  section { margin-bottom: 12px; page-break-inside: avoid; }
  h2 {
    font-size: 10.5px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .3px; margin: 0 0 6px; display: flex; align-items: center; gap: 6px;
  }
  h2 .no {
    background: #0099db; color: #fff; width: 15px; height: 15px; border-radius: 3px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 800;
  }
  table { width: 100%; border-collapse: collapse; }
  .kv th, .kv td {
    border: 1px solid #d8d8dc; padding: 4px 7px; vertical-align: top; text-align: left;
  }
  .kv th { width: 34%; background: #f4f4f6; font-weight: 600; }
  .grid th, .grid td {
    border: 1px solid #d8d8dc; padding: 4px 6px; text-align: left; vertical-align: top;
  }
  .grid th { background: #f4f4f6; font-weight: 700; font-size: 9.5px; }
  .grid .empty { text-align: center; color: #9c9ca4; }
  .sign { margin-top: 18px; display: flex; justify-content: space-between; gap: 24px; }
  .sign-box { flex: 1; }
  .sign-label { font-size: 9.5px; color: #5c5c64; margin-bottom: 3px; }
  .sign-line { border-bottom: 1px solid #201e1f; height: 34px; }
  .sign img, .sign svg { max-height: 34px; }
  .foot { margin-top: 10px; font-size: 8.5px; color: #77777f; text-align: right; }
</style></head><body>
  <div class="head">
    <div style="width:96px"></div>
    <div class="head-main">
      <div class="org">ЖЕННЕТЕКС ХХК</div>
      <div class="doc">Ажилд орохыг хүсэгчийн анкет</div>
    </div>
    ${photo
      ? `<img class="photo" src="${esc(photo)}" alt="Зураг"/>`
      : `<div class="photo-ph">Зураг<br/>байхгүй</div>`}
  </div>

  ${section(1, 'Ерөнхий мэдээлэл', `<table class="kv">
    ${row('Овог', g.lastName || app?.last_name)}
    ${row('Нэр', g.firstName || app?.name)}
    ${row('Регистрийн дугаар', g.register)}
    ${row('Төрсөн огноо', g.birthDate)}
    ${row('Төрсөн газар', g.birthPlace)}
    ${row('Утас', g.phone || app?.phone)}
    ${row('И-мэйл', g.email || app?.email)}
    ${row('Оршин суугаа хаяг', g.address)}
    ${row('Хүсэж буй ажлын байр', d.position || app?.position)}
  </table>`)}

  ${section(2, 'Гэр бүлийн байдал', table(
    ['Овог нэр', 'Хамаарал', 'Төрсөн он', 'Ажил/сургууль', 'Утас'], family))}

  ${section(3, 'Боловсролын байдал', table(
    ['Байршил', 'Сургууль', 'Элссэн', 'Төгссөн', 'Мэргэжил', 'Зэрэг', 'Гэрчилгээ'], education))}

  ${section(4, 'Ажлын туршлага', table(
    ['Байгууллага', 'Үйл ажиллагаа', 'Албан тушаал', 'Орсон', 'Гарсан', 'Цалин', 'Шалтгаан'], work))}

  ${section(5, 'Гадаад хэлний мэдлэг', table(
    ['Хэл', 'Сонсох', 'Ярих', 'Унших', 'Бичих'], languages))}

  ${d.message || app?.message
    ? section(6, 'Нэмэлт тайлбар', `<div style="border:1px solid #d8d8dc;padding:7px 9px;min-height:38px">${val(d.message || app?.message)}</div>`)
    : ''}

  <div class="sign">
    <div class="sign-box">
      <div class="sign-label">Анкет бөглөсөн:</div>
      <div class="sign-line">${sig ? sig : ''}</div>
      <div class="sign-label" style="margin-top:3px">${esc(name)}</div>
    </div>
    <div class="sign-box">
      <div class="sign-label">Хүлээн авсан:</div>
      <div class="sign-line">${app?.admin_signature_svg || ''}</div>
      <div class="sign-label" style="margin-top:3px">${val(app?.admin_signed_by_name)}</div>
    </div>
  </div>

  <div class="foot">
    Бүртгэсэн: ${app?.created_at ? esc(new Date(app.created_at).toLocaleString('mn-MN')) : DASH}
  </div>
</body></html>`;
}

/**
 * Анкетыг PDF болгоод системийн хуваалцах/нээх цонхыг гаргана.
 * @returns {Promise<string>} үүссэн PDF-ийн зам
 */
export async function openApplicationPdf(app) {
  const html = buildApplicationHtml(app);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Анкет',
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

/** Шууд хэвлэх цонх нээнэ. */
export async function printApplication(app) {
  await Print.printAsync({ html: buildApplicationHtml(app) });
}
