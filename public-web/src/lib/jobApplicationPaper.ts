import type { JobApplicationFormData } from '../types/jobApplication';

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PAPER_CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    color: #111;
    font-size: 11px;
    line-height: 1.35;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .paper { max-width: 210mm; margin: 0 auto; padding: 8px; }
  .paper-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
    border-bottom: 2px solid #111;
    padding-bottom: 8px;
  }
  .paper-head-center { flex: 1; text-align: center; }
  .paper-logo { height: 52px; object-fit: contain; margin-bottom: 4px; }
  .paper-company { font-size: 14px; font-weight: 700; margin: 0; text-transform: uppercase; }
  .paper-title { font-size: 13px; font-weight: 700; margin: 4px 0 0; }
  .paper-photo {
    width: 99px;
    height: 132px;
    flex: 0 0 99px;
    background: #fff;
    border: 1.5px solid #111;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .paper-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 18%;
    background: #fff;
    display: block;
  }
  .paper-photo-empty {
    font-size: 9px;
    color: #666;
    text-align: center;
    line-height: 1.3;
    background: #fff;
  }
  h3.section {
    font-size: 11px;
    font-weight: 700;
    margin: 12px 0 4px;
    text-transform: uppercase;
    border-bottom: 1px solid #333;
    padding-bottom: 2px;
  }
  table.form {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
    table-layout: fixed;
  }
  table.form td, table.form th {
    border: 1px solid #333;
    padding: 4px 6px;
    vertical-align: top;
    word-wrap: break-word;
  }
  table.form .lbl {
    width: 28%;
    font-weight: 600;
    background: #f5f5f5;
  }
  table.data th {
    background: #eee;
    font-weight: 700;
    font-size: 10px;
    text-align: center;
  }
  .sig-box {
    margin-top: 8px;
    border: 1px solid #333;
    min-height: 70px;
    padding: 6px;
    background: #fff;
  }
  .sig-box svg, .sig-box img { max-width: 220px; max-height: 64px; }
  .meta { font-size: 10px; color: #444; margin-top: 4px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .two-col table { margin: 0; }
`;

function cell(label: string, value: string) {
  return `<tr><td class="lbl">${esc(label)}</td><td>${esc(value || '—')}</td></tr>`;
}

function paperPhoto(g: JobApplicationFormData['general'], photoAttached?: boolean) {
  if (g.photoDataUrl) {
    return `<div class="paper-photo"><img src="${g.photoDataUrl}" alt="Зураг"/></div>`;
  }
  if (photoAttached) {
    return `<div class="paper-photo paper-photo-empty">Зураг<br/>хавсаргасан</div>`;
  }
  return `<div class="paper-photo paper-photo-empty">3×4 см<br/>Цээж зураг</div>`;
}

export function buildApplicationPaperHtml(
  data: JobApplicationFormData,
  opts: { logoUrl?: string; signedAt?: string } = {},
) {
  const g = data.general;
  const logo = opts.logoUrl || '/logo.png';
  const fam = data.family.members.filter((m) => m.fullName.trim());
  const edu = data.education.filter((e) => e.schoolName.trim() || e.location.trim());
  const work = data.workExperience.filter((w) => w.companyName.trim());
  const langs = data.languages.filter((l) => l.language.trim());
  const emerg = data.emergencyContacts.filter((e) => e.name.trim());
  const signed = opts.signedAt || data.signedAt;

  return `<!DOCTYPE html><html lang="mn"><head><meta charset="utf-8"/><title>${esc(data.title)}</title>
<style>${PAPER_CSS}</style></head><body>
<div class="paper">
  <div class="paper-head">
    <div style="width:99px"></div>
    <div class="paper-head-center">
      <img class="paper-logo" src="${esc(logo)}" alt=""/>
      <p class="paper-company">${esc(data.company)}</p>
      <p class="paper-title">${esc(data.title)}</p>
    </div>
    ${paperPhoto(g, (data as JobApplicationFormData & { photoAttached?: boolean }).photoAttached)}
  </div>

  <h3 class="section">1. Ерөнхий мэдээлэл</h3>
  <table class="form">
    ${cell('Ургийн овог', g.clanName)}
    ${cell('Эцэг (эх)-ийн нэр', g.fatherName)}
    ${cell('Өөрийн нэр', g.firstName)}
    ${cell('Төрсөн огноо', [g.birthYear, g.birthMonth, g.birthDay].filter(Boolean).join('.') || '')}
    ${cell('Төрсөн газар', [g.birthProvince, g.birthDistrict].filter(Boolean).join(', '))}
    ${cell('Яс үндэс', g.ethnicity)}
    ${cell('Хүйс', g.gender)}
    ${cell('Регистрийн дугаар', g.registrationNo)}
    ${cell('И-мэйл', g.email)}
    ${cell('НД төлдөг эсэх', g.paysSocialInsurance)}
    ${cell('Утас (гар)', g.phoneMobile)}
    ${cell('Утас (гэр)', g.phoneHome)}
    ${cell('Жолооны үнэмлэх №', g.driverLicenseNo)}
    ${cell('Жолооны ангилал', g.driverLicenseClass)}
    ${cell('Цусны бүлэг', g.bloodType)}
    ${cell('Оршин суугаа хаяг', g.address)}
    ${cell('Оршин суух төрөл', g.housingType)}
    ${cell('Биеийн хэмжээ', g.bodySize)}
    ${cell('Хувцасны размер', g.clothingSize)}
    ${cell('Гутлын размер', g.shoeSize)}
  </table>

  <h3 class="section">2. Гэр бүлийн байдал</h3>
  <p class="meta">Гэрлэсэн эсэх: <b>${esc(data.family.married || '—')}</b></p>
  <table class="form data">
    <thead><tr><th>Овог нэр</th><th>Харилцаа</th><th>Төрсөн он</th><th>Ажил/сургууль</th><th>Утас</th></tr></thead>
    <tbody>${fam.map((m) => `<tr><td>${esc(m.fullName)}</td><td>${esc(m.relation)}</td><td>${esc(m.birthYear)}</td><td>${esc(m.workOrSchool)}</td><td>${esc(m.phone)}</td></tr>`).join('') || '<tr><td colspan="5">—</td></tr>'}</tbody>
  </table>

  <h3 class="section">3. Боловсролын байдал</h3>
  <table class="form data">
    <thead><tr><th>Байршил</th><th>Сургууль</th><th>Элссэн</th><th>Төгссөн</th><th>Мэргэжил</th><th>Зэрэг</th><th>Голч</th></tr></thead>
    <tbody>${edu.map((e) => `<tr><td>${esc(e.location)}</td><td>${esc(e.schoolName)}</td><td>${esc(e.enteredYear)}</td><td>${esc(e.graduatedYear)}</td><td>${esc(e.profession)}</td><td>${esc(e.degree)}</td><td>${esc(e.gpa)}</td></tr>`).join('') || '<tr><td colspan="7">—</td></tr>'}</tbody>
  </table>

  <h3 class="section">4. Ажлын туршлага</h3>
  <table class="form data">
    <thead><tr><th>Байгууллага</th><th>Гүйцэтгэсэн ажил</th><th>Албан тушаал</th><th>Орсон</th><th>Гарсан</th><th>Цалин</th><th>Шалтгаан</th></tr></thead>
    <tbody>${work.map((w) => `<tr><td>${esc(w.companyName)}</td><td>${esc(w.duties)}</td><td>${esc(w.position)}</td><td>${esc(w.startDate)}</td><td>${esc(w.endDate)}</td><td>${esc(w.salary)}</td><td>${esc(w.leaveReason)}</td></tr>`).join('') || '<tr><td colspan="7">—</td></tr>'}</tbody>
  </table>

  <h3 class="section">5. Гадаад хэлний мэдлэг</h3>
  <table class="form data">
    <thead><tr><th>Хэл</th><th>Сонсох</th><th>Ярих</th><th>Унших</th><th>Бичих</th></tr></thead>
    <tbody>${langs.map((l) => `<tr><td>${esc(l.language)}</td><td>${esc(l.listening)}</td><td>${esc(l.speaking)}</td><td>${esc(l.reading)}</td><td>${esc(l.writing)}</td></tr>`).join('') || '<tr><td colspan="5">—</td></tr>'}</tbody>
  </table>

  <h3 class="section">6. Хувийн онцлог</h3>
  <table class="form">
    ${cell('Давуу тал', data.personal.strengths)}
    ${cell('Сул тал', data.personal.weaknesses)}
  </table>

  <h3 class="section">7. Ажилд орох хүсэлт</h3>
  <table class="form">
    ${cell('Сонирхож буй албан тушаал', data.jobInterest.position)}
    ${cell('Хүсэж буй цалин', data.jobInterest.desiredSalary)}
  </table>

  <h3 class="section">8. Яаралтай холбоо барих</h3>
  <table class="form data">
    <thead><tr><th>Овог нэр</th><th>Хэн болох</th><th>Утас</th></tr></thead>
    <tbody>${emerg.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.relation)}</td><td>${esc(e.phone)}</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>'}</tbody>
  </table>

  <h3 class="section">9. Гарын үсэг</h3>
  <div class="sig-box">${data.signatureSvg || '—'}</div>
  <p class="meta">Огноо: ${esc(signed ? new Date(signed).toLocaleString('mn-MN') : '—')}</p>
</div></body></html>`;
}

/** Admin/preview дээр харагдах цагаан дэвсгэртэй 3×4 зураг */
export function portraitPhotoHtml(src: string, alt = 'Зураг') {
  return `<div class="portrait-photo"><img src="${src.replace(/"/g, '&quot;')}" alt="${alt}"/></div>`;
}

export const PAPER_PREVIEW_CSS = `
  .paper-preview-wrap{background:#e5e5e5;padding:16px;overflow:auto;max-height:75vh}
  .paper-preview{background:#fff;max-width:210mm;margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,.15);padding:12px}
  .portrait-photo{width:99px;height:132px;background:#fff;border:1.5px solid #222;padding:3px;overflow:hidden;flex-shrink:0}
  .portrait-photo img{width:100%;height:100%;object-fit:cover;object-position:center 18%;background:#fff;display:block}
`;
