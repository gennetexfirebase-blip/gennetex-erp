/** autobox.mn HTML-ээс хүснэгт задлах (апп + proxy хуваалцсан). */

function sanitizeTableHtml(table) {
  return table
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '');
}

function extractTableAfterLabel(html, label) {
  const idx = html.indexOf(label);
  if (idx < 0) return null;
  const tableStart = html.indexOf('<table', idx);
  if (tableStart < 0 || tableStart - idx > 600) return null;
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableEnd < 0) return null;
  return sanitizeTableHtml(html.slice(tableStart, tableEnd + 8));
}

function extractTabTable(html, tabId) {
  const idx = html.indexOf(`id="${tabId}"`);
  if (idx < 0) return null;
  const tableStart = html.indexOf('<table', idx);
  if (tableStart < 0 || tableStart - idx > 1200) return null;
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableEnd < 0) return null;
  return sanitizeTableHtml(html.slice(tableStart, tableEnd + 8));
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHtmlTableRows(tableHtml) {
  if (!tableHtml) return [];
  const tbody = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(tableHtml)?.[1] || tableHtml;
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(tbody))) {
    const cells = [];
    const cellRe = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
    let cell;
    while ((cell = cellRe.exec(tr[1]))) {
      cells.push(stripTags(cell[2]));
    }
    if (cells.length) rows.push(cells);
  }
  // header мөрүүдийг хаях (ихэвчлэн эхний мөр th байдаг)
  return rows.filter((r) => !(r.length >= 2 && /огноо/i.test(r.join(' ')) && /дугаар/i.test(r.join(' '))));
}

function parseMnDateTime(s) {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?\s*$/.exec(String(s || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const hh = Number(m[4] || 0);
  const mm = Number(m[5] || 0);
  const ss = Number(m[6] || 0);
  const dt = new Date(y, mo, d, hh, mm, ss);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function hashContent(parts) {
  const text = parts.filter(Boolean).join('|');
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h) ^ text.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export function parseAutoboxHtml(html, plateNo, url) {
  const general = extractTableAfterLabel(html, 'Ерөнхий мэдээлэл');
  const technical = extractTableAfterLabel(html, 'Техникийн мэдээлэл');
  const diagnosis = extractTabTable(html, 'diagnosisTab');
  const fines = extractTabTable(html, 'fineTab');

  const diagnosisRows = parseHtmlTableRows(diagnosis);
  const finesRows = parseHtmlTableRows(fines);

  // Diagnosis: [Дугаар, Арлын дугаар, Огноо, Хүчинтэй хугацаа, ...]
  const diagnosisValidUntil = diagnosisRows
    .map((r) => parseMnDateTime(r[3]))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  const hash = hashContent([general, technical, diagnosis, fines]);
  const hasData = Boolean(general || technical || diagnosis || fines);

  return {
    ok: hasData,
    plateNo,
    url: url || `https://www.autobox.mn/Autobox?plateNo=${encodeURIComponent(plateNo)}`,
    hash,
    general,
    technical,
    diagnosis,
    fines,
    diagnosisRows,
    finesRows,
    diagnosisValidUntil: diagnosisValidUntil ? diagnosisValidUntil.toISOString() : null,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchAutoboxHtml(plateNo) {
  const url = `https://www.autobox.mn/Autobox?plateNo=${encodeURIComponent(plateNo)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GennetexERP/1.0',
      Accept: 'text/html',
    },
  });
  if (!res.ok) {
    throw new Error(`Autobox хариу: ${res.status}`);
  }
  const html = await res.text();
  const parsed = parseAutoboxHtml(html, plateNo, url);
  if (!parsed.ok) {
    throw new Error('Энэ дугаартай машины мэдээлэл autobox.mn дээр олдсонгүй');
  }
  return parsed;
}
