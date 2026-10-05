/** Vercel serverless — autobox.mn proxy (CORS-гүй admin-д зориулсан). */

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchTaxRows(shell, plateNo) {
  if (!shell) return { html: shell, rows: [] };
  try {
    const response = await fetch(
      `https://www.autobox.mn/api/services/app/Xyp/GetAutoboxTax?plateNo=${encodeURIComponent(plateNo)}`,
      { headers: { 'User-Agent': 'GennetexERP/1.0', Accept: 'application/json' } },
    );
    if (!response.ok) return { html: shell, rows: [] };
    const json = await response.json();
    const items = json?.result?.items || [];
    const body = items.map((item) =>
      `<tr>` +
      `<td>${escapeHtml(item.plateNo || plateNo)}</td>` +
      `<td>${escapeHtml(item.year)}</td>` +
      `<td>${escapeHtml(item.taxAmount)}</td>` +
      `<td>${escapeHtml(item.trafficAmount)}</td>` +
      `<td>${escapeHtml(item.airPollAmount)}</td>` +
      `<td>${escapeHtml(item.paidDate)}</td>` +
      `<td><span class="badge ${item.isPaid ? 'badge-success' : 'badge-danger'}">${escapeHtml(item.statusText)}</span></td>` +
      `</tr>`
    ).join('');
    const html = shell.replace(/(<tbody[^>]*>)([\s\S]*?)(<\/tbody>)/i, `$1${body}$3`);
    const rows = items.map((item) => [
      item.plateNo || plateNo,
      item.year ?? '',
      item.taxAmount ?? '',
      item.trafficAmount ?? '',
      item.airPollAmount ?? '',
      item.paidDate ?? '',
      item.statusText ?? '',
      item.isPaid === true,
    ]);
    return { html, rows };
  } catch (_error) {
    return { html: shell, rows: [] };
  }
}

async function hashContent(parts) {
  const text = parts.filter(Boolean).join('|');
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const plateNo = String(req.query.plateNo || '').trim();
  if (!plateNo) {
    res.status(400).json({ error: 'plateNo шаардлагатай' });
    return;
  }

  try {
    const autoboxUrl = `https://www.autobox.mn/Autobox?plateNo=${encodeURIComponent(plateNo)}`;
    const upstream = await fetch(autoboxUrl, {
      headers: {
        'User-Agent': 'GennetexERP/1.0',
        Accept: 'text/html',
      },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Autobox хариу: ${upstream.status}`, url: autoboxUrl });
      return;
    }

    const html = await upstream.text();
    const general = extractTableAfterLabel(html, 'Ерөнхий мэдээлэл');
    const technical = extractTableAfterLabel(html, 'Техникийн мэдээлэл');
    const diagnosis = extractTabTable(html, 'diagnosisTab');
    const fines = extractTabTable(html, 'fineTab');
    const taxResult = await fetchTaxRows(extractTabTable(html, 'taxTab'), plateNo);
    const tax = taxResult.html;
    const hash = await hashContent([general, technical, diagnosis, fines, tax]);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({
      ok: true,
      plateNo,
      url: autoboxUrl,
      hash,
      general,
      technical,
      diagnosis,
      fines,
      tax,
      taxRows: taxResult.rows,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
};
