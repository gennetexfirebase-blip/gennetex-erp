import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
};

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function short(value: unknown, max = 90) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  if (!url || !anonKey || !serviceKey || !botToken) return reply({ ok: false, error: "not_configured" }, 503);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return reply({ ok: false, error: "unauthorized" }, 401);

  let requestId = "";
  try { requestId = String((await req.json()).requestId || ""); } catch { /* invalid body */ }
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(requestId)) return reply({ ok: false, error: "invalid_request" }, 400);

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: row, error: rowError } = await sb.from("device_approvals")
    .select("id,user_id,user_name,device_brand,device_model,os,os_version,public_ip,status,telegram_notified_at")
    .eq("id", requestId).eq("user_id", auth.user.id).eq("status", "pending").maybeSingle();
  if (rowError) return reply({ ok: false, error: "lookup_failed" }, 500);
  if (!row) return reply({ ok: false, error: "request_not_found" }, 404);
  if (row.telegram_notified_at) return reply({ ok: true, already_notified: true });

  const { data: admins, error: adminError } = await sb.from("profiles")
    .select("telegram_user_id").eq("role", "superadmin").not("telegram_user_id", "is", null);
  const destinations = new Set<string>();
  for (const admin of adminError ? [] : (admins || [])) {
    if (/^[1-9][0-9]*$/.test(String(admin.telegram_user_id || ""))) destinations.add(String(admin.telegram_user_id));
  }
  const configuredChat = Deno.env.get("TELEGRAM_CHAT_ID") || "";
  if (/^[1-9][0-9]*$/.test(configuredChat)) destinations.add(configuredChat);
  if (!destinations.size) return reply({ ok: false, error: "admin_telegram_not_configured" }, 503);

  // Conditional claim prevents duplicate alerts if the app retries or opens twice.
  const { data: claimed, error: claimError } = await sb.from("device_approvals")
    .update({ telegram_notified_at: new Date().toISOString() })
    .eq("id", row.id).eq("user_id", auth.user.id).eq("status", "pending")
    .is("telegram_notified_at", null).select("id").maybeSingle();
  if (claimError) return reply({ ok: false, error: "claim_failed" }, 500);
  if (!claimed) return reply({ ok: true, already_notified: true });

  const { data: profile } = await sb.from("profiles").select("name,email").eq("id", auth.user.id).maybeSingle();
  const name = short(profile?.name || row.user_name || profile?.email || auth.user.email || "Ажилтан");
  const device = short(`${row.device_brand || ""} ${row.device_model || ""}`.trim() || "Тодорхойгүй төхөөрөмж");
  const os = short(`${row.os || ""} ${row.os_version || ""}`.trim());
  const text = [
    "🔐 Gennetex ERP · Шинэ төхөөрөмжийн хүсэлт",
    `Ажилтан: ${name}`,
    `Төхөөрөмж: ${device}`,
    os ? `Систем: ${os}` : "",
    row.public_ip ? `IP: ${short(row.public_ip, 50)}` : "",
    "Зөвшөөрөх эсвэл татгалзах товчийг дарна уу.",
  ].filter(Boolean).join("\n");

  let sent = 0;
  for (const chatId of destinations) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: { inline_keyboard: [[
            { text: "✅ Зөвшөөрөх", callback_data: `device:approve:${row.id}` },
            { text: "⛔ Татгалзах", callback_data: `device:reject:${row.id}` },
          ]] },
        }),
      });
      if (res.ok && (await res.json()).ok) sent += 1;
    } catch { /* The push notification remains a fallback. */ }
  }
  if (!sent) {
    await sb.from("device_approvals").update({ telegram_notified_at: null })
      .eq("id", row.id).eq("status", "pending");
    return reply({ ok: false, error: "telegram_send_failed" }, 502);
  }
  return reply({ ok: true, sent });
});
