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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseHtmlTableRows(tableHtml) {
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

export function enrichAutoboxPayload(payload = {}) {
  const diagnosisRows = payload.diagnosisRows?.length
    ? payload.diagnosisRows
    : parseHtmlTableRows(payload.diagnosis);
  const finesRows = payload.finesRows?.length
    ? payload.finesRows
    : parseHtmlTableRows(payload.fines);
  const taxRows = payload.taxRows?.length
    ? payload.taxRows
    : parseHtmlTableRows(payload.tax);
  const diagnosisValidUntil = payload.diagnosisValidUntil || (
    diagnosisRows
      .map((row) => parseMnDateTime(row[3]))
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() || null
  );
  return { ...payload, diagnosisRows, finesRows, taxRows, diagnosisValidUntil };
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
  const tax = extractTabTable(html, 'taxTab');

  const diagnosisRows = parseHtmlTableRows(diagnosis);
  const finesRows = parseHtmlTableRows(fines);
  const taxRows = parseHtmlTableRows(tax);

  // Diagnosis: [Дугаар, Арлын дугаар, Огноо, Хүчинтэй хугацаа, ...]
  const diagnosisValidUntil = diagnosisRows
    .map((r) => parseMnDateTime(r[3]))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  const hash = hashContent([general, technical, diagnosis, fines, tax]);
  const hasData = Boolean(general || technical || diagnosis || fines || tax);

  return {
    ok: hasData,
    plateNo,
    url: url || `https://www.autobox.mn/Autobox?plateNo=${encodeURIComponent(plateNo)}`,
    hash,
    general,
    technical,
    diagnosis,
    fines,
    tax,
    diagnosisRows,
    finesRows,
    taxRows,
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
  let parsed = parseAutoboxHtml(html, plateNo, url);
  if (!parsed.ok) {
    throw new Error('Энэ дугаартай машины мэдээлэл autobox.mn дээр олдсонгүй');
  }
  try {
    const taxResponse = await fetch(
      `https://www.autobox.mn/api/services/app/Xyp/GetAutoboxTax?plateNo=${encodeURIComponent(plateNo)}`,
      { headers: { 'User-Agent': 'GennetexERP/1.0', Accept: 'application/json' } },
    );
    if (taxResponse.ok) {
      const taxJson = await taxResponse.json();
      const items = taxJson?.result?.items || [];
      const taxRows = items.map((item) => [
        item.plateNo || plateNo,
        item.year ?? '',
        item.taxAmount ?? '',
        item.trafficAmount ?? '',
        item.airPollAmount ?? '',
        item.paidDate ?? '',
        item.statusText ?? '',
        item.isPaid === true,
      ]);
      const body = taxRows.map((row) =>
        `<tr>${row.slice(0, 6).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}` +
        `<td><span class="badge ${row[7] ? 'badge-success' : 'badge-danger'}">${escapeHtml(row[6])}</span></td></tr>`
      ).join('');
      parsed = {
        ...parsed,
        taxRows,
        tax: parsed.tax?.replace(/(<tbody[^>]*>)([\s\S]*?)(<\/tbody>)/i, `$1${body}$3`) || parsed.tax,
      };
    }
  } catch (_error) {
    // Татварын endpoint түр ажиллахгүй байсан ч үндсэн машины мэдээллийг харуулна.
  }
  return enrichAutoboxPayload(parsed);
}
