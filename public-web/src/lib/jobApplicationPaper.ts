import type { JobApplicationFormData } from '../types/jobApplication';

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeSignatureSvg(value?: string) {
  const svg = String(value || '').trim();
  if (!/^<svg(?:\s|>)/i.test(svg)) return '';
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '');
}

const PAPER_CSS = `
  @page { size: A4; margin: 10mm; }
  :root { color-scheme: light; --ink:#172033; --muted:#64748b; --line:#dbe3ee; --soft:#f4f7fb; --brand:#2563eb; --brand-dark:#172554; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: var(--ink);
    font-size: 10.5px;
    line-height: 1.45;
    margin: 0;
    padding: 20px;
    background: #e8eef6;
  }
  .paper { position:relative; max-width:210mm; min-height:277mm; margin:0 auto; padding:26px 28px 30px; overflow:hidden; border-radius:12px; background:#fff; box-shadow:0 18px 55px rgba(15,23,42,.15); }
  .paper::before { content:''; position:absolute; inset:0 0 auto; height:6px; background:linear-gradient(90deg,var(--brand-dark),var(--brand) 58%,#60a5fa); }
  .paper-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--line);
    padding: 2px 0 16px;
  }
  .paper-head-spacer { width:92px; flex:0 0 92px; }
  .paper-head-center { flex: 1; text-align: center; }
  .paper-logo { height:44px; max-width:190px; object-fit:contain; margin-bottom:5px; }
  .paper-company { font-size:10px; font-weight:800; letter-spacing:.2em; color:var(--brand); margin:0; text-transform:uppercase; }
  .paper-title { font-size:20px; line-height:1.2; font-weight:800; letter-spacing:-.02em; color:var(--brand-dark); margin:5px 0 0; }
  .paper-photo {
    width:92px;
    height:120px;
    flex:0 0 92px;
    background: #fff;
    border:2px solid #fff;
    border-radius:10px;
    box-shadow:0 0 0 1px #cbd5e1,0 5px 15px rgba(15,23,42,.12);
    padding:2px;
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
    color: var(--muted);
    text-align: center;
    line-height: 1.3;
    background: var(--soft);
  }
  .paper-summary { display:grid; grid-template-columns:1.45fr 1fr 1fr; margin:0 0 16px; overflow:hidden; border-radius:10px; color:#fff; background:linear-gradient(110deg,var(--brand-dark),#1e3a8a 62%,#1d4ed8); break-inside:avoid; }
  .summary-item { min-height:60px; padding:11px 14px; border-left:1px solid rgba(255,255,255,.16); }
  .summary-item:first-child { border-left:0; }
  .summary-label { display:block; margin-bottom:4px; color:#bfdbfe; font-size:8px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
  .summary-value { display:block; font-size:11px; font-weight:650; overflow-wrap:anywhere; }
  .summary-name { font-size:15px; font-weight:800; line-height:1.2; }
  h3.section {
    display:flex;
    align-items:center;
    gap:8px;
    color:var(--brand-dark);
    font-size:10.5px;
    font-weight:800;
    letter-spacing:.065em;
    margin:16px 0 7px;
    text-transform: uppercase;
    border-bottom:1px solid #bfdbfe;
    padding:0 0 5px;
    break-after:avoid;
  }
  h3.section::before { content:''; width:4px; height:15px; flex:0 0 4px; border-radius:999px; background:var(--brand); }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; overflow:hidden; border:1px solid var(--line); border-radius:9px; background:#fff; break-inside:avoid; }
  .info-item { min-height:43px; padding:7px 10px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
  .info-item:nth-child(even) { border-right:0; }
  .info-item:last-child, .info-item:nth-last-child(2):nth-child(odd) { border-bottom:0; }
  .info-item.wide { grid-column:1 / -1; border-right:0; }
  .info-item.wide:not(:last-child) { border-bottom:1px solid var(--line); }
  .info-label { display:block; color:var(--muted); font-size:8px; font-weight:750; letter-spacing:.055em; text-transform:uppercase; }
  .info-value { display:block; margin-top:2px; color:var(--ink); font-size:10.5px; font-weight:600; white-space:pre-wrap; overflow-wrap:anywhere; }
  table.form {
    width: 100%;
    border-collapse:separate;
    border-spacing:0;
    overflow:hidden;
    border:1px solid var(--line);
    border-radius:9px;
    margin-bottom:7px;
    table-layout: fixed;
  }
  table.form td, table.form th {
    border:0;
    border-right:1px solid var(--line);
    border-bottom:1px solid var(--line);
    padding:6px 8px;
    vertical-align: top;
    word-wrap: break-word;
  }
  table.form tr:last-child td { border-bottom:0; }
  table.form td:last-child, table.form th:last-child { border-right:0; }
  table.form .lbl {
    width: 28%;
    color:var(--muted);
    font-size:9px;
    font-weight:700;
    background:var(--soft);
  }
  table.data th {
    color:#334155;
    background:#eaf1fb;
    font-weight:800;
    font-size:8.5px;
    text-align: center;
  }
  table.data td { font-size:9px; }
  table.data tbody tr:nth-child(even) td { background:#f8fafc; }
  table.data tr { break-inside:avoid; }
  .signature-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; break-inside:avoid; }
  .signature-card { position:relative; min-height:132px; overflow:hidden; border:1px solid var(--line); border-radius:9px; padding:10px; background:linear-gradient(180deg,#fff,#f8fafc); }
  .signature-title { color:var(--brand-dark); font-weight:800; margin-bottom:4px; }
  .signature-layer { position: relative; z-index: 2; height: 72px; display: flex; align-items: center; justify-content: center; }
  .signature-layer svg, .signature-layer img { max-width: 230px; max-height: 70px; }
  .stamp-img { position: absolute; right: 8px; top: 24px; width: 82px; height: 82px; object-fit: contain; opacity: .72; z-index: 1; }
  .meta { font-size:9px; color:var(--muted); margin:4px 0 7px; }
  @media (max-width:720px) { body{padding:0}.paper{border-radius:0;padding:20px}.paper-head-spacer{display:none}.paper-summary,.info-grid{grid-template-columns:1fr}.summary-item{border-left:0;border-top:1px solid rgba(255,255,255,.16)}.summary-item:first-child{border-top:0}.info-item,.info-item:nth-child(even){border-right:0;border-bottom:1px solid var(--line)}.info-item:last-child{border-bottom:0} }
  @media print { body{padding:0;background:#fff}.paper{max-width:none;min-height:0;padding:0;border-radius:0;box-shadow:none}.paper::before{top:-10mm;left:-10mm;right:-10mm}.paper-summary{break-inside:avoid} }
`;

function cell(label: string, value: string) {
  return `<tr><td class="lbl">${esc(label)}</td><td>${esc(value || '—')}</td></tr>`;
}

function infoItem(label: string, value?: string, wide = false) {
  return `<div class="info-item${wide ? ' wide' : ''}"><span class="info-label">${esc(label)}</span><span class="info-value">${esc(value || '—')}</span></div>`;
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
  opts: { logoUrl?: string; signedAt?: string; adminSignatureSvg?: string; adminSignedAt?: string; adminName?: string; stampUrl?: string } = {},
) {
  const g = data.general;
  const logo = opts.logoUrl || '/logo.png';
  const fam = data.family.members.filter((m) => m.fullName.trim());
  const edu = data.education.filter((e) => e.schoolName.trim() || e.location.trim());
  const work = data.workExperience.filter((w) => w.companyName.trim());
  const langs = data.languages.filter((l) => l.language.trim());
  const emerg = data.emergencyContacts.filter((e) => e.name.trim());
  const signed = opts.signedAt || data.signedAt;
  const fullName = [g.clanName, g.fatherName, g.firstName].filter(Boolean).join(' ');
  const birthDate = [g.birthYear, g.birthMonth, g.birthDay].filter(Boolean).join('.');
  const birthPlace = [g.birthProvince, g.birthDistrict, g.birthSubdistrict].filter(Boolean).join(', ');
  const driverLicense = [g.driverLicenseNo, g.driverLicenseClass && `Ангилал: ${g.driverLicenseClass}`].filter(Boolean).join(' · ');

  return `<!DOCTYPE html><html lang="mn"><head><meta charset="utf-8"/><title>${esc(data.title)}</title>
<style>${PAPER_CSS}</style></head><body>
<div class="paper">
  <div class="paper-head">
    <div class="paper-head-spacer"></div>
    <div class="paper-head-center">
      <img class="paper-logo" src="${esc(logo)}" alt=""/>
      <p class="paper-company">${esc(data.company)}</p>
      <p class="paper-title">${esc(data.title)}</p>
    </div>
    ${paperPhoto(g, (g as JobApplicationFormData['general'] & { photoAttached?: boolean }).photoAttached)}
  </div>

  <div class="paper-summary">
    <div class="summary-item"><span class="summary-label">Ажил горилогч</span><span class="summary-value summary-name">${esc(fullName || 'Нэр оруулаагүй')}</span></div>
    <div class="summary-item"><span class="summary-label">Сонирхож буй албан тушаал</span><span class="summary-value">${esc(data.jobInterest.position || '—')}</span></div>
    <div class="summary-item"><span class="summary-label">Холбоо барих</span><span class="summary-value">${esc(g.phoneMobile || g.email || '—')}</span></div>
  </div>

  <h3 class="section">1. Ерөнхий мэдээлэл</h3>
  <div class="info-grid">
    ${infoItem('Ургийн овог', g.clanName)}
    ${infoItem('Эцэг (эх)-ийн нэр', g.fatherName)}
    ${infoItem('Өөрийн нэр', g.firstName)}
    ${infoItem('Регистрийн дугаар', g.registrationNo)}
    ${infoItem('Төрсөн огноо', birthDate)}
    ${infoItem('Төрсөн газар', birthPlace)}
    ${infoItem('Хүйс', g.gender)}
    ${infoItem('Яс үндэс', g.ethnicity)}
    ${infoItem('Цусны бүлэг', g.bloodType)}
    ${infoItem('Нийгмийн даатгал төлдөг эсэх', g.paysSocialInsurance)}
    ${infoItem('Гар утас', g.phoneMobile)}
    ${infoItem('Гэрийн утас', g.phoneHome)}
    ${infoItem('И-мэйл', g.email)}
    ${infoItem('Оршин суух төрөл', g.housingType)}
    ${infoItem('Жолооны үнэмлэх', driverLicense || 'Байхгүй')}
    ${infoItem('Өндөр / биеийн хэмжээ', g.bodySize)}
    ${infoItem('Хувцасны размер', g.clothingSize)}
    ${infoItem('Гутлын размер', g.shoeSize)}
    ${infoItem('Оршин суугаа хаяг', g.address, true)}
  </div>

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
  <div class="info-grid">${infoItem('Давуу тал', data.personal.strengths)}${infoItem('Сайжруулах тал', data.personal.weaknesses)}</div>

  <h3 class="section">7. Ажилд орох хүсэлт</h3>
  <div class="info-grid">${infoItem('Сонирхож буй албан тушаал', data.jobInterest.position)}${infoItem('Хүсэж буй цалин', data.jobInterest.desiredSalary)}</div>

  <h3 class="section">8. Яаралтай холбоо барих</h3>
  <table class="form data">
    <thead><tr><th>Овог нэр</th><th>Хэн болох</th><th>Утас</th></tr></thead>
    <tbody>${emerg.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.relation)}</td><td>${esc(e.phone)}</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>'}</tbody>
  </table>

  <h3 class="section">9. Гарын үсэг ба баталгаа</h3>
  <div class="signature-grid">
    <div class="signature-card">
      <div class="signature-title">Ажил горилогч</div>
      <div class="signature-layer">${safeSignatureSvg(data.signatureSvg) || '—'}</div>
      <div class="meta">${esc(`${g.fatherName || ''} ${g.firstName || ''}`.trim() || '—')} · ${esc(signed ? new Date(signed).toLocaleString('mn-MN') : '—')}</div>
    </div>
    <div class="signature-card">
      <div class="signature-title">Баталсан</div>
      ${opts.stampUrl ? `<img class="stamp-img" src="${esc(opts.stampUrl)}" alt="Компанийн тамга"/>` : ''}
      <div class="signature-layer">${safeSignatureSvg(opts.adminSignatureSvg) || 'Гарын үсэг хүлээгдэж байна'}</div>
      <div class="meta">${esc(opts.adminName || '—')} · ${esc(opts.adminSignedAt ? new Date(opts.adminSignedAt).toLocaleString('mn-MN') : '—')}</div>
    </div>
  </div>
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
