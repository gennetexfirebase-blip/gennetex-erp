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
    const fines = extractTabTable(html, "fineTab");
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
