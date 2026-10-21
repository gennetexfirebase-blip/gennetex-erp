/**
 * Админ хэсгүүдийн нэвтрэлт: утас (verify.mn) → Google → өөрийн байнгын код.
 *
 * Subdomain бүр тусдаа нэвтрэлттэй (утас + код дахин), харин Google-ийг дахин
 * шаардахгүй: `.gennetex.com` cookie-ийн токеноор `resume` нь magic-link
 * token_hash буцааж (клиент `verifyOtp`), утасны дараа `phone` нь Google шатыг
 * алгасна (JWT нь утастай ижил хүн бол).
 *
 *   start    {phone | self:true}      → verify.mn сесс (self — Google-ээр нэвтэрсэн хүний бүртгэлтэй утас)
 *   my_phone + JWT                    → бүртгэлтэй утасны далдалсан дугаар (дугаар бичихгүйгээр код илгээх)
 *   register {phone, host} + JWT      → утасгүй админ: өөрийн дугаараа бүртгүүлэх — verify.mn баталгаажмагц профайлд хадгална
 *   phone    {gate}                   → VERIFIED бол Google шат (клиент 3 сек тутам)
 *   google   {gate}           + JWT   → утастай ижил хүн эсэх → байнгын кодын шат
 *   password {gate, password} + JWT   → байнгын код (анх удаа тохируулна) → 12 цагийн сесс
 *   reset_start {gate, host} + JWT    → кодоо мартсан: профайлын утас руу verify.mn сесс
 *   reset_phone {gate}                → VERIFIED бол хуучин кодыг устгаж, шинэ код тохируулах шат
 *   owner_code {password?, check?} + JWT → adiyasuren.gennetex.com/system/admin — эзэмшигчийн өөрийн код (SMS-гүй)
 *   owner_users + JWT                 → бүх хэрэглэгч ба эрх (role, data, байршил)
 *   owner_set {user_id, role?, data?, location?, phone?} + JWT → эрх олгох/хасах
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
  const ok = /^https:\/\/[a-z0-9-]+\.gennetex\.com$/.test(origin) || origin.endsWith(".vercel.app") || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
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

/** verify.mn сесс бүрийг бүртгэнэ (орлогын тайлан — adiyasuren.gennetex.com/system/admin/). */
/** Клиентийн илгээсэн host — зөвхөн *.gennetex.com / localhost хэлбэр. */
function hostOf(v: unknown) {
  const h = String(v || "").toLowerCase().slice(0, 64);
  return /^[a-z0-9.-]+$/.test(h) ? h : "";
}

const OWNER_EMAIL = "adiyasuren1003@gmail.com";

/** Эзэмшигч (adiyasuren1003@gmail.com) мөн эсэх — бусдад 404. */
async function ownerUid(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user || String(u.user.email || "").toLowerCase() !== OWNER_EMAIL) throw new GateError("Хандах эрхгүй.", 404);
  return u.user.id;
}

/** Байнгын код шалгах (байхгүй бол шинээр тохируулна) — 5 буруу оролдлогод 30 мин түгжинэ. */
async function checkOrSetPassword(uid: string, password: string) {
  const { data: pw } = await db.from("data_passwords").select("*").eq("user_id", uid).maybeSingle();
  if (!pw) {
    if (password.length < 6) throw new GateError("Код дор хаяж 6 тэмдэгт байна.");
    const salt = randomHex(16);
    await db.from("data_passwords").insert({ user_id: uid, salt, hash: await pbkdf2(password, salt, PBKDF2_ITER), iterations: PBKDF2_ITER });
    await audit(uid, "password_set");
    return;
  }
  if (pw.locked_until && new Date(pw.locked_until) > new Date()) throw new GateError("Олон буруу оролдлогын улмаас 30 минут түгжигдсэн.", 429);
  if (!safeEqual(await pbkdf2(password, pw.salt, pw.iterations), pw.hash)) {
    const fails = (pw.fails || 0) + 1;
    await db.from("data_passwords").update({ fails, locked_until: fails >= MAX_TRIES ? new Date(Date.now() + 30 * 60000).toISOString() : null }).eq("user_id", uid);
    await audit(uid, "password_fail", { fails });
    throw new GateError("Код буруу.");
  }
  await db.from("data_passwords").update({ fails: 0, locked_until: null }).eq("user_id", uid);
}

async function logVerify(v: { sessionId: string; phone: string; displayInstruction: string; smsUri?: string; expiresAt: string }, userId: string, subject: string) {
  await db.from("phone_verification_sessions").insert({
    provider_session_id: v.sessionId, created_by: userId, phone: v.phone, display_instruction: v.displayInstruction,
    sms_uri: v.smsUri || null, subject_type: subject, subject_id: userId, expires_at: v.expiresAt,
  });
}
async function markVerify(sessionId: string, status: "VERIFIED" | "EXPIRED") {
  await db.from("phone_verification_sessions").update({ session_status: status, verified_at: status === "VERIFIED" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("provider_session_id", sessionId).neq("session_status", "VERIFIED");
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

/** Google-ээр нэвтэрсэн бол хэрэглэгчийн id, үгүй бол null (алдаа шидэхгүй). */
async function jwtUserIdOrNull(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await db.auth.getUser(token).catch(() => ({ data: null }));
  return data?.user?.id || null;
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
    case "my_phone": {
      const uid = await jwtUserId(req);
      const { data: prof } = await db.from("profiles").select("phone").eq("id", uid).maybeSingle();
      try {
        const p = phone8(prof?.phone);
        return { phone: `${p.slice(0, 2)}••••${p.slice(-2)}` };
      } catch {
        return { phone: null };
      }
    }

    case "register": {
      // Админ эхлээд Google-ээр нэвтэрч, өөрийн дугаараа бүртгүүлнэ — баталгаажсаны дараа л профайлд бичнэ.
      const uid = await jwtUserId(req);
      if (!(await allowed(uid))) throw new GateError("Энэ Google данс админ хэсэгт нэвтрэх эрхгүй.", 403);
      const { data: prof } = await db.from("profiles").select("phone").eq("id", uid).maybeSingle();
      let current = "";
      try {
        current = phone8(prof?.phone);
      } catch {
        /* утасгүй эсвэл буруу — бүртгүүлж болно */
      }
      const phone = phone8(body.phone);
      if (current && current !== phone) throw new GateError("Танд дугаар бүртгэлтэй байна. Солих бол системийн админд (adiyasuren) хандана уу.", 409);
      const { data: others } = await db.from("profiles").select("id, phone").neq("id", uid).not("phone", "is", null);
      if ((others || []).some((o) => {
        try {
          return phone8(o.phone) === phone;
        } catch {
          return false;
        }
      })) throw new GateError("Энэ дугаар өөр хэрэглэгчид бүртгэлтэй байна.", 409);
      const v = await createSession(vmPhone(phone));
      const host = hostOf(body.host);
      // subject_type «admin_register» — phone шат VERIFIED болоход дугаарыг профайлд бичнэ.
      await logVerify(v, uid, host ? `admin_register:${host}` : "admin_register");
      await db.from("data_gate_attempts").delete().eq("user_id", uid).eq("scope", SCOPE);
      const { data: gate } = await db.from("data_gate_attempts").insert({ user_id: uid, stage: "phone", phone_session: v.sessionId, scope: SCOPE }).select("id").single();
      await audit(uid, "register_start", { phone: phone.slice(0, 2) + "****" + phone.slice(-2) });
      return { gate: gate!.id, instruction: v.displayInstruction, smsUri: v.smsUri, code: v.text, expiresAt: v.expiresAt };
    }

    case "start": {
      let phone: string;
      if (body.self) {
        // Дугаар бичихгүйгээр — Google-ээр нэвтэрсэн хүний бүртгэлтэй утас руу.
        const uid = await jwtUserId(req);
        const { data: prof } = await db.from("profiles").select("phone").eq("id", uid).maybeSingle();
        try {
          phone = phone8(prof?.phone);
        } catch {
          throw new GateError("Таны бүртгэлд утасны дугаар алга. Дугаараа гараар оруулна уу.");
        }
      } else phone = phone8(body.phone);
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
      if (!me) throw new GateError("Энэ дугаар системд бүртгэлгүй байна. Google-ээр нэвтэрч, өөрийн дугаараа бүртгүүлнэ үү.", 403);
      // Google-ээр аль хэдийн нэвтэрсэн бол дугаар нь тэр хүнийх байх ёстой.
      const signed = await jwtUserIdOrNull(req);
      if (signed && signed !== me.id) {
        await audit(signed, "phone_mismatch");
        throw new GateError("Энэ дугаар таны нэвтэрсэн Google данстай таарахгүй байна.", 403);
      }
      // Сесс бүрт шинэ 6 оронтой код (хуучин код хүчингүй).
      const v = await createSession(vmPhone(phone));
      const host = hostOf(body.host);
      await logVerify(v, me.id, host ? `admin_gate:${host}` : "admin_gate").catch(() => null);
      await db.from("data_gate_attempts").delete().eq("user_id", me.id).eq("scope", SCOPE);
      const { data: gate } = await db.from("data_gate_attempts").insert({ user_id: me.id, stage: "phone", phone_session: v.sessionId, scope: SCOPE }).select("id").single();
      return { gate: gate!.id, instruction: v.displayInstruction, smsUri: v.smsUri, code: v.text, expiresAt: v.expiresAt };
    }

    case "phone": {
      const gate = await loadGate(body.gate, "phone");
      const v = await getSession(gate.phone_session || "");
      if (v.sessionStatus === "EXPIRED") {
        await markVerify(gate.phone_session || "", "EXPIRED").catch(() => null);
        return { verified: false, expired: true };
      }
      if (v.sessionStatus !== "VERIFIED") return { verified: false };
      await markVerify(gate.phone_session || "", "VERIFIED").catch(() => null);
      await audit(gate.user_id, "phone_ok");
      // Дугаар бүртгүүлэх урсгал — баталгаажсан дугаарыг профайлд хадгална.
      const { data: pvs } = await db.from("phone_verification_sessions").select("phone, subject_type").eq("provider_session_id", gate.phone_session || "").maybeSingle();
      if (String(pvs?.subject_type || "").startsWith("admin_register")) {
        // Бүртгэл л — нэвтрэлт биш. Дараа нь ердийнхөөрөө (утас → Google → код) нэвтэрнэ.
        const reg = phone8(pvs?.phone);
        await db.from("profiles").update({ phone: reg }).eq("id", gate.user_id);
        await db.from("data_gate_attempts").delete().eq("id", gate.id);
        await audit(gate.user_id, "phone_registered", { phone: reg.slice(0, 2) + "****" + reg.slice(-2) });
        return { verified: true, registered: true, phone: `${reg.slice(0, 2)}••••${reg.slice(-2)}` };
      }
      // Өөр subdomain-д Google-ээр аль хэдийн нэвтэрсэн (ижил хүн) бол Google шатыг алгасна.
      if ((await jwtUserIdOrNull(req)) === gate.user_id) {
        await db.from("data_gate_attempts").update({ stage: "password" }).eq("id", gate.id);
        const { data: pw } = await db.from("data_passwords").select("user_id").eq("user_id", gate.user_id).maybeSingle();
        return { verified: true, google: false, setup: !pw };
      }
      await db.from("data_gate_attempts").update({ stage: "google" }).eq("id", gate.id);
      return { verified: true, google: true };
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
      await checkOrSetPassword(uid, String(body.password || ""));
      const token = randomHex(32);
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString();
      await db.from("data_sessions").insert({ user_id: uid, token_hash: await sha256(token), expires_at: expiresAt, scope: SCOPE });
      await db.from("data_gate_attempts").delete().eq("id", gate.id);
      await audit(uid, "login");
      return { token, expiresAt };
    }

    case "reset_start": {
      // Кодоо мартсан — утас (+ Google) энэ оролдлогод баталгаажсан ч дахин SMS-ээр нотолно.
      const gate = await loadGate(body.gate, "password");
      const uid = await jwtUserId(req);
      if (uid !== gate.user_id) throw new GateError("Буруу хэрэглэгч.", 403);
      const { data: prof } = await db.from("profiles").select("phone").eq("id", uid).maybeSingle();
      let phone: string;
      try {
        phone = phone8(prof?.phone);
      } catch {
        throw new GateError("Таны бүртгэлд утасны дугаар алга. Sysadmin-д хандана уу.");
      }
      const v = await createSession(vmPhone(phone));
      const host = hostOf(body.host);
      await logVerify(v, uid, host ? `admin_reset:${host}` : "admin_reset").catch(() => null);
      await db.from("data_gate_attempts").update({ stage: "reset", phone_session: v.sessionId }).eq("id", gate.id);
      await audit(uid, "reset_start");
      return { instruction: v.displayInstruction, smsUri: v.smsUri, code: v.text, expiresAt: v.expiresAt };
    }

    case "reset_phone": {
      const gate = await loadGate(body.gate, "reset");
      const v = await getSession(gate.phone_session || "");
      if (v.sessionStatus === "EXPIRED") {
        await markVerify(gate.phone_session || "", "EXPIRED").catch(() => null);
        return { verified: false, expired: true };
      }
      if (v.sessionStatus !== "VERIFIED") return { verified: false };
      await markVerify(gate.phone_session || "", "VERIFIED").catch(() => null);
      // Хуучин кодыг устгана — дараагийн «password» шат шинэ кодыг тохируулна.
      await db.from("data_passwords").delete().eq("user_id", gate.user_id);
      await db.from("data_gate_attempts").update({ stage: "password" }).eq("id", gate.id);
      await audit(gate.user_id, "password_reset");
      return { verified: true, setup: true };
    }

    case "owner_users": {
      await ownerUid(req);
      const [{ data: people }, { data: viewers }, { data: grants }, { data: depts }] = await Promise.all([
        db.from("profiles").select("id, name, last_name, email, phone, role, department_id, avatar_url, permissions").order("name"),
        db.from("data_viewers").select("user_id"),
        db.from("location_view_grants").select("user_id"),
        db.from("departments").select("id, name"),
      ]);
      const v = new Set((viewers || []).map((x) => x.user_id));
      const g = new Set((grants || []).map((x) => x.user_id));
      const dn = new Map((depts || []).map((d) => [d.id, d.name]));
      return {
        users: (people || []).map((p) => ({
          id: p.id, name: `${p.last_name || ""} ${p.name || ""}`.trim() || p.email || "Хэрэглэгч", email: p.email, phone: p.phone,
          role: p.role || "employee", department: dn.get(p.department_id) || null, avatar_url: p.avatar_url, data: v.has(p.id), location: g.has(p.id),
          permissions: p.permissions || {},
        })),
      };
    }

    case "owner_set": {
      const owner = await ownerUid(req);
      const target = String(body.user_id || "");
      if (!/^[0-9a-f-]{36}$/.test(target)) throw new GateError("Хэрэглэгч буруу.");
      const changes: Record<string, unknown> = {};
      if (body.role !== undefined) {
        const role = String(body.role);
        if (!["employee", "ahlah", "menejer", "admin", "superadmin"].includes(role)) throw new GateError("Эрх буруу.");
        const { error } = await db.from("profiles").update({ role }).eq("id", target);
        if (error) throw new GateError(error.message, 500);
        if (!["admin", "superadmin"].includes(role)) await db.from("data_sessions").delete().eq("user_id", target).eq("scope", SCOPE);
        changes.role = role;
      }
      if (body.phone !== undefined) {
        const phone = String(body.phone || "").trim() ? phone8(body.phone) : null;
        const { error } = await db.from("profiles").update({ phone }).eq("id", target);
        if (error) throw new GateError(error.message, 500);
        changes.phone = phone ? `${phone.slice(0, 2)}****${phone.slice(-2)}` : null;
      }
      if (body.data !== undefined) {
        if (body.data) await db.from("data_viewers").upsert({ user_id: target, granted_by: owner });
        else {
          await db.from("data_viewers").delete().eq("user_id", target);
          await db.from("data_sessions").delete().eq("user_id", target).eq("scope", "data");
        }
        changes.data = !!body.data;
      }
      if (body.location !== undefined) {
        if (body.location) await db.from("location_view_grants").upsert({ user_id: target, granted_by: owner });
        else await db.from("location_view_grants").delete().eq("user_id", target);
        changes.location = !!body.location;
      }
      // Модулийн эрх: { key: true | false | null } — null бол түвшний анхдагч руу буцна.
      if (body.permissions !== undefined && body.permissions && typeof body.permissions === "object") {
        const KEYS = ["employees", "departments", "inventory", "approve", "payroll", "acts.create"];
        const { data: cur } = await db.from("profiles").select("permissions").eq("id", target).maybeSingle();
        const next: Record<string, boolean> = { ...((cur?.permissions as Record<string, boolean>) || {}) };
        for (const [k, val] of Object.entries(body.permissions as Record<string, unknown>)) {
          if (!KEYS.includes(k)) throw new GateError("Эрхийн түлхүүр буруу.");
          if (val === null) delete next[k];
          else next[k] = !!val;
        }
        const { error } = await db.from("profiles").update({ permissions: next }).eq("id", target);
        if (error) throw new GateError(error.message);
        changes.permissions = body.permissions;
      }
      await audit(owner, "owner_set", { target, ...changes });
      return { ok: true };
    }

    case "owner_code": {
      // adiyasuren.gennetex.com/system/admin — Google (эзэмшигчийн имэйл) + өөрийн код, SMS-гүй.
      const uid = await ownerUid(req);
      if (body.check) {
        const { data: pw } = await db.from("data_passwords").select("user_id").eq("user_id", uid).maybeSingle();
        return { setup: !pw };
      }
      await checkOrSetPassword(uid, String(body.password || ""));
      await audit(uid, "owner_login");
      return { ok: true };
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
