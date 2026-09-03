import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Ажилд орох анкетыг PDF болгож харуулах / хуваалцах.
 *
 * Өмнө нь мобайл дээр зөвхөн `Linking.openURL(cv_url)` хийдэг байсан —
 * тэр нь зөвхөн хавсаргасан файлыг браузерт нээдэг, анкетын бүрэн агуулгыг
 * (боловсрол, ажлын туршлага, гэр бүл, гарын үсэг) харуулдаггүй байв.
 *
 * Өгөгдлийн бүтэц нь public-web/src/types/jobApplication.ts-ийн
 * `JobApplicationFormData`. `form_data` багана байхгүй серверт вэб тал нь
 * анкетыг `message` дотор `[[GENNETEX_FORM]]` тэмдэгийн ард JSON болгож
 * хадгалдаг тул мобайл тал ч мөн тэндээс уншина — эс бөгөөс анкет хоосон
 * харагдаж, харин жагсаалтад JSON нь «код» болж дэлгэрч байв.
 */

/** Бүрэн анкетыг message дотор шахах үед ашигладаг тэмдэг. */
export const FORM_MARKER = '[[GENNETEX_FORM]]';

/** `form_data` эсвэл `message` доторх JSON-оос анкетыг гаргаж авна. */
export function parseStoredForm(app) {
  let fd = app?.form_data;
  if (typeof fd === 'string') {
    try {
      fd = JSON.parse(fd);
    } catch {
      fd = null;
    }
  }
  if (fd && typeof fd === 'object' && fd.general) return fd;

  const msg = String(app?.message || '');
  const idx = msg.indexOf(FORM_MARKER);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(msg.slice(idx + FORM_MARKER.length));
    if (parsed?.general) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

/** Жагсаалтад харуулах цэвэр тайлбар — дотор нь шахсан JSON-г хасна. */
export function plainMessage(app) {
  const msg = String(app?.message || '');
  const idx = msg.indexOf(FORM_MARKER);
  return (idx < 0 ? msg : msg.slice(0, idx)).trim();
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Гарын үсгийн SVG-г хэвлэхээс өмнө цэвэрлэнэ. */
function safeSignatureSvg(value) {
  const svg = String(value || '').trim();
  if (!/^<svg(?:\s|>)/i.test(svg)) return '';
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '');
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
  const d = parseStoredForm(app) || {};
  const g = d.general || {};
  const name =
    [g.clanName, g.fatherName, g.firstName].filter(Boolean).join(' ').trim() ||
    [app?.last_name, app?.name].filter(Boolean).join(' ').trim() ||
    'Нэргүй';

  const photo = g.photoDataUrl || app?.photo_url || '';
  const sig = safeSignatureSvg(app?.signature_svg || d.signatureSvg);
  const adminSig = safeSignatureSvg(app?.admin_signature_svg);

  const birthDate = [g.birthYear, g.birthMonth, g.birthDay].filter(Boolean).join('.');
  const birthPlace = [g.birthProvince, g.birthDistrict, g.birthSubdistrict].filter(Boolean).join(', ');
  const driverLicense = [g.driverLicenseNo, g.driverLicenseClass && `Ангилал: ${g.driverLicenseClass}`]
    .filter(Boolean)
    .join(' · ');

  const family = (d.family?.members || [])
    .filter((m) => String(m?.fullName || '').trim())
    .map((m) => [m.fullName, m.relation, m.birthYear, m.workOrSchool, m.phone]);
  const education = (d.education || [])
    .filter((e) => String(e?.schoolName || '').trim() || String(e?.location || '').trim())
    .map((e) => [e.location, e.schoolName, e.enteredYear, e.graduatedYear, e.profession, e.degree, e.gpa]);
  const work = (d.workExperience || [])
    .filter((w) => String(w?.companyName || '').trim())
    .map((w) => [w.companyName, w.duties, w.position, w.startDate, w.endDate, w.salary, w.leaveReason]);
  const languages = (d.languages || [])
    .filter((l) => String(l?.language || '').trim())
    .map((l) => [l.language, l.listening, l.speaking, l.reading, l.writing]);
  const emergency = (d.emergencyContacts || [])
    .filter((e) => String(e?.name || '').trim())
    .map((e) => [e.name, e.relation, e.phone]);

  const note = plainMessage(app);

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
  .sign-line { border-bottom: 1px solid #201e1f; min-height: 34px; }
  .sign img, .sign svg { max-height: 34px; }
  .foot { margin-top: 10px; font-size: 8.5px; color: #77777f; text-align: right; }
</style></head><body>
  <div class="head">
    <div style="width:96px"></div>
    <div class="head-main">
      <div class="org">${esc(d.company || 'ЖЕННЕТЕКС ХХК')}</div>
      <div class="doc">${esc(d.title || 'Ажилд орохыг хүсэгчийн анкет')}</div>
    </div>
    ${photo
      ? `<img class="photo" src="${esc(photo)}" alt="Зураг"/>`
      : `<div class="photo-ph">${g.photoAttached ? 'Зураг<br/>хавсаргасан' : '3×4 см<br/>Цээж зураг'}</div>`}
  </div>

  ${section(1, 'Ерөнхий мэдээлэл', `<table class="kv">
    ${row('Ургийн овог', g.clanName || app?.last_name)}
    ${row('Эцэг (эх)-ийн нэр', g.fatherName)}
    ${row('Өөрийн нэр', g.firstName || app?.name)}
    ${row('Регистрийн дугаар', g.registrationNo)}
    ${row('Төрсөн огноо', birthDate)}
    ${row('Төрсөн газар', birthPlace)}
    ${row('Хүйс', g.gender)}
    ${row('Яс үндэс', g.ethnicity)}
    ${row('Цусны бүлэг', g.bloodType)}
    ${row('Нийгмийн даатгал төлдөг эсэх', g.paysSocialInsurance)}
    ${row('Гар утас', g.phoneMobile || app?.phone)}
    ${row('Гэрийн утас', g.phoneHome)}
    ${row('И-мэйл', g.email || app?.email)}
    ${row('Оршин суух төрөл', g.housingType)}
    ${row('Жолооны үнэмлэх', driverLicense || 'Байхгүй')}
    ${row('Хувцас / гутлын размер', [g.clothingSize, g.shoeSize].filter(Boolean).join(' · '))}
    ${row('Оршин суугаа хаяг', g.address)}
  </table>`)}

  ${section(2, `Гэр бүлийн байдал (гэрлэсэн: ${String(d.family?.married || DASH)})`, table(
    ['Овог нэр', 'Хамаарал', 'Төрсөн он', 'Ажил/сургууль', 'Утас'], family))}

  ${section(3, 'Боловсролын байдал', table(
    ['Байршил', 'Сургууль', 'Элссэн', 'Төгссөн', 'Мэргэжил', 'Зэрэг', 'Голч'], education))}

  ${section(4, 'Ажлын туршлага', table(
    ['Байгууллага', 'Гүйцэтгэсэн ажил', 'Албан тушаал', 'Орсон', 'Гарсан', 'Цалин', 'Шалтгаан'], work))}

  ${section(5, 'Гадаад хэлний мэдлэг', table(
    ['Хэл', 'Сонсох', 'Ярих', 'Унших', 'Бичих'], languages))}

  ${section(6, 'Хувийн онцлог', `<table class="kv">
    ${row('Давуу тал', d.personal?.strengths)}
    ${row('Сайжруулах тал', d.personal?.weaknesses)}
  </table>`)}

  ${section(7, 'Ажилд орох хүсэлт', `<table class="kv">
    ${row('Сонирхож буй албан тушаал', d.jobInterest?.position || app?.position)}
    ${row('Хүсэж буй цалин', d.jobInterest?.desiredSalary)}
  </table>`)}

  ${section(8, 'Яаралтай холбоо барих', table(
    ['Овог нэр', 'Хэн болох', 'Утас'], emergency))}

  ${note
    ? section(9, 'Нэмэлт тайлбар', `<div style="border:1px solid #d8d8dc;padding:7px 9px;min-height:38px">${val(note)}</div>`)
    : ''}

  <div class="sign">
    <div class="sign-box">
      <div class="sign-label">Анкет бөглөсөн:</div>
      <div class="sign-line">${sig}</div>
      <div class="sign-label" style="margin-top:3px">${esc(name)}</div>
    </div>
    <div class="sign-box">
      <div class="sign-label">Хүлээн авсан:</div>
      <div class="sign-line">${adminSig}</div>
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
