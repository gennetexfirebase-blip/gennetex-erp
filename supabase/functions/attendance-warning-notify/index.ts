/**
 * Ирцийн сануулга илгээх — апп (push + Мэдэгдлийн төв) ба имэйл (Resend).
 *
 * Дуудагч: нэвтэрсэн админ ЭСВЭЛ цагийн тайлангийн үзэх түлхүүртэй
 * (апп дотор WebView-ээр нээгдсэн tailan.gennetex.com). Сануулга нь
 * `create_attendance_warnings` RPC-ээр аль хэдийн үүссэн байх ёстой —
 * энд зөвхөн тэдгээрийг хүргэнэ, дахин илгээхгүй (pushed_at/emailed_at).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";
import { createAdminClient, sendPushAudience } from "../_shared/push.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (v: unknown) =>
  String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const fmt = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return `${y} оны ${m}-р сарын ${dd}`;
};

function emailHtml(w: Record<string, any>, link: string) {
  const s = w.stats || {};
  const stat = (k: string, v: unknown) =>
    `<td style="padding:12px 10px;border:1px solid #e4e8ee;text-align:center"><div style="font-size:12px;color:#55627a">${esc(k)}</div><div style="font-size:20px;font-weight:700;margin-top:4px">${esc(v)}</div></td>`;
  return `<!doctype html><html><body style="margin:0;background:#edf0f4;font-family:Arial,sans-serif;color:#13203a"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #dce2ea;border-radius:16px;padding:28px">
<div style="font-weight:700;color:#2a45c9;font-size:13px;letter-spacing:.4px">ЖЕННЕТЕКС ХХК · ЦАГИЙН ТАЙЛАН</div>
<h1 style="margin:10px 0 6px;font-size:21px">${esc(w.title)}</h1>
<p style="margin:0 0 16px;color:#55627a;font-size:13px">${esc(fmt(w.period_from))} – ${esc(fmt(w.period_to))}</p>
<p style="margin:0 0 16px;line-height:1.6">Сайн байна уу, ${esc(w.employee_name || "")}.</p>
<p style="margin:0 0 18px;line-height:1.6;white-space:pre-line">${esc(w.message)}</p>
<table style="border-collapse:collapse;width:100%;margin-bottom:20px"><tr>${stat("Ирц", `${s.rate ?? "—"}%`)}${stat("Хоцорсон", `${s.late ?? 0} удаа`)}${stat("Тасалсан", `${s.absent ?? 0} өдөр`)}${stat("Ажилласан", `${s.hours ?? 0} ц`)}</tr></table>
<p style="margin:0 0 22px"><a href="${esc(link)}" style="display:inline-block;background:#2a45c9;color:#fff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:700">Ирцээ дэлгэрэнгүй харах</a></p>
<p style="font-size:12px;color:#8a96ab;word-break:break-all">${esc(link)}</p>
<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #eef1f5;font-size:12px;color:#8a96ab">Илгээсэн: ${esc(w.created_by_name || "Админ")}. Энэ имэйл Gennetex ERP системээс автоматаар илгээгдсэн.</p>
</div></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail = Deno.env.get("EMAIL_FROM") || "Gennetex ERP <onboarding@resend.dev>";
  const baseUrl = (Deno.env.get("TIME_REPORT_BASE_URL") || "https://tailan.gennetex.com").replace(/\/+$/, "");

  let body: { ids?: string[]; key?: string } = {};
  try { body = await req.json(); } catch { /* хоосон */ }
  const ids = (body.ids || []).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))).slice(0, 100);
  if (!ids.length) return reply({ ok: false, error: "invalid_request" }, 400);

  const db = createAdminClient();

  // Эрх: админы сесс эсвэл хүчинтэй үзэх түлхүүр.
  let allowed = false;
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader && anonKey) {
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data } = await userClient.auth.getUser();
    if (data?.user) {
      const { data: p } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      allowed = ["admin", "superadmin"].includes(String(p?.role || ""));
    }
  }
  if (!allowed && body.key && body.key.length >= 24 && body.key.length <= 128) {
    const { data: k } = await db.from("report_access_keys").select("id, expires_at")
      .eq("key_hash", await sha256Hex(body.key)).is("revoked_at", null).maybeSingle();
    allowed = !!k && (!k.expires_at || new Date(k.expires_at) > new Date());
  }
  if (!allowed) return reply({ ok: false, error: "forbidden" }, 403);

  // Сүүлийн 1 цагт үүссэн, хараахан хүргээгүй сануулгууд л.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { data: rows, error } = await db.from("attendance_warnings").select("*").in("id", ids).gte("created_at", since);
  if (error) return reply({ ok: false, error: error.message }, 500);

  const results: Record<string, unknown>[] = [];
  for (const w of rows || []) {
    const link = `${baseUrl}/w/${w.token}`;
    const r: Record<string, unknown> = { id: w.id, name: w.employee_name };
    if (!w.pushed_at) {
      try {
        const push = await sendPushAudience(db, { kind: "user", userId: w.employee_id }, {
          title: w.title,
          body: w.message.slice(0, 300),
          type: "attendance_warning",
          screen: "AttendanceHistory",
          data: { start: w.period_from, end: w.period_to, warningUrl: link },
        });
        r.push = push.sent > 0 ? "sent" : push.tokens ? "failed" : "no_device";
        await db.from("attendance_warnings").update({ pushed_at: new Date().toISOString() }).eq("id", w.id);
      } catch (e) {
        r.push = `error: ${e instanceof Error ? e.message : e}`;
      }
    }
    if (!w.emailed_at) {
      const to = String(w.employee_email || "");
      if (!apiKey) r.email = "not_configured";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) r.email = "no_email";
      else {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: fromEmail, to: [to], subject: w.title, html: emailHtml(w, link), text: `${w.title}\n\n${w.message}\n\n${link}` }),
        });
        r.email = res.ok ? "sent" : `error: ${(await res.text()).slice(0, 200)}`;
        if (res.ok) await db.from("attendance_warnings").update({ emailed_at: new Date().toISOString() }).eq("id", w.id);
      }
    }
    results.push(r);
  }
  return reply({ ok: true, results });
});
