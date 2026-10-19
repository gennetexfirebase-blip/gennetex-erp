/**
 * Админ хэсгүүдийн нэвтрэлт: зөвхөн Google. Бусад subdomain дээр `resume` нь
 * magic-link token_hash буцааж (клиент `verifyOtp`), Google-ийг дахин шаардахгүй.
 *
 *   login    + JWT        → эрхтэй бол 12 цагийн сесс
 *   resume   {token}      → өөр subdomain дээр: хүчинтэй сесс бол шинэ token_hash
 *   check    {token} + JWT → сесс хүчинтэй эсэх
 *   logout   {token}
 *
 * Эрх: admin, superadmin эсвэл байршил харах эрхтэй (location_view_grants).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/push.ts";

const cors = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const ok = /^https:\/\/[a-z0-9-]+\.gennetex\.com$/.test(origin) || origin.endsWith(".vercel.app") || origin === "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": ok ? origin : "https://admin.gennetex.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

const SCOPE = "admin";
const SESSION_HOURS = 12;

class GateError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const randomHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));

const db = createAdminClient();
const audit = (userId: string | null, action: string, detail: Record<string, unknown> = {}) =>
  db.from("data_access_log").insert({ user_id: userId, action: `admin:${action}`, detail });

async function allowed(userId: string) {
  const { data: p } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (["admin", "superadmin"].includes(String(p?.role || ""))) return true;
  const { data: g } = await db.from("location_view_grants").select("user_id").eq("user_id", userId).maybeSingle();
  return !!g;
}

/** Supabase сесс олгох magic-link token_hash (имэйл илгээхгүй). */
async function signInHash(userId: string) {
  const { data: u } = await db.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) throw new GateError("Таны бүртгэлд имэйл алга. Sysadmin-д хандана уу.", 400);
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) throw new GateError("Нэвтрэх сесс үүсгэж чадсангүй.", 500);
  return data.properties.hashed_token;
}

async function jwtUserId(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw new GateError("Google-ээр нэвтэрнэ үү.", 401);
  return data.user.id;
}

async function sessionOf(token: unknown) {
  const { data } = await db.from("data_sessions").select("user_id, expires_at").eq("token_hash", await sha256(String(token || ""))).eq("scope", SCOPE).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date() || !(await allowed(data.user_id))) return null;
  return data as { user_id: string; expires_at: string };
}

async function handle(req: Request, body: Record<string, unknown>) {
  switch (body.action) {
    case "login": {
      const uid = await jwtUserId(req);
      if (!(await allowed(uid))) {
        await audit(uid, "denied");
        throw new GateError("Энэ Google данс админ хэсэгт нэвтрэх эрхгүй.", 403);
      }
      const token = randomHex(32);
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString();
      await db.from("data_sessions").insert({ user_id: uid, token_hash: await sha256(token), expires_at: expiresAt, scope: SCOPE });
      await audit(uid, "login");
      return { token, expiresAt };
    }

    case "resume": {
      const s = await sessionOf(body.token);
      if (!s) return { ok: false };
      return { ok: true, expiresAt: s.expires_at, tokenHash: await signInHash(s.user_id) };
    }

    case "check": {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await db.auth.getUser(token);
      const s = await sessionOf(body.token);
      const ok = !!s && !!u?.user && s.user_id === u.user.id;
      return { ok, expiresAt: ok ? s!.expires_at : null };
    }

    case "logout": {
      await db.from("data_sessions").delete().eq("token_hash", await sha256(String(body.token || ""))).eq("scope", SCOPE);
      return { ok: true };
    }
  }
  throw new GateError("Үйлдэл буруу.", 400);
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...headers, "Content-Type": "application/json" } });
  try {
    return reply(await handle(req, await req.json().catch(() => ({}))));
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : String(e) }, e instanceof GateError ? e.status : 500);
  }
});
