/**
 * Хөдөлмөрийн гэрээний имэйл мэдэгдэл (Resend).
 *
 *   sent     → ажилтанд: «Танд хөдөлмөрийн гэрээ байгуулах хүсэлт ирлээ»
 *   signed   → Захиралд: «Гэрээ баталгаажуулах хүсэлт»
 *   approved → ажилтанд: «Гэрээ баталгаажлаа»
 *   returned → гэрээ үүсгэсэн админд: «Захирал гэрээг буцаалаа»
 *
 * Дуудагч тухайн үйлдлийг хийх эрхтэй, гэрээ харгалзах төлөвт байгаа
 * эсэхийг серверт шалгана — дурын хүнд имэйл илгээх боломжгүй.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DIRECTOR_EMAIL = "bayasgalan.gennetex@gmail.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (v: unknown) =>
  String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function emailHtml(title: string, lines: string[], button: string, url: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f5f4;font-family:Arial,sans-serif;color:#0f1722"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e3e8e6;border-radius:14px;padding:28px"><div style="font-weight:700;color:#0b6e4f;font-size:13px;letter-spacing:.4px">ЖЕННЕТЕКС ХХК</div><h1 style="margin:10px 0 14px;font-size:21px">${esc(title)}</h1>${lines.map((l) => `<p style="margin:0 0 10px;line-height:1.55">${esc(l)}</p>`).join("")}<p style="margin:24px 0"><a href="${esc(url)}" style="display:inline-block;background:#0b6e4f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:700">${esc(button)}</a></p><p style="font-size:12px;color:#677284;word-break:break-all">${esc(url)}</p><p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #eef1f0;font-size:12px;color:#8a949f">Энэ имэйл Gennetex ERP системээс автоматаар илгээгдсэн.</p></div></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail = Deno.env.get("EMAIL_FROM") || "Gennetex ERP <onboarding@resend.dev>";
  const baseUrl = (Deno.env.get("CONTRACT_BASE_URL") || "https://geree.gennetex.com").replace(/\/+$/, "");
  if (!url || !anonKey || !serviceKey || !apiKey) return reply({ ok: false, error: "not_configured" }, 503);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    auth: { persistSession: false },
  });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth?.user;
  if (!user) return reply({ ok: false, error: "unauthorized" }, 401);
  const callerEmail = String(user.email || "").toLowerCase();

  let body: { contractId?: string; event?: string } = {};
  try { body = await req.json(); } catch { /* хоосон */ }
  const event = String(body.event || "");
  if (!/^[0-9a-f-]{36}$/i.test(String(body.contractId || ""))) return reply({ ok: false, error: "invalid_request" }, 400);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: c } = await db.from("employment_contracts").select("*").eq("id", body.contractId).maybeSingle();
  if (!c) return reply({ ok: false, error: "not_found" }, 404);
  const { data: caller } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = ["admin", "superadmin"].includes(String(caller?.role || ""));
  const isDirector = callerEmail === DIRECTOR_EMAIL;
  const isParty = c.employee_id === user.id || String(c.employee_email).toLowerCase() === callerEmail;

  const name = [c.family_name ? `${String(c.family_name).slice(0, 1)}.` : "", c.given_name].join("");
  const link = `${baseUrl}/${c.slug}`;
  let to = "";
  let subject = "";
  let html = "";

  if (event === "sent" && isAdmin && c.status === "sent") {
    to = c.employee_email;
    subject = "Танд хөдөлмөрийн гэрээ байгуулах хүсэлт ирлээ";
    html = emailHtml(subject, [
      `Сайн байна уу, ${c.given_name}.`,
      `ЖЕННЕТЕКС ХХК танд №${c.contract_number} ажил гүйцэтгэх гэрээ илгээлээ.`,
      "Доорх холбоосоор орж гэрээтэй бүрэн танилцаад гарын үсгээ зурж илгээнэ үү. Нэвтрэхдээ энэ имэйл хаягтай Google данс ашиглана.",
    ], "Гэрээтэй танилцах", link);
  } else if (event === "signed" && isParty && c.status === "signed") {
    to = DIRECTOR_EMAIL;
    subject = `Гэрээ баталгаажуулах хүсэлт — ${name}`;
    html = emailHtml(subject, [
      `${c.family_name || ""} ${c.given_name} №${c.contract_number} гэрээтэй танилцаж гарын үсэг зурлаа.`,
      "Гэрээг шалгаад баталгаажуулна уу.",
    ], "Гэрээг харах, баталгаажуулах", link);
  } else if (event === "approved" && isDirector && c.status === "approved") {
    to = c.employee_email;
    subject = "Таны хөдөлмөрийн гэрээ баталгаажлаа";
    html = emailHtml(subject, [
      `Сайн байна уу, ${c.given_name}.`,
      `№${c.contract_number} гэрээг Захирал баталгаажууллаа. Гэрээний PDF-ийг доорх холбоосоос татаж авна уу.`,
    ], "Гэрээг харах", link);
  } else if (event === "returned" && isDirector && c.status === "returned" && c.created_by) {
    const { data: creator } = await db.from("profiles").select("email").eq("id", c.created_by).maybeSingle();
    to = String(creator?.email || "");
    subject = `Захирал гэрээг буцаалаа — ${name}`;
    html = emailHtml(subject, [
      `№${c.contract_number} гэрээг Захирал буцаалаа.`,
      c.director_note ? `Тайлбар: ${c.director_note}` : "Засаад дахин илгээнэ үү.",
    ], "Гэрээг харах", link);
  } else {
    return reply({ ok: false, error: "forbidden" }, 403);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return reply({ ok: false, error: "no_recipient" }, 400);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, html, text: `${subject}\n\n${link}` }),
  });
  if (!res.ok) return reply({ ok: false, error: await res.text() }, 502);
  return reply({ ok: true, to });
});
