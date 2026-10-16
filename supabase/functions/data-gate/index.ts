/**
 * data.gennetex.com/data/ — 4 шаттай нэвтрэлт ба өгөгдөл унших.
 *
 *   start      {phone}                 → verify.mn сесс (ажилтан өөрийн утаснаас код илгээнэ)
 *   phone      {gate}                  → verify.mn баталгаажсан бол Gmail руу 6 оронтой код
 *   email      {gate, code}            → код зөв бол Google-ээр нэвтрэх шат
 *   google     {gate}  + Bearer JWT    → JWT-ийн хэрэглэгч 1-р шатныхтай ижил superadmin эсэх
 *   password   {gate, password} + JWT  → нууц үг (анх удаа тохируулна) → data session token
 *   tables / rows / buckets / files / sign / logout  {token} + JWT
 *
 * superadmin (бүрэн) ба data_viewers (зөвхөн харах, superadmin олгоно). Бүх хүснэгт service role-оор — клиент шууд хандахгүй.
 * Шаардлагатай secret: VERIFY_MN_API_KEY, RESEND_API_KEY (EMAIL_FROM).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/push.ts";
import { createSession, getSession, normalizePhone as vmPhone, VerifyMnError } from "../_shared/verifyMn.ts";

const ALLOWED_ORIGINS = new Set(["https://data.gennetex.com", "https://bayasgalan.gennetex.com", "http://localhost:5173"]);
const corsFor = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) || origin.endsWith(".vercel.app") ? origin : "https://data.gennetex.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

const SESSION_HOURS = 8;
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
const sixDigits = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));

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

function normalizePhone(input: unknown) {
  let d = String(input || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00976") && d.length === 13) d = d.slice(5);
  if (d.startsWith("976") && d.length === 11) d = d.slice(3);
  if (!/^\d{8}$/.test(d)) throw new GateError("Утасны дугаар 8 оронтой байх ёстой.");
  return d;
}

const db = createAdminClient();

async function audit(userId: string | null, action: string, detail: Record<string, unknown> = {}) {
  await db.from("data_access_log").insert({ user_id: userId, action, detail });
}

async function loadGate(id: unknown, stage: string) {
  const { data } = await db.from("data_gate_attempts").select("*").eq("id", String(id || "")).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) throw new GateError("Хугацаа дууссан. Эхнээс нь дахин оролдоно уу.", 410);
  if (data.stage !== stage) throw new GateError("Алхам буруу байна. Эхнээс нь дахин оролдоно уу.", 409);
  return data as { id: string; user_id: string; stage: string; phone_session: string | null; email_code_hash: string | null; tries: number };
}

async function isViewer(userId: string) {
  const { data } = await db.from("data_viewers").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

/** Bearer JWT → superadmin эсвэл харах эрхтэй хэрэглэгч. */
async function jwtUser(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw new GateError("Google-ээр нэвтэрнэ үү.", 401);
  const { data: p } = await db.from("profiles").select("id, role, email").eq("id", data.user.id).maybeSingle();
  const admin = p?.role === "superadmin";
  if (!p || (!admin && !(await isViewer(p.id)))) throw new GateError("Data-д хандах эрхгүй.", 403);
  return { ...(p as { id: string; role: string; email: string | null }), admin };
}

async function requireSuper(req: Request, body: Record<string, unknown>) {
  const user = await requireSession(req, body);
  if (!user.admin) throw new GateError("Зөвхөн superadmin.", 403);
  return user;
}

/** Data session token + JWT хоёулаа хүчинтэй байх ёстой. */
async function requireSession(req: Request, body: Record<string, unknown>) {
  const user = await jwtUser(req);
  const hash = await sha256(String(body.token || ""));
  const { data } = await db.from("data_sessions").select("user_id, expires_at").eq("token_hash", hash).maybeSingle();
  if (!data || data.user_id !== user.id || new Date(data.expires_at) < new Date()) throw new GateError("Сесс дууссан. Дахин нэвтэрнэ үү.", 401);
  return user;
}

const maskEmail = (e: string) => e.replace(/^(.)(.*)(.@.*)$/, (_m, a, b, c) => a + "*".repeat(Math.max(1, b.length)) + c);

async function handle(req: Request, body: Record<string, unknown>) {
  switch (body.action) {
    case "start": {
      const phone = normalizePhone(body.phone);
      const { data: viewers } = await db.from("data_viewers").select("user_id");
      const viewerIds = (viewers || []).map((v) => v.user_id);
      const { data: people } = await db.from("profiles").select("id, phone, role")
        .or(viewerIds.length ? `role.eq.superadmin,id.in.(${viewerIds.join(",")})` : "role.eq.superadmin");
      const me = (people || []).find((p) => {
        try {
          return normalizePhone(p.phone) === phone;
        } catch {
          return false;
        }
      });
      await audit(me?.id || null, "start", { phone: phone.slice(0, 2) + "****" + phone.slice(-2), ok: !!me });
      if (!me) throw new GateError("Энэ дугаар data-д хандах эрхгүй.", 403);
      // Сесс бүрт шинэ 6 оронтой код (хуучин код хүчингүй болно).
      const v = await createSession(vmPhone(phone));
      await db.from("data_gate_attempts").delete().eq("user_id", me.id);
      const { data: gate } = await db.from("data_gate_attempts").insert({ user_id: me.id, stage: "phone", phone_session: v.sessionId }).select("id").single();
      return { gate: gate!.id, instruction: v.displayInstruction, smsUri: v.smsUri, code: v.text, expiresAt: v.expiresAt };
    }

    case "phone": {
      const gate = await loadGate(body.gate, "phone");
      const v = await getSession(gate.phone_session || "");
      if (v.sessionStatus === "EXPIRED") return { verified: false, expired: true };
      if (v.sessionStatus !== "VERIFIED") return { verified: false };

      const { data: p } = await db.from("profiles").select("email").eq("id", gate.user_id).single();
      const email = String(p?.email || "");
      if (!email) throw new GateError("Таны профайлд Gmail хаяг алга.", 400);
      const code = sixDigits();
      const apiKey = Deno.env.get("RESEND_API_KEY") || "";
      const from = Deno.env.get("EMAIL_FROM") || "Gennetex ERP <onboarding@resend.dev>";
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email],
          subject: `data.gennetex.com нэвтрэх код: ${code}`,
          text: `Таны data.gennetex.com-д нэвтрэх код: ${code}\n\n15 минутын дотор хүчинтэй. Та өөрөө нэвтрээгүй бол энэ имэйлийг үл тоомсорлож, sysadmin-д мэдэгдэнэ үү.`,
        }),
      });
      if (!sent.ok) throw new GateError("Gmail руу код илгээж чадсангүй.", 502);
      await db.from("data_gate_attempts").update({ stage: "email", email_code_hash: await sha256(code + gate.id), tries: 0 }).eq("id", gate.id);
      await audit(gate.user_id, "phone_ok");
      return { verified: true, email: maskEmail(email) };
    }

    case "email": {
      const gate = await loadGate(body.gate, "email");
      if (gate.tries >= MAX_TRIES) throw new GateError("Хэт олон буруу оролдлого. Эхнээс нь эхэлнэ үү.", 429);
      const ok = safeEqual(await sha256(String(body.code || "").trim() + gate.id), gate.email_code_hash || "");
      if (!ok) {
        await db.from("data_gate_attempts").update({ tries: gate.tries + 1 }).eq("id", gate.id);
        throw new GateError("Код буруу байна.");
      }
      await db.from("data_gate_attempts").update({ stage: "google", email_code_hash: null }).eq("id", gate.id);
      await audit(gate.user_id, "email_ok");
      return { ok: true };
    }

    case "google": {
      const gate = await loadGate(body.gate, "google");
      const user = await jwtUser(req);
      if (user.id !== gate.user_id) {
        await audit(user.id, "google_mismatch");
        throw new GateError("Утасны дугаартай ижил хүний Google дансаар нэвтэрнэ үү.", 403);
      }
      await db.from("data_gate_attempts").update({ stage: "password" }).eq("id", gate.id);
      const { data: pw } = await db.from("data_passwords").select("user_id").eq("user_id", user.id).maybeSingle();
      await audit(user.id, "google_ok");
      return { ok: true, setup: !pw };
    }

    case "password": {
      const gate = await loadGate(body.gate, "password");
      const user = await jwtUser(req);
      if (user.id !== gate.user_id) throw new GateError("Буруу хэрэглэгч.", 403);
      const password = String(body.password || "");
      const { data: pw } = await db.from("data_passwords").select("*").eq("user_id", user.id).maybeSingle();
      if (!pw) {
        if (password.length < 10) throw new GateError("Нууц үг дор хаяж 10 тэмдэгт байна.");
        const salt = randomHex(16);
        await db.from("data_passwords").insert({ user_id: user.id, salt, hash: await pbkdf2(password, salt, PBKDF2_ITER), iterations: PBKDF2_ITER });
        await audit(user.id, "password_set");
      } else {
        if (pw.locked_until && new Date(pw.locked_until) > new Date()) throw new GateError("Олон буруу оролдлогын улмаас 30 минут түгжигдсэн.", 429);
        if (!safeEqual(await pbkdf2(password, pw.salt, pw.iterations), pw.hash)) {
          const fails = (pw.fails || 0) + 1;
          await db.from("data_passwords").update({ fails, locked_until: fails >= MAX_TRIES ? new Date(Date.now() + 30 * 60000).toISOString() : null }).eq("user_id", user.id);
          await audit(user.id, "password_fail", { fails });
          throw new GateError("Нууц үг буруу.");
        }
        await db.from("data_passwords").update({ fails: 0, locked_until: null }).eq("user_id", user.id);
      }
      const token = randomHex(32);
      await db.from("data_sessions").insert({ user_id: user.id, token_hash: await sha256(token), expires_at: new Date(Date.now() + SESSION_HOURS * 3600000).toISOString() });
      await db.from("data_gate_attempts").delete().eq("id", gate.id);
      await audit(user.id, "login");
      return { token, expiresIn: SESSION_HOURS * 3600 };
    }

    case "tables": {
      await requireSession(req, body);
      const { data, error } = await db.rpc("data_tables");
      if (error) throw new GateError(error.message, 500);
      return { tables: data };
    }

    case "rows": {
      const user = await requireSession(req, body);
      const table = String(body.table || "");
      const { data: tables } = await db.rpc("data_tables");
      const meta = (tables || []).find((t: { name: string }) => t.name === table);
      if (!meta) throw new GateError("Ийм хүснэгт алга.", 404);
      const page = Math.max(0, Number(body.page) || 0);
      const size = Math.min(500, Math.max(10, Number(body.size) || 100));
      let q = db.from(table).select("*", { count: "exact" });
      if (meta.has_created_at) {
        q = q.order("created_at", { ascending: false });
        if (body.from) q = q.gte("created_at", String(body.from));
        if (body.to) q = q.lt("created_at", String(body.to));
      }
      const { data, count, error } = await q.range(page * size, page * size + size - 1);
      if (error) throw new GateError(error.message, 500);
      await audit(user.id, "rows", { table, page });
      return { rows: data, count };
    }

    case "buckets": {
      await requireSession(req, body);
      const { data, error } = await db.storage.listBuckets();
      if (error) throw new GateError(error.message, 500);
      return { buckets: data.map((b) => ({ id: b.id, name: b.name, public: b.public })) };
    }

    case "files": {
      await requireSession(req, body);
      const { data, error } = await db.storage.from(String(body.bucket || "")).list(String(body.prefix || ""), {
        limit: 200,
        offset: Math.max(0, Number(body.offset) || 0),
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw new GateError(error.message, 500);
      return { files: data };
    }

    case "sign": {
      const user = await requireSession(req, body);
      const { data, error } = await db.storage.from(String(body.bucket || "")).createSignedUrl(String(body.path || ""), 600);
      if (error) throw new GateError(error.message, 500);
      await audit(user.id, "file", { bucket: body.bucket, path: body.path });
      return { url: data.signedUrl };
    }

    case "me": {
      const user = await requireSession(req, body);
      return { admin: user.admin };
    }

    case "viewers": {
      await requireSuper(req, body);
      const { data: rows } = await db.from("data_viewers").select("user_id, granted_at");
      const { data: people } = await db.from("profiles").select("id, name, last_name, email, phone, role").neq("role", "superadmin").order("name");
      return { viewers: rows || [], people: people || [] };
    }

    case "viewer_set": {
      const user = await requireSuper(req, body);
      const target = String(body.user_id || "");
      if (!target) throw new GateError("Хэрэглэгч сонгоно уу.");
      if (body.on) await db.from("data_viewers").upsert({ user_id: target, granted_by: user.id });
      else {
        await db.from("data_viewers").delete().eq("user_id", target);
        await db.from("data_sessions").delete().eq("user_id", target);
      }
      await audit(user.id, body.on ? "viewer_add" : "viewer_remove", { target });
      return { ok: true };
    }

    case "logout": {
      await db.from("data_sessions").delete().eq("token_hash", await sha256(String(body.token || "")));
      return { ok: true };
    }
  }
  throw new GateError("Үйлдэл буруу.", 400);
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const body = await req.json().catch(() => ({}));
    return reply(await handle(req, body));
  } catch (e) {
    const status = e instanceof GateError || e instanceof VerifyMnError ? e.status : 500;
    return reply({ error: e instanceof Error ? e.message : String(e) }, status);
  }
});
