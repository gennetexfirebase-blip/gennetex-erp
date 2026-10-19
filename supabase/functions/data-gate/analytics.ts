/**
 * data.gennetex.com — ирц ба санхүүгийн шинжилгээ (data-gate `analytics`, `advice`).
 *
 * Бүгдийг service role-оор уншиж, клиентэд зөвхөн нэгтгэсэн тоог буцаана.
 *   attendance        — ирэлт (check_in) / явалт; хоцролт = check_in > ажил эхлэх цаг + уучлал
 *   work_hour_entries — ажилласан / илүү цаг
 *   payroll_rates     — өдрийн цалин, илүү цагийн коэф., хоолны мөнгө (тухайн өдөрт хүчинтэй)
 *   meal_ledger       — хоолны мөнгө олгосон
 *   vehicle_logs      — бензин цэнэглэлт (event = 'refuel')
 */

// deno-lint-ignore no-explicit-any
type Db = any;

const UB = "Asia/Ulaanbaatar";
const ubDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: UB });
const ubMinutes = (iso: string) => {
  const [h, m] = new Date(iso).toLocaleTimeString("en-GB", { timeZone: UB, hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return h * 60 + m;
};
const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/** Хуудас хуудсаар бүгдийг уншина (1000 мөрийн хязгаар). */
async function all(q: () => Db, max = 50000) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function computeAnalytics(db: Db, from: string, to: string) {
  const startIso = new Date(`${from}T00:00:00+08:00`).toISOString();
  const endIso = new Date(`${to}T23:59:59.999+08:00`).toISOString();

  const [settings, profiles, depts, att, hours, rates, meals, fuel] = await Promise.all([
    db.from("company_settings").select("work_start_time, late_grace_minutes").limit(1).maybeSingle().then((r: Db) => r.data),
    all(() => db.from("profiles").select("id, name, last_name, department_id, role")),
    all(() => db.from("departments").select("id, name")),
    all(() => db.from("attendance").select("staff_id, staff_name, type, status, created_at").gte("created_at", startIso).lte("created_at", endIso).order("created_at")),
    all(() => db.from("work_hour_entries").select("user_id, work_date, regular_hours, overtime_hours").gte("work_date", from).lte("work_date", to)),
    all(() => db.from("payroll_rates").select("user_id, daily_rate, overtime_multiplier, standard_hours, meal_allowance, effective_from").order("effective_from")),
    all(() => db.from("meal_ledger").select("kind, amount, entry_date").gte("entry_date", from).lte("entry_date", to)),
    all(() => db.from("vehicle_logs").select("plate_number, liters, cost, created_at, note").eq("event", "refuel").gte("created_at", startIso).lte("created_at", endIso)),
  ]);

  const [sh, sm] = String(settings?.work_start_time || "09:00").split(":").map(Number);
  const lateAfter = sh * 60 + sm + Number(settings?.late_grace_minutes || 0);
  const deptName = new Map(depts.map((d) => [String(d.id), String(d.name)]));
  const person = new Map(profiles.map((p) => [String(p.id), p]));
  const nameOf = (id: string, fallback?: unknown) => {
    const p = person.get(id);
    return (p ? `${p.last_name || ""} ${p.name || ""}`.trim() : "") || String(fallback || "Ажилтан");
  };
  const deptOf = (id: string) => deptName.get(String(person.get(id)?.department_id || "")) || "Хэлтэсгүй";
  const staffCount = profiles.filter((p) => p.role !== "superadmin").length;

  // ── Ирц: хүн-өдөр бүрийн эхний check_in ──
  const firstIn = new Map<string, { id: string; day: string; min: number; name: unknown }>();
  for (const r of att) {
    if (r.type !== "check_in" || r.status === "rejected" || !r.staff_id) continue;
    const day = ubDate(String(r.created_at));
    const key = `${r.staff_id}|${day}`;
    const min = ubMinutes(String(r.created_at));
    const cur = firstIn.get(key);
    if (!cur || min < cur.min) firstIn.set(key, { id: String(r.staff_id), day, min, name: r.staff_name });
  }
  const daily = new Map<string, { present: number; late: number }>();
  const byPerson = new Map<string, { days: number; late: number; lateMin: number }>();
  const byDept = new Map<string, { days: number; late: number; hours: number; overtime: number }>();
  const weekday = Array.from({ length: 7 }, () => ({ present: 0, late: 0 }));
  const arrivalBuckets = new Map<string, number>();
  for (const v of firstIn.values()) {
    const late = v.min > lateAfter;
    const d = daily.get(v.day) || { present: 0, late: 0 };
    d.present++;
    if (late) d.late++;
    daily.set(v.day, d);
    const p = byPerson.get(v.id) || { days: 0, late: 0, lateMin: 0 };
    p.days++;
    if (late) {
      p.late++;
      p.lateMin += v.min - lateAfter;
    }
    byPerson.set(v.id, p);
    const dep = byDept.get(deptOf(v.id)) || { days: 0, late: 0, hours: 0, overtime: 0 };
    dep.days++;
    if (late) dep.late++;
    byDept.set(deptOf(v.id), dep);
    const wd = new Date(`${v.day}T12:00:00Z`).getUTCDay();
    weekday[wd].present++;
    if (late) weekday[wd].late++;
    const slot = `${String(Math.floor(v.min / 60)).padStart(2, "0")}:${v.min % 60 < 30 ? "00" : "30"}`;
    arrivalBuckets.set(slot, (arrivalBuckets.get(slot) || 0) + 1);
  }

  // ── Цаг ба цалин (тухайн өдөрт хүчинтэй тариф) ──
  const rateAt = (uid: string, day: string) => {
    let best: Record<string, unknown> | null = null;
    for (const r of rates) if (String(r.user_id) === uid && String(r.effective_from) <= day) best = r;
    return best;
  };
  const monthly = new Map<string, { payroll: number; meal: number; fuel: number; hours: number; overtime: number }>();
  const mon = (m: string) => monthly.get(m) || { payroll: 0, meal: 0, fuel: 0, hours: 0, overtime: 0 };
  let regular = 0;
  let overtime = 0;
  let payroll = 0;
  let mealEarned = 0;
  for (const h of hours) {
    const uid = String(h.user_id);
    const day = String(h.work_date);
    const reg = Number(h.regular_hours) || 0;
    const ot = Number(h.overtime_hours) || 0;
    regular += reg;
    overtime += ot;
    const r = rateAt(uid, day);
    const std = Number(r?.standard_hours) || 8;
    const hourly = (Number(r?.daily_rate) || 0) / std;
    const pay = hourly * reg + hourly * (Number(r?.overtime_multiplier) || 1.5) * ot;
    const meal = reg > 0 ? Number(r?.meal_allowance) || 0 : 0;
    payroll += pay;
    mealEarned += meal;
    const m = mon(day.slice(0, 7));
    m.payroll += pay;
    m.meal += meal;
    m.hours += reg;
    m.overtime += ot;
    monthly.set(day.slice(0, 7), m);
    const dep = byDept.get(deptOf(uid)) || { days: 0, late: 0, hours: 0, overtime: 0 };
    dep.hours += reg;
    dep.overtime += ot;
    byDept.set(deptOf(uid), dep);
  }

  const mealGiven = meals.reduce((s, m) => s + (m.kind === "adjust" ? 0 : Number(m.amount) || 0), 0);

  // ── Бензин ──
  const byPlate = new Map<string, { cost: number; liters: number; count: number }>();
  let fuelCost = 0;
  let fuelLiters = 0;
  for (const f of fuel) {
    const cost = Number(f.cost) || 0;
    const liters = Number(f.liters) || 0;
    fuelCost += cost;
    fuelLiters += liters;
    const k = String(f.plate_number || "—");
    const p = byPlate.get(k) || { cost: 0, liters: 0, count: 0 };
    p.cost += cost;
    p.liters += liters;
    p.count++;
    byPlate.set(k, p);
    const m = mon(ubDate(String(f.created_at)).slice(0, 7));
    m.fuel += cost;
    monthly.set(ubDate(String(f.created_at)).slice(0, 7), m);
  }

  const presentDays = [...daily.values()].reduce((s, d) => s + d.present, 0);
  const lateDays = [...daily.values()].reduce((s, d) => s + d.late, 0);
  const workDays = daily.size;
  const WD = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

  return {
    range: { from, to },
    settings: { work_start: `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`, grace: Number(settings?.late_grace_minutes || 0) },
    kpi: {
      staff: staffCount,
      workDays,
      avgPresent: workDays ? round(presentDays / workDays, 1) : 0,
      attendanceRate: workDays && staffCount ? round((presentDays / (workDays * staffCount)) * 100, 1) : 0,
      lateRate: presentDays ? round((lateDays / presentDays) * 100, 1) : 0,
      regularHours: round(regular, 1),
      overtimeHours: round(overtime, 1),
      overtimeShare: regular + overtime ? round((overtime / (regular + overtime)) * 100, 1) : 0,
      payroll: round(payroll),
      mealEarned: round(mealEarned),
      mealGiven: round(mealGiven),
      fuelCost: round(fuelCost),
      fuelLiters: round(fuelLiters, 1),
      totalCost: round(payroll + mealEarned + fuelCost),
    },
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, present: d.present, late: d.late, onTime: d.present - d.late })),
    weekday: [1, 2, 3, 4, 5, 6, 0].map((i) => ({ day: WD[i], present: weekday[i].present, lateRate: weekday[i].present ? round((weekday[i].late / weekday[i].present) * 100, 1) : 0 })),
    arrivals: [...arrivalBuckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([slot, n]) => ({ slot, n })),
    departments: [...byDept.entries()].map(([name, d]) => ({ name, days: d.days, lateRate: d.days ? round((d.late / d.days) * 100, 1) : 0, hours: round(d.hours, 1), overtime: round(d.overtime, 1) })).sort((a, b) => b.days - a.days),
    lateTop: [...byPerson.entries()].filter(([, p]) => p.late > 0).map(([id, p]) => ({ name: nameOf(id), department: deptOf(id), late: p.late, days: p.days, avgLateMin: round(p.lateMin / p.late) })).sort((a, b) => b.late - a.late || b.avgLateMin - a.avgLateMin).slice(0, 10),
    monthly: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, m]) => ({ month, payroll: round(m.payroll), meal: round(m.meal), fuel: round(m.fuel), hours: round(m.hours, 1), overtime: round(m.overtime, 1) })),
    fuel: [...byPlate.entries()].map(([plate, p]) => ({ plate, cost: round(p.cost), liters: round(p.liters, 1), count: p.count })).sort((a, b) => b.cost - a.cost),
  };
}

/** AI зөвлөгөө — ai-chat-тэй ижил OpenAI-нийцтэй сервер (AI_BASE_URL / AI_MODEL / AI_API_KEY). */
export async function aiAdvice(summary: unknown) {
  const base = (Deno.env.get("AI_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/+$/, "");
  const model = Deno.env.get("AI_MODEL") ?? "gemini-3.6-flash";
  const key = Deno.env.get("AI_API_KEY") ?? "";
  if (!key && base.includes("googleapis")) return null;
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Чи Gennetex ХХК-ийн (шилэн кабель, сүлжээний угсралтын компани) үйл ажиллагааны шинжээч. Өгөгдсөн ирц, цалин, хоолны мөнгө, бензиний нэгтгэлээс " +
            "монгол хэлээр, товч, тодорхой дүгнэлт хий: 1) Гол ажиглалт (3–4), 2) Эрсдэл/анхаарах зүйл, 3) Үр дүнг дээшлүүлэх, зардал хэмнэх 4–6 тодорхой алхам (хэн, юу, хэзээ), " +
            "4) Дараагийн сард хянах үзүүлэлт. Зөвхөн өгөгдөлд тулгуурла, тоо зохиож болохгүй. Markdown жагсаалт ашигла, 250 үгээс хэтрүүлэхгүй.",
        },
        { role: "user", content: JSON.stringify(summary) },
      ],
    }),
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return String(j?.choices?.[0]?.message?.content || "").trim() || null;
}
