import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

function randomToken(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getBotUsername(botToken: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    return (data?.result?.username || null) as string | null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "supabase_not_configured" }, 503);
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
    body = {};
  }

  const action = String(body.action || "create").toLowerCase();
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: profile } = await sb
    .from("profiles")
    .select("id, name, telegram_user_id, telegram_username, telegram_linked_at")
    .eq("id", user.id)
    .maybeSingle();

  if (action === "status") {
    return jsonResponse({
      ok: true,
      linked: !!profile?.telegram_user_id,
      telegram_user_id: profile?.telegram_user_id ?? null,
      telegram_username: profile?.telegram_username ?? null,
      telegram_linked_at: profile?.telegram_linked_at ?? null,
    });
  }

  if (action === "unlink") {
    await sb
      .from("profiles")
      .update({
        telegram_user_id: null,
        telegram_username: null,
        telegram_linked_at: null,
      })
      .eq("id", user.id);
    return jsonResponse({ ok: true, linked: false });
  }

  // create link token
  if (!BOT_TOKEN) return jsonResponse({ ok: false, error: "telegram_bot_not_configured" }, 503);

  const botUsername = await getBotUsername(BOT_TOKEN);
  if (!botUsername) return jsonResponse({ ok: false, error: "bot_username_unavailable" }, 502);

  const token = randomToken(16);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertErr } = await sb.from("telegram_link_tokens").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
  });
  if (insertErr) {
    return jsonResponse({ ok: false, error: "token_create_failed", detail: insertErr.message }, 500);
  }

  const deepLink = `https://t.me/${botUsername}?start=link_${token}`;
  return jsonResponse({
    ok: true,
    token,
    expires_at: expiresAt,
    deep_link: deepLink,
    bot_username: botUsername,
    already_linked: !!profile?.telegram_user_id,
  });
});
