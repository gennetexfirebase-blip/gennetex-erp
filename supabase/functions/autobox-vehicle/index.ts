import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeTableHtml(table: string): string {
  return table
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+="[^"]*"/gi, "")
    .replace(/\s+on\w+='[^']*'/gi, "");
}

function extractTableAfterLabel(html: string, label: string): string | null {
  const idx = html.indexOf(label);
  if (idx < 0) return null;
  const tableStart = html.indexOf("<table", idx);
  if (tableStart < 0 || tableStart - idx > 600) return null;
  const tableEnd = html.indexOf("</table>", tableStart);
  if (tableEnd < 0) return null;
  return sanitizeTableHtml(html.slice(tableStart, tableEnd + 8));
}

/** HTML-д тааруулж тэмдэгт мөрийг аюулгүй болгоно. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Penalty = {
  location?: string;
  reason?: string;
  amount?: string;
  date?: string;
  statusText?: string;
  isPaid?: boolean;
};

/**
 * Торгуулийн хоосон `<tbody>`-г жинхэнэ мөрүүдээр дүүргэнэ.
 *
 * Autobox нь торгуулийг тусдаа JSON хаягаас өгдөг (хуудасны JS түүнийг
 * дуудаж нөхдөг). Бид ижил хаяг руу хандаж, мөрүүдийг нь өөрсдөө
 * бүтээнэ — ингэснээр клиент тал ямар ч өөрчлөлтгүйгээр хүснэгтийг
 * хэвээр нь харуулна.
 *
 * Алдаа гарвал хоосон хүснэгтийг нь буцаана — торгуулийн мэдээлэл
 * ирээгүйгээс болж машины бусад мэдээлэл алдагдах ёсгүй.
 */
async function fillPenaltyRows(
  shell: string | null,
  plateNo: string,
): Promise<string | null> {
  if (!shell) return shell;
  try {
    const api =
      `https://www.autobox.mn/api/services/app/Xyp/GetAutoboxPenalty?plateNo=${
        encodeURIComponent(plateNo)
      }`;
    const res = await fetch(api, {
      headers: { "User-Agent": "GennetexERP/1.0", Accept: "application/json" },
    });
    if (!res.ok) return shell;

    const json = await res.json();
    const items: Penalty[] = json?.result?.items ?? [];
    if (!items.length) return shell;

    const rows = items
      .map((p) =>
        `<tr>` +
        `<td>${esc(plateNo)}</td>` +
        `<td>${esc(p.location)}</td>` +
        `<td>${esc(p.reason)}</td>` +
        `<td>${esc(p.amount)}</td>` +
        `<td>${esc(p.date)}</td>` +
        `<td>${esc(p.statusText)}</td>` +
        `</tr>`
      )
      .join("");

    // Хоосон tbody-г мөрүүдээр солино. Хуудасны бүтэц өөрчлөгдвөл
    // тааруулалт бүтэхгүй — тэр үед хоосон хүснэгтээ буцаана.
    const filled = shell.replace(
      /(<tbody[^>]*>)([\s\S]*?)(<\/tbody>)/i,
      `$1${rows}$3`,
    );
    return filled;
  } catch (_e) {
    return shell;
  }
}

function extractTabTable(html: string, tabId: string): string | null {
  const idx = html.indexOf(`id="${tabId}"`);
  if (idx < 0) return null;
  const tableStart = html.indexOf("<table", idx);
  if (tableStart < 0 || tableStart - idx > 1200) return null;
  const tableEnd = html.indexOf("</table>", tableStart);
  if (tableEnd < 0) return null;
  return sanitizeTableHtml(html.slice(tableStart, tableEnd + 8));
}

function extractHeader(html: string): { brand: string | null; plate: string | null } {
  const brandMatch = html.match(/class="[^"]*vehicle-brand[^"]*"[^>]*>([^<]+)</i)
    || html.match(/<h[1-6][^>]*>\s*([A-Za-z][A-Za-z0-9\s-]{1,40})\s*<\/h[1-6]>/);
  const plateMatch = html.match(/class="[^"]*plate[^"]*"[^>]*>([^<]+)</i);
  return {
    brand: brandMatch?.[1]?.trim() || null,
    plate: plateMatch?.[1]?.trim() || null,
  };
}

async function hashContent(parts: (string | null)[]): Promise<string> {
  const text = parts.filter(Boolean).join("|");
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let plateNo = url.searchParams.get("plateNo")?.trim() || "";

    if (!plateNo && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      plateNo = String((body as Record<string, unknown>).plateNo || "").trim();
    }

    if (!plateNo) {
      return jsonResponse({ error: "plateNo шаардлагатай" }, 400);
    }

    const autoboxUrl =
      `https://www.autobox.mn/Autobox?plateNo=${encodeURIComponent(plateNo)}`;

    const res = await fetch(autoboxUrl, {
      headers: {
        "User-Agent": "GennetexERP/1.0",
        Accept: "text/html",
      },
    });

    if (!res.ok) {
      return jsonResponse(
        { error: `Autobox хариу: ${res.status}`, url: autoboxUrl },
        502,
      );
    }

    const html = await res.text();
    const general = extractTableAfterLabel(html, "Ерөнхий мэдээлэл");
    const technical = extractTableAfterLabel(html, "Техникийн мэдээлэл");
    const diagnosis = extractTabTable(html, "diagnosisTab");
    /**
     * Торгуулийн мөрүүд HTML дотор БАЙДАГГҮЙ.
     *
     * Autobox-ийн хуудсанд торгуулийн хүснэгт нь ХООСОН `<tbody>`-тэй
     * ирдэг бөгөөд мөрүүдийг нь хуудасны JavaScript дараа нь тусдаа
     * хаягаас татаж нөхдөг:
     *
     *   GET /api/services/app/Xyp/GetAutoboxPenalty?plateNo=...
     *
     * Тиймээс зөвхөн HTML-ийг задалбал торгуулийн хэсэг үргэлж хоосон
     * харагдана. Энд тэр хаяг руу нэмж хандаж, мөрүүдийг нь өөрсдөө
     * бөглөнө.
     */
    const finesShell = extractTabTable(html, "fineTab");
    const fines = await fillPenaltyRows(finesShell, plateNo);
    const header = extractHeader(html);
    const hash = await hashContent([general, technical, diagnosis, fines]);

    return jsonResponse({
      ok: true,
      plateNo,
      url: autoboxUrl,
      hash,
      header,
      general,
      technical,
      diagnosis,
      fines,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg }, 500);
  }
});
