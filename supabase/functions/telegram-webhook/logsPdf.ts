import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const ACTION_LABELS: Record<string, string> = {
  login: "Нэвтрэлт",
  leave_request: "Чөлөө",
  screen: "Дэлгэц",
  tap: "Даралт",
  location: "Байршил",
  face_enroll: "Царай",
  attendance: "Ирц",
  inventory: "Бараа",
  visit: "Айлд очсон",
  site_work: "Ажлын байр",
  service_call: "Дуудлага",
  feedback: "Санал",
  other: "Бусад",
};

const ATTENDANCE_TYPE: Record<string, string> = {
  check_in: "Ирсэн",
  check_out: "Явсан",
};

let cachedFont: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const res = await fetch(
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
  );
  if (!res.ok) throw new Error("font_load_failed");
  cachedFont = await res.arrayBuffer();
  return cachedFont;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar", hour12: false });
  } catch {
    return String(iso);
  }
}

function clip(s: unknown, max = 80): string {
  const t = String(s ?? "—").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function wrapLine(text: string, maxChars = 95): string[] {
  if (text.length <= maxChars) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut < 40) cut = maxChars;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

type PdfWriter = {
  doc: PDFDocument;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  page: ReturnType<PDFDocument["addPage"]>;
  y: number;
  margin: number;
  lineH: number;
  fontSize: number;
};

function newPage(w: PdfWriter) {
  w.page = w.doc.addPage([595, 842]);
  w.y = w.page.getHeight() - w.margin;
}

function ensureSpace(w: PdfWriter, lines = 1) {
  if (w.y - lines * w.lineH < w.margin) newPage(w);
}

function drawText(w: PdfWriter, text: string, opts: { size?: number } = {}) {
  const size = opts.size ?? w.fontSize;
  const lineH = size + 5;
  for (const line of wrapLine(text, 92)) {
    ensureSpace(w, 1);
    w.page.drawText(line, {
      x: w.margin,
      y: w.y,
      size,
      font: w.font,
      color: rgb(0.1, 0.1, 0.12),
    });
    w.y -= lineH;
  }
}

function drawSection(w: PdfWriter, title: string) {
  ensureSpace(w, 2);
  w.y -= 6;
  drawText(w, title, { size: 13 });
  w.y -= 4;
}

function tankLiters(v: Record<string, unknown>): number {
  return Number(v.tank_capacity_liters) || 60;
}

function buildVehicleFuelRows(vehicles: Record<string, unknown>[], trips: Record<string, unknown>[]) {
  return (vehicles || []).map((v) => {
    const vid = v.id;
    const plate = v.plate_number;
    const vTrips = (trips || []).filter(
      (t) => (vid && t.vehicle_id === vid) || (plate && t.plate_number === plate),
    );
    const km = Math.round(vTrips.reduce((s, t) => s + Number(t.distance_km || 0), 0) * 100) / 100;
    const liters = Math.round(vTrips.reduce((s, t) => s + Number(t.liters || 0), 0) * 100) / 100;
    const tank = tankLiters(v);
    let lvl = Number(v.fuel_level_percent ?? 100);
    const active = vTrips.find((t) => t.status === "active");
    if (active && tank > 0) {
      const drain = (Number(active.liters || 0) / tank) * 100;
      lvl = Math.max(0, Math.min(100, Math.round((lvl - drain) * 10) / 10));
    }
    const remain = Math.round(((lvl / 100) * tank) * 10) / 10;
    return {
      plate: clip(plate, 12),
      driver: clip(v.driver_name, 20),
      km,
      liters,
      lvl,
      remain,
      tank,
      trips: vTrips.length,
      active: Boolean(active),
    };
  }).sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || b.km - a.km);
}

function latestLocationPerUser(locations: Record<string, unknown>[]) {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of locations || []) {
    const key = String(row.user_id || row.user_name || "");
    if (!key || map.has(key)) continue;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) =>
    String(a.user_name || "").localeCompare(String(b.user_name || ""), "mn")
  );
}

export async function fetchReportData24h(sb: SupabaseClient) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [activity, visits, locations, vehicles, trips, attendance] = await Promise.all([
    sb.from("activity_logs").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
    sb.from("visit_logs").select("*").gte("arrived_at", since).order("arrived_at", { ascending: false }).limit(500),
    sb.from("location_logs").select("*").gte("recorded_at", since).order("recorded_at", { ascending: false }).limit(1500),
    sb.from("vehicles").select("*").order("plate_number"),
    sb.from("trips").select("*").gte("started_at", since).order("started_at", { ascending: false }).limit(500),
    sb.from("attendance").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(1500),
  ]);
  const vehicleRows = vehicles.data || [];
  const tripRows = trips.data || [];
  return {
    since,
    activity: activity.data || [],
    visits: visits.data || [],
    locations: locations.data || [],
    vehicles: vehicleRows,
    trips: tripRows,
    attendance: attendance.data || [],
    fuelRows: buildVehicleFuelRows(vehicleRows, tripRows),
    latestCoords: latestLocationPerUser(locations.data || []),
  };
}

async function buildLogsPdfFromData(data: Awaited<ReturnType<typeof fetchReportData24h>>): Promise<Uint8Array> {
  const {
    since, activity, visits, locations, attendance, fuelRows, latestCoords,
  } = data;

  const fontBytes = await loadFont();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes);

  const w: PdfWriter = {
    doc,
    font,
    page: doc.addPage([595, 842]),
    y: 0,
    margin: 40,
    lineH: 14,
    fontSize: 9,
  };
  w.y = w.page.getHeight() - w.margin;

  const nowLabel = fmtTime(new Date().toISOString());
  drawText(w, "Gennetex ERP — 24 цагийн тайлан", { size: 16 });
  drawText(w, `Хугацаа: ${fmtTime(since)} → ${nowLabel}`, { size: 10 });
  drawText(w, [
    `Машин: ${fuelRows.length}`,
    `Ирц: ${attendance.length}`,
    `Координат (ажилтан): ${latestCoords.length}`,
    `Лог: ${activity.length}`,
  ].join(" · "), { size: 10 });
  w.y -= 8;

  drawSection(w, `══ Машин — бензин зарцуулалт (24ц) ══`);
  if (!fuelRows.length) {
    drawText(w, "Машин бүртгэлгүй.");
  } else {
    for (const r of fuelRows) {
      const line = `${r.plate} | ${r.driver} | ${r.km} км | ${r.liters} л | ${r.trips} аялал${r.active ? " | ЯВЖ БАЙНА" : ""}`;
      drawText(w, line);
    }
  }

  drawSection(w, `══ Машин — түлшний түвшин ══`);
  for (const r of fuelRows) {
    const line = `${r.plate} | ${r.driver} | ${r.lvl}% | ${r.remain}/${r.tank} л`;
    drawText(w, line);
  }

  drawSection(w, `══ Ажилчдын сүүлийн координат (${latestCoords.length}) ══`);
  if (!latestCoords.length) {
    drawText(w, "Байршлын мэдээлэл алга.");
  } else {
    for (const row of latestCoords) {
      const lat = row.latitude != null ? Number(row.latitude).toFixed(5) : "—";
      const lng = row.longitude != null ? Number(row.longitude).toFixed(5) : "—";
      const line = `${clip(row.user_name, 22)} | ${lat}, ${lng} | ${fmtTime(row.recorded_at as string)}`;
      drawText(w, line);
    }
  }

  drawSection(w, `══ Ирц (${attendance.length}) ══`);
  if (!attendance.length) {
    drawText(w, "Ирцийн бүртгэл алга.");
  } else {
    for (const row of attendance) {
      const typ = ATTENDANCE_TYPE[row.type as string] || row.type || "—";
      const lat = row.latitude != null ? Number(row.latitude).toFixed(5) : "—";
      const lng = row.longitude != null ? Number(row.longitude).toFixed(5) : "—";
      const line = `${fmtTime(row.created_at as string)} | ${clip(row.staff_name, 20)} | ${typ} | ${row.status || "—"} | ${lat}, ${lng}`;
      drawText(w, line);
    }
  }

  drawSection(w, `══ Нийт лог (${activity.length}) ══`);
  if (!activity.length) {
    drawText(w, "Мэдээлэл алга.");
  } else {
    const cap = Math.min(activity.length, 400);
    for (let i = 0; i < cap; i++) {
      const row = activity[i];
      const label = ACTION_LABELS[row.action as string] || row.action || "—";
      const line = `${fmtTime(row.created_at as string)} | ${clip(row.user_name, 20)} | ${label} | ${clip(row.detail, 40)}`;
      drawText(w, line);
    }
    if (activity.length > cap) drawText(w, `... дахиад ${activity.length - cap} мөр (хязгаарласан)`);
  }

  drawSection(w, `══ Очсон лог (${visits.length}) ══`);
  for (const row of visits) {
    const line = `${fmtTime(row.arrived_at as string)} | ${clip(row.user_name, 20)} | ${clip(row.customer, 28)}`;
    drawText(w, line);
  }

  drawSection(w, `══ Байршлын түүх (${locations.length}) ══`);
  const locCap = Math.min(locations.length, 200);
  for (let i = 0; i < locCap; i++) {
    const row = locations[i];
    const lat = row.latitude != null ? Number(row.latitude).toFixed(5) : "—";
    const lng = row.longitude != null ? Number(row.longitude).toFixed(5) : "—";
    const line = `${fmtTime(row.recorded_at as string)} | ${clip(row.user_name, 20)} | ${lat}, ${lng}`;
    drawText(w, line);
  }
  if (locations.length > locCap) drawText(w, `... дахиад ${locations.length - locCap} мөр`);

  drawText(w, `\nҮүсгэсэн: ${nowLabel} · Gennetex`, { size: 8 });
  return await doc.save();
}

export async function buildLogsPdf24h(sb: SupabaseClient): Promise<Uint8Array> {
  return buildLogsPdfFromData(await fetchReportData24h(sb));
}

export type ReportCounts = {
  activity: number;
  visits: number;
  locations: number;
  attendance: number;
  vehicles: number;
  employees_with_coords: number;
};

export async function sendLogsPdfToTelegram(
  botToken: string,
  chatId: number | string,
  sb: SupabaseClient,
): Promise<{ ok: boolean; counts: ReportCounts; error?: string }> {
  try {
    const logData = await fetchReportData24h(sb);
    const pdfBytes = await buildLogsPdfFromData(logData);
    const { since, activity, visits, locations, attendance, fuelRows, latestCoords } = logData;
    const filename = `gennetex-24h-${new Date().toISOString().slice(0, 10)}.pdf`;
    const caption = [
      "📋 Gennetex — 24 цагийн тайлан",
      `${fmtTime(since)} → одоо`,
      `🚗 Машин ${fuelRows.length} · ⛽ зарцуулалт/түвшин`,
      `📍 Координат ${latestCoords.length} ажилтан`,
      `🕐 Ирц ${attendance.length} · Лог ${activity.length}`,
    ].join("\n");

    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption);
    form.append("document", new Blob([pdfBytes], { type: "application/pdf" }), filename);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    const counts: ReportCounts = {
      activity: activity.length,
      visits: visits.length,
      locations: locations.length,
      attendance: attendance.length,
      vehicles: fuelRows.length,
      employees_with_coords: latestCoords.length,
    };
    if (!res.ok || !data.ok) {
      return { ok: false, counts, error: JSON.stringify(data) };
    }
    return { ok: true, counts };
  } catch (e) {
    return {
      ok: false,
      counts: { activity: 0, visits: 0, locations: 0, attendance: 0, vehicles: 0, employees_with_coords: 0 },
      error: String(e),
    };
  }
}
