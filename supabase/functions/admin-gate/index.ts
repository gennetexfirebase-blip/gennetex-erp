/**
 * Админ хэсгүүдийн нэвтрэлт: утас (verify.mn) → Google → өөрийн байнгын код.
 * Бусад subdomain дээр `resume` нь magic-link token_hash буцааж (клиент
 * `verifyOtp`), Google-ийг дахин шаардахгүй.
 *
 *   start    {phone}                  → verify.mn сесс (өөрийн утаснаас 144773 руу код илгээнэ)
 *   phone    {gate}                   → VERIFIED бол Google шат (клиент 3 сек тутам)
 *   google   {gate}           + JWT   → утастай ижил хүн эсэх → байнгын кодын шат
 *   password {gate, password} + JWT   → байнгын код (анх удаа тохируулна) → 12 цагийн сесс
 *   resume   {token}           → өөр subdomain дээр: хүчинтэй сесс бол шинэ token_hash
 *   check    {token} + JWT     → сесс хүчинтэй эсэх
 *   logout   {token}
 *
 * Эрх: admin, superadmin эсвэл байршил харах эрхтэй. Байнгын код data-тай нэг (data_passwords).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/push.ts";
import { createSession, getSession, normalizePhone as vmPhone, VerifyMnError } from "../_shared/verifyMn.ts";

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
const PBKDF2_ITER = 210_000;
const MAX_TRIES = 5;

class GateError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const randomHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function pbkdf2(password: string, saltHex: string, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function phone8(input: unknown) {
  let d = String(input || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00976") && d.length === 13) d = d.slice(5);
  if (d.startsWith("976") && d.length === 11) d = d.slice(3);
  if (!/^\d{8}$/.test(d)) throw new GateError("Утасны дугаар 8 оронтой байх ёстой.");
  return d;
}

const db = createAdminClient();
const audit = (userId: string | null, action: string, detail: Record<string, unknown> = {}) =>
  db.from("data_access_log").insert({ user_id: userId, action: `admin:${action}`, detail });

async function allowed(userId: string) {
  const { data: p } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (["admin", "superadmin"].includes(String(p?.role || ""))) return true;
  const { data: g } = await db.from("location_view_grants").select("user_id").eq("user_id", userId).maybeSingle();
  return !!g;
}

async function loadGate(id: unknown, stage: string) {
  const { data } = await db.from("data_gate_attempts").select("*").eq("id", String(id || "")).eq("scope", SCOPE).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) throw new GateError("Хугацаа дууссан. Эхнээс нь дахин оролдоно уу.", 410);
  if (data.stage !== stage) throw new GateError("Алхам буруу байна. Эхнээс нь дахин оролдоно уу.", 409);
  return data as { id: string; user_id: string; phone_session: string | null };
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
    case "start": {
      const phone = phone8(body.phone);
      const { data: grants } = await db.from("location_view_grants").select("user_id");
      const ids = (grants || []).map((g) => g.user_id);
      const { data: people } = await db.from("profiles").select("id, phone")
        .or(ids.length ? `role.in.(admin,superadmin),id.in.(${ids.join(",")})` : "role.in.(admin,superadmin)");
      const me = (people || []).find((p) => {
        try {
          return phone8(p.phone) === phone;
        } catch {
          return false;
        }
      });
      await audit(me?.id || null, "start", { phone: phone.slice(0, 2) + "****" + phone.slice(-2), ok: !!me });
      if (!me) throw new GateError("Энэ дугаар админ хэсэгт нэвтрэх эрхгүй.", 403);
      // Сесс бүрт шинэ 6 оронтой код (хуучин код хүчингүй).
      const v = await createSession(vmPhone(phone));
      await db.from("data_gate_attempts").delete().eq("user_id", me.id).eq("scope", SCOPE);
      const { data: gate } = await db.from("data_gate_attempts").insert({ user_id: me.id, stage: "phone", phone_session: v.sessionId, scope: SCOPE }).select("id").single();
      return { gate: gate!.id, instruction: v.displayInstruction, smsUri: v.smsUri, code: v.text, expiresAt: v.expiresAt };
    }

    case "phone": {
      const gate = await loadGate(body.gate, "phone");
      const v = await getSession(gate.phone_session || "");
      if (v.sessionStatus === "EXPIRED") return { verified: false, expired: true };
      if (v.sessionStatus !== "VERIFIED") return { verified: false };
      await db.from("data_gate_attempts").update({ stage: "google" }).eq("id", gate.id);
      await audit(gate.user_id, "phone_ok");
      return { verified: true };
    }

    case "google": {
      const gate = await loadGate(body.gate, "google");
      const uid = await jwtUserId(req);
      if (uid !== gate.user_id) {
        await audit(uid, "google_mismatch");
        throw new GateError("Утасны дугаартай ижил хүний Google дансаар нэвтэрнэ үү.", 403);
      }
      await db.from("data_gate_attempts").update({ stage: "password" }).eq("id", gate.id);
      const { data: pw } = await db.from("data_passwords").select("user_id").eq("user_id", uid).maybeSingle();
      await audit(uid, "google_ok");
      return { ok: true, setup: !pw };
    }

    case "password": {
      const gate = await loadGate(body.gate, "password");
      const uid = await jwtUserId(req);
      if (uid !== gate.user_id) throw new GateError("Буруу хэрэглэгч.", 403);
      const password = String(body.password || "");
      const { data: pw } = await db.from("data_passwords").select("*").eq("user_id", uid).maybeSingle();
      if (!pw) {
        if (password.length < 6) throw new GateError("Код дор хаяж 6 тэмдэгт байна.");
        const salt = randomHex(16);
        await db.from("data_passwords").insert({ user_id: uid, salt, hash: await pbkdf2(password, salt, PBKDF2_ITER), iterations: PBKDF2_ITER });
        await audit(uid, "password_set");
      } else {
        if (pw.locked_until && new Date(pw.locked_until) > new Date()) throw new GateError("Олон буруу оролдлогын улмаас 30 минут түгжигдсэн.", 429);
        if (!safeEqual(await pbkdf2(password, pw.salt, pw.iterations), pw.hash)) {
          const fails = (pw.fails || 0) + 1;
          await db.from("data_passwords").update({ fails, locked_until: fails >= MAX_TRIES ? new Date(Date.now() + 30 * 60000).toISOString() : null }).eq("user_id", uid);
          await audit(uid, "password_fail", { fails });
          throw new GateError("Код буруу.");
        }
        await db.from("data_passwords").update({ fails: 0, locked_until: null }).eq("user_id", uid);
      }
      const token = randomHex(32);
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString();
      await db.from("data_sessions").insert({ user_id: uid, token_hash: await sha256(token), expires_at: expiresAt, scope: SCOPE });
      await db.from("data_gate_attempts").delete().eq("id", gate.id);
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
    return reply({ error: e instanceof Error ? e.message : String(e) }, e instanceof GateError || e instanceof VerifyMnError ? e.status : 500);
  }
});
