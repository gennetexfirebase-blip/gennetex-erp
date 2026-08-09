import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  insertTelegramChatMessage,
  notifyTelegramChatPush,
} from "../_shared/chatBridge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeText(v: unknown, max = 4000) {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  const GROUP_ID = Deno.env.get("TELEGRAM_LOG_GROUP_ID") || "";

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "supabase_not_configured" }, 503);
  }
  if (!BOT_TOKEN || !GROUP_ID) {
    return jsonResponse({ ok: false, error: "telegram_group_not_configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const content = safeText(body.content, 4000);
  if (!content) return jsonResponse({ ok: false, error: "empty_message" }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: profile } = await sb.from("profiles").select("name, role").eq("id", user.id).maybeSingle();
  const senderName = safeText(profile?.name || user.email || "Ажилтан", 120);

  await insertTelegramChatMessage(sb, {
    sender_id: user.id,
    sender_name: senderName,
    content,
    source: "app",
  });

  const tgText = `📱 ${senderName}\n${content}`;
  const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: GROUP_ID, text: safeText(tgText, 4000) }),
  });
  const tgJson = await tgRes.json().catch(() => ({}));
  if (!tgRes.ok || !tgJson.ok) {
    return jsonResponse({ ok: false, error: "telegram_send_failed", detail: tgJson }, 502);
  }

  await notifyTelegramChatPush(sb, {
    senderName,
    content,
    excludeUserId: user.id,
  });

  return jsonResponse({ ok: true });
});
