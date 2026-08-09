import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-alert-secret",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeText(v: unknown, max = 3500) {
  const s = String(v ?? "").replace(/\u0000/g, "");
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  const ALERT_SECRET = Deno.env.get("ALERT_SECRET") || "";
  const headerSecret = req.headers.get("x-alert-secret") || "";
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const bodySecret = typeof body.alertSecret === "string" ? body.alertSecret : "";
  if (ALERT_SECRET && headerSecret !== ALERT_SECRET && bodySecret !== ALERT_SECRET) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";
  if (!BOT_TOKEN || !CHAT_ID) return jsonResponse({ ok: false, error: "telegram_not_configured" }, 503);

  const title = safeText(body.title || "System error", 120);
  const message = safeText(body.message || body.error || "Unknown error");
  const context = safeText(body.context || "", 1500);

  const text = [
    `🚨 <b>${escapeHtml(title)}</b>`,
    "",
    `<pre>${escapeHtml(safeText(message, 3200))}</pre>`,
    context ? `\n<b>Context</b>\n<pre>${escapeHtml(safeText(context, 1500))}</pre>` : "",
    body.appVersion ? `\n<b>App</b>: ${escapeHtml(safeText(body.appVersion, 80))}` : "",
    body.user ? `\n<b>User</b>: ${escapeHtml(safeText(body.user, 120))}` : "",
    body.platform ? `\n<b>Platform</b>: ${escapeHtml(safeText(body.platform, 40))}` : "",
    body.when ? `\n<b>When</b>: ${escapeHtml(safeText(body.when, 60))}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const tgPayload = {
    chat_id: CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  let tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tgPayload),
  });

  if (!tgRes.ok) {
    const plain = [
      `🚨 ${title}`,
      "",
      message,
      context ? `\nContext:\n${context}` : "",
      body.appVersion ? `\nApp: ${safeText(body.appVersion, 80)}` : "",
      body.platform ? `\nPlatform: ${safeText(body.platform, 40)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: safeText(plain, 4000),
        disable_web_page_preview: true,
      }),
    });
  }

  if (!tgRes.ok) {
    const err = await tgRes.text().catch(() => "");
    return jsonResponse({ ok: false, error: "telegram_send_failed", detail: safeText(err, 300) }, 502);
  }

  return jsonResponse({ ok: true });
});
