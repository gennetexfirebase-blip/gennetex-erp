/**
 * perf-sync — гүйцэтгэлийн Google Sheet-ийг татаж `perf_jobs`-д бүтнээр нь дахин бичнэ.
 *
 *   POST (админы JWT) → { rows, from, to, kinds, aliases }
 *
 * Sheet нь «Anyone with the link» байх ёстой (CSV export). Баганууд:
 *   огноо (2026.10.01) · төрөл · инженер ("A, B") · цаг · кабель татсан эсэх (tiim/ugui) · гэрээний дугаар
 * Шинэ төрөл гарвал perf_rates-д 0 үнэлгээтэй нэмнэ; шинэ нэр perf_aliases-д холбогдоогүй үлдэнэ.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/push.ts";

const cors = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const ok = /^https:\/\/[a-z0-9-]+\.gennetex\.com$/.test(origin) || origin.endsWith(".vercel.app") || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : "https://sanhuu.gennetex.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

const db = createAdminClient();

/** Хашилттай талбар, мөр доторх шинэ мөрийг дэмжих энгийн CSV задлагч. */
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
/** 2026.10.01 · 2026-10-01 · 2026/10/1 → 2026-10-01 */
function isoDate(v: string) {
  const m = norm(v).match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}
const yes = (v: string) => /^(tiim|тийм|yes|y|true|1|татсан)$/i.test(norm(v));

async function handle(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return { status: 401, body: { error: "Нэвтэрнэ үү." } };
  const { data: prof } = await db.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (!["admin", "superadmin"].includes(String(prof?.role || ""))) return { status: 403, body: { error: "Зөвхөн админ." } };

  const { data: st } = await db.from("perf_settings").select("sheet_id, sheet_gid").eq("id", 1).maybeSingle();
  const url = `https://docs.google.com/spreadsheets/d/${st?.sheet_id}/export?format=csv&gid=${st?.sheet_gid}`;
  const r = await fetch(url, { redirect: "follow" });
  const text = await r.text();
  if (!r.ok || !/^\s*[^<]/.test(text)) return { status: 502, body: { error: "Google Sheet-ийг уншиж чадсангүй — «Anyone with the link» эрхтэй эсэхийг шалгана уу." } };

  const [head, ...data] = parseCsv(text);
  const col = (re: RegExp) => head.findIndex((h) => re.test(norm(h).toLowerCase()));
  const iDate = col(/огноо|date/);
  const iKind = col(/төрөл|type/);
  const iEng = col(/инженер|engineer/);
  const iTime = col(/^цаг|time/);
  const iCable = col(/кабель|cable/);
  const iContract = col(/гэрээ|contract/);
  if (iDate < 0 || iKind < 0 || iEng < 0) return { status: 422, body: { error: "Sheet-ийн толгой мөр таарахгүй (огноо, төрөл, инженер)." } };

  // guitsetgel-ээс засварласан Sheet-ийн мөрүүд — дахин оруулахгүй (засвар нь form мөр болж хадгалагдсан).
  const { data: ov } = await db.from("perf_jobs").select("sheet_key").eq("source", "form").not("sheet_key", "is", null);
  const overridden = new Set((ov || []).map((r: { sheet_key: string }) => r.sheet_key));
  const keyOf = (d: string, kind: string, engineers: string[], time: string | null) => [d, kind, engineers.map((e) => e.toLowerCase()).join(","), time || ""].join("|");

  const jobs = [];
  let skipped = 0;
  for (let n = 0; n < data.length; n++) {
    const row = data[n];
    const d = isoDate(row[iDate] || "");
    const kind = norm(row[iKind] || "").toLowerCase();
    const engineers = (row[iEng] || "").split(/[,;+/]/).map(norm).filter(Boolean);
    if (!d || !kind || !engineers.length) continue;
    const jobTime = iTime >= 0 ? norm(row[iTime] || "") || null : null;
    if (overridden.has(keyOf(d, kind, engineers, jobTime))) {
      skipped++;
      continue;
    }
    jobs.push({
      sheet_row: n + 2,
      work_date: d,
      kind,
      engineers,
      job_time: jobTime,
      cable: iCable >= 0 ? yes(row[iCable] || "") : false,
      contract: iContract >= 0 ? norm(row[iContract] || "") || null : null,
      source: "sheet",
    });
  }

  // Бүтнээр нь солино — Sheet дээр засагдсан/устгагдсан мөр ч тусна.
  // Зөвхөн Sheet-ийн мөрийг солино — guitsetgel-ийн формоор гараар бүртгэсэн (source=form) хэвээр.
  const del = await db.from("perf_jobs").delete().eq("source", "sheet");
  if (del.error) return { status: 500, body: { error: del.error.message } };
  for (let i = 0; i < jobs.length; i += 500) {
    const ins = await db.from("perf_jobs").insert(jobs.slice(i, i + 500));
    if (ins.error) return { status: 500, body: { error: ins.error.message } };
  }
  const kinds = [...new Set(jobs.map((j) => j.kind))];
  if (kinds.length) await db.from("perf_rates").upsert(kinds.map((k) => ({ kind: k, label: k })), { onConflict: "kind", ignoreDuplicates: true });
  const aliases = [...new Set(jobs.flatMap((j) => j.engineers.map((e) => e.toLowerCase())))];
  if (aliases.length) await db.from("perf_aliases").upsert(aliases.map((a) => ({ alias: a })), { onConflict: "alias", ignoreDuplicates: true });
  await db.from("perf_settings").update({ last_sync_at: new Date().toISOString(), last_sync_rows: jobs.length }).eq("id", 1);

  const dates = jobs.map((j) => j.work_date).sort();
  return { status: 200, body: { rows: jobs.length, skipped, from: dates[0] || null, to: dates[dates.length - 1] || null, kinds, aliases: aliases.length } };
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const { status, body } = await handle(req);
    return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
