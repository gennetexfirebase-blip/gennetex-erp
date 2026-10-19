import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Banknote, Clock, Fuel, Lightbulb, RefreshCw, Sparkles, TrendingUp, Users, UtensilsCrossed } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, KpiRow, Loading, StatCard } from '../components/ui';
import { HBarChart } from '../components/charts';
import { useTheme } from '../lib/theme';

/**
 * data.gennetex.com → «Шинжилгээ»: ирц ба санхүүгийн (цалин, хоолны мөнгө, бензин)
 * нэгтгэл график хэлбэрээр + дүрэмд суурилсан дүгнэлт + AI зөвлөгөө.
 * Өгөгдлийг data-gate `analytics` (service role, зөвхөн нийлбэр) буцаана.
 */

type Analytics = {
  range: { from: string; to: string };
  settings: { work_start: string; grace: number };
  kpi: {
    staff: number; workDays: number; avgPresent: number; attendanceRate: number; lateRate: number;
    regularHours: number; overtimeHours: number; overtimeShare: number;
    payroll: number; mealEarned: number; mealGiven: number; mealAdvance?: number; mealAdvanceCount?: number; fuelCost: number; fuelLiters: number; totalCost: number;
  };
  daily: { date: string; present: number; late: number; onTime: number }[];
  weekday: { day: string; present: number; lateRate: number }[];
  arrivals: { slot: string; n: number }[];
  departments: { name: string; days: number; lateRate: number; hours: number; overtime: number }[];
  lateTop: { name: string; department: string; late: number; days: number; avgLateMin: number }[];
  monthly: { month: string; payroll: number; meal: number; fuel: number; hours: number; overtime: number }[];
  fuel: { plate: string; cost: number; liters: number; count: number }[];
  meals?: { name: string; department: string; advance: number; advanceSum: number; now: number; nowSum: number; catchup: number; catchupSum: number; total: number; last: string }[];
};
type Call = <T>(body: Record<string, unknown>) => Promise<T>;

const money = (n: number) => `${new Intl.NumberFormat('mn-MN').format(Math.round(n || 0))}₮`;
const short = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}сая` : Math.abs(n) >= 1e3 ? `${Math.round(n / 1e3)}мян` : String(Math.round(n)));
const ubToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });

/** Хугацааны бэлэн сонголтууд. */
function presets() {
  const t = ubToday();
  const [y, m] = t.split('-').map(Number);
  const first = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10);
  const last = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
  return [
    { key: 'month', label: 'Энэ сар', from: first(y, m), to: t },
    { key: 'prev', label: 'Өмнөх сар', from: first(y, m - 1), to: last(y, m - 1) },
    { key: '3m', label: 'Сүүлийн 3 сар', from: first(y, m - 2), to: t },
    { key: 'year', label: `${y} он`, from: `${y}-01-01`, to: t },
  ];
}

/** Категорийн палитр (dataviz reference, эхний 3 слот) — горим бүрт тусдаа алхам. */
const PALETTE = {
  light: { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', ok: '#1baf7a', late: '#eda100', grid: '#e3e9e6', ink: '#45534d' },
  dark: { s1: '#3987e5', s2: '#d95926', s3: '#199e70', ok: '#199e70', late: '#c98500', grid: '#2a2d2b', ink: '#a9aeac' },
};

/** Дүрэмд суурилсан дүгнэлт — AI-гүйгээр ч гарна. */
function insights(a: Analytics) {
  const out: { tone: 'good' | 'warn' | 'bad'; text: string }[] = [];
  const k = a.kpi;
  if (k.lateRate >= 20) out.push({ tone: 'bad', text: `Хоцролт өндөр — ирсэн тохиолдлын ${k.lateRate}% нь ${a.settings.work_start}-аас хойш. Ажил эхлэх цаг, тээврийн асуудлыг хэлтэс бүрээр шалгаарай.` });
  else if (k.lateRate >= 10) out.push({ tone: 'warn', text: `Хоцролт ${k.lateRate}% — 10%-аас доош буулгах зорилт тавь. Олон удаа хоцорсон ажилтантай ганцаарчлан ярилц.` });
  else if (k.workDays) out.push({ tone: 'good', text: `Хоцролт ${k.lateRate}% — сайн түвшинд байна.` });
  if (k.attendanceRate && k.attendanceRate < 80) out.push({ tone: 'warn', text: `Өдөрт дунджаар ${k.avgPresent} ажилтан ирц бүртгүүлсэн (${k.attendanceRate}%). Апп-аар ирц бүртгэдэггүй ажилтан байж магадгүй — хянах хэрэгтэй.` });
  if (k.overtimeShare >= 15) out.push({ tone: 'warn', text: `Илүү цаг нийт цагийн ${k.overtimeShare}% (${k.overtimeHours} ц) — ажлын ачаалал, хуваарийг дахин төлөвлөх эсвэл хүн нэмэх нь илүү цагийн (1.5×) зардлаас хямд байж болно.` });
  const worstDay = [...a.weekday].filter((d) => d.present >= 3).sort((x, y) => y.lateRate - x.lateRate)[0];
  if (worstDay && worstDay.lateRate >= 15) out.push({ tone: 'warn', text: `${worstDay.day} гарагт хоцролт хамгийн их (${worstDay.lateRate}%). Тэр өдрийн өглөөний ажлын зохион байгуулалтыг шалга.` });
  const worstDept = a.departments.filter((d) => d.days >= 5).sort((x, y) => y.lateRate - x.lateRate)[0];
  if (worstDept && worstDept.lateRate >= 15) out.push({ tone: 'warn', text: `«${worstDept.name}» хэлтэст хоцролт ${worstDept.lateRate}% — хэлтсийн ахлагчтай ярилц.` });
  if (k.fuelCost && k.totalCost && k.fuelCost / k.totalCost >= 0.15) out.push({ tone: 'warn', text: `Бензин нийт зардлын ${Math.round((k.fuelCost / k.totalCost) * 100)}% (${money(k.fuelCost)}). Маршрутыг нэгтгэх, «Хамт яваа баг»-ийг ашиглах нь зардлыг бууруулна.` });
  const topCar = a.fuel[0];
  if (topCar && a.fuel.length > 1 && topCar.cost > (k.fuelCost / a.fuel.length) * 2) out.push({ tone: 'warn', text: `${topCar.plate} машин бусдаасаа 2 дахин их бензин зарцуулсан (${money(topCar.cost)}). Ашиглалт, техникийн байдлыг шалга.` });
  const frequent = (a.meals || []).filter((m) => m.advance >= 3);
  if (frequent.length) out.push({ tone: 'warn', text: `Хоолны мөнгөө олон удаа урьдчилж авсан: ${frequent.slice(0, 5).map((m) => `${m.name} (${m.advance} удаа)`).join(', ')}. Урьдчилгааны давтамжид хязгаар тогтоох эсэхийг шийд.` });
  if (k.mealEarned && k.mealGiven > k.mealEarned * 1.1) out.push({ tone: 'warn', text: `Хоолны мөнгө хуримтлагдсанаас ${money(k.mealGiven - k.mealEarned)}-өөр илүү олгогдсон — урьдчилгааг хяна.` });
  return out;
}

export default function DataAnalytics({ call }: { call: Call }) {
  const list = useMemo(presets, []);
  const [preset, setPreset] = useState(list[0].key);
  const range = list.find((p) => p.key === preset)!;
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [advice, setAdvice] = useState<{ busy: boolean; text: string | null; tried: boolean }>({ busy: false, text: null, tried: false });
  const { theme } = useTheme();
  const c = PALETTE[theme];

  const load = () => {
    setLoading(true);
    setError('');
    setAdvice({ busy: false, text: null, tried: false });
    call<Analytics>({ action: 'analytics', from: range.from, to: range.to })
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  const askAi = async () => {
    if (!data) return;
    setAdvice({ busy: true, text: null, tried: true });
    // Хувийн нэргүй нэгтгэл л илгээнэ.
    const summary = { ...data, lateTop: data.lateTop.map((p) => ({ department: p.department, late: p.late, days: p.days, avgLateMin: p.avgLateMin })) };
    try {
      const r = await call<{ text: string | null }>({ action: 'advice', summary });
      setAdvice({ busy: false, text: r.text, tried: true });
    } catch {
      setAdvice({ busy: false, text: null, tried: true });
    }
  };

  const tip = { contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }, cursor: { fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' } };
  const axis = { stroke: c.ink, fontSize: 11, tickLine: false, axisLine: false };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-[var(--radius)] bg-card2 p-1" role="tablist" aria-label="Хугацаа">
          {list.map((p) => (
            <button key={p.key} role="tab" aria-selected={preset === p.key} onClick={() => setPreset(p.key)} className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-semibold ${preset === p.key ? 'bg-card text-ink shadow-[var(--shadow)]' : 'text-muted hover:text-ink'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-[12px] tabular-nums text-subtle">{range.from} — {range.to}</span>
        <Button variant="ghost" className="ml-auto" icon={<RefreshCw size={14} />} onClick={load}>Шинэчлэх</Button>
      </div>

      {loading && !data ? <Loading text="Шинжилж байна…" /> : error ? <ErrorState text={error} onRetry={load} /> : !data ? null : (
        <>
          <KpiRow>
            <StatCard tone="green" icon={<Users size={19} />} value={`${data.kpi.attendanceRate}%`} label="Ирцийн хувь" note={`Өдөрт ~${data.kpi.avgPresent} / ${data.kpi.staff} ажилтан`} />
            <StatCard tone="amber" icon={<Clock size={19} />} value={`${data.kpi.lateRate}%`} label="Хоцролт" note={`${data.settings.work_start} + ${data.settings.grace} мин уучлал`} />
            <StatCard tone="blue" icon={<TrendingUp size={19} />} value={`${data.kpi.overtimeHours} ц`} label="Илүү цаг" note={`Нийт цагийн ${data.kpi.overtimeShare}%`} />
            <StatCard tone="violet" icon={<Banknote size={19} />} value={money(data.kpi.totalCost)} label="Нийт зардал (тооцоолсон)" note="Цалин + хоол + бензин" />
          </KpiRow>

          {/* Зардал тус тусдаа */}
          <KpiRow cols={3}>
            <StatCard tone="blue" icon={<Banknote size={19} />} value={money(data.kpi.payroll)} label="Цалин" note={`${data.kpi.regularHours} ц + ${data.kpi.overtimeHours} илүү цаг`} />
            <StatCard tone="amber" icon={<UtensilsCrossed size={19} />} value={money(data.kpi.mealEarned)} label="Хоолны мөнгө" note={`Олгосон ${money(data.kpi.mealGiven)} · урьдчилгаа ${money(data.kpi.mealAdvance || 0)}`} />
            <StatCard tone="green" icon={<Fuel size={19} />} value={money(data.kpi.fuelCost)} label="Бензин" note={`${data.kpi.fuelLiters} литр`} />
          </KpiRow>

          {/* Дүгнэлт ба зөвлөгөө */}
          <Card title="Дүгнэлт ба зөвлөгөө" icon={<Lightbulb size={17} />} actions={<Button icon={<Sparkles size={15} />} disabled={advice.busy} onClick={askAi}>{advice.busy ? 'AI бодож байна…' : 'AI зөвлөгөө авах'}</Button>}>
            {insights(data).length ? (
              <ul className="space-y-2">
                {insights(data).map((i, n) => (
                  <li key={n} className="flex gap-2.5 text-[13px] leading-5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i.tone === 'good' ? 'bg-success' : i.tone === 'bad' ? 'bg-danger' : 'bg-warning'}`} aria-hidden="true" />
                    <span className="text-ink"><span className="sr-only">{i.tone === 'good' ? 'Сайн: ' : i.tone === 'bad' ? 'Анхаар: ' : 'Санамж: '}</span>{i.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">Энэ хугацаанд онцгой анхаарах зүйл илрээгүй.</p>
            )}
            {advice.tried ? (
              <div className="mt-4 rounded-[var(--radius)] border border-line bg-card2 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-brand"><Sparkles size={13} /> AI зөвлөгөө</p>
                {advice.busy ? <Loading text="Бодож байна…" /> : advice.text ? (
                  <div className="whitespace-pre-wrap text-[13px] leading-6 text-ink">{advice.text.replace(/\*\*/g, '')}</div>
                ) : (
                  <p className="text-[13px] text-muted">AI зөвлөгөө одоогоор авах боломжгүй (AI сервер тохируулаагүй эсвэл хариу ирсэнгүй). Дээрх дүгнэлтийг ашиглана уу.</p>
                )}
              </div>
            ) : null}
          </Card>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card title="Өдөр бүрийн ирц" icon={<Users size={17} />}>
              {!data.daily.length ? <EmptyState text="Ирцийн бүртгэл алга." /> : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily} barCategoryGap={2}>
                      <CartesianGrid vertical={false} stroke={c.grid} />
                      <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} {...axis} minTickGap={16} />
                      <YAxis allowDecimals={false} {...axis} width={32} />
                      <Tooltip {...tip} />
                      <Legend wrapperStyle={{ fontSize: 12, color: c.ink }} />
                      <Bar dataKey="onTime" name="Цагтаа" stackId="a" fill={c.ok} stroke="var(--bg-card)" strokeWidth={1} />
                      <Bar dataKey="late" name="Хоцорсон" stackId="a" fill={c.late} radius={[4, 4, 0, 0]} stroke="var(--bg-card)" strokeWidth={1} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Ирж ирсэн цаг (хүн-өдөр)" icon={<Clock size={17} />}>
              {!data.arrivals.length ? <EmptyState text="Мэдээлэл алга." /> : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.arrivals}>
                      <CartesianGrid vertical={false} stroke={c.grid} />
                      <XAxis dataKey="slot" {...axis} />
                      <YAxis allowDecimals={false} {...axis} width={32} />
                      <Tooltip {...tip} formatter={(v: number) => [`${v}`, 'Хүн-өдөр']} />
                      <Bar dataKey="n" name="Ирсэн" fill={c.s1} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-2 text-[12px] text-subtle">Ажил эхлэх цаг: {data.settings.work_start}. Хагас цагаар бүлэглэсэн.</p>
            </Card>

            <Card title="Гараг бүрийн хоцролт (%)" icon={<AlertTriangle size={17} />}>
              <HBarChart data={data.weekday.map((d) => ({ name: d.day, value: d.lateRate }))} unit="%" color={c.late} labelWidth={70} />
            </Card>

            <Card title="Хэлтсийн хоцролт (%)" icon={<Users size={17} />}>
              {!data.departments.length ? <EmptyState text="Мэдээлэл алга." /> : <HBarChart data={data.departments.map((d) => ({ name: d.name, value: d.lateRate }))} unit="%" color={c.late} />}
            </Card>

            <Card title="Сарын зардал (тооцоолсон)" icon={<Banknote size={17} />} className="xl:col-span-2">
              {!data.monthly.length ? <EmptyState text="Зардлын мэдээлэл алга." /> : (
                <>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.monthly}>
                        <CartesianGrid vertical={false} stroke={c.grid} />
                        <XAxis dataKey="month" {...axis} />
                        <YAxis tickFormatter={short} {...axis} width={48} />
                        <Tooltip {...tip} formatter={(v: number, n: string) => [money(v), n]} />
                        <Legend wrapperStyle={{ fontSize: 12, color: c.ink }} />
                        <Bar dataKey="payroll" name="Цалин" stackId="c" fill={c.s1} stroke="var(--bg-card)" strokeWidth={1} />
                        <Bar dataKey="meal" name="Хоолны мөнгө" stackId="c" fill={c.s2} stroke="var(--bg-card)" strokeWidth={1} />
                        <Bar dataKey="fuel" name="Бензин" stackId="c" fill={c.s3} radius={[4, 4, 0, 0]} stroke="var(--bg-card)" strokeWidth={1} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Хүснэгт — өнгөнөөс гадна тоогоор унших боломж (dataviz relief) */}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-[12px] tabular-nums">
                      <thead className="text-left text-muted"><tr><th className="py-1.5">Сар</th><th className="py-1.5 text-right">Цалин</th><th className="py-1.5 text-right">Хоолны мөнгө</th><th className="py-1.5 text-right">Бензин</th><th className="py-1.5 text-right">Илүү цаг</th></tr></thead>
                      <tbody className="divide-y divide-line">
                        {data.monthly.map((m) => (
                          <tr key={m.month}><td className="py-1.5 text-ink">{m.month}</td><td className="py-1.5 text-right text-ink">{money(m.payroll)}</td><td className="py-1.5 text-right text-ink">{money(m.meal)}</td><td className="py-1.5 text-right text-ink">{money(m.fuel)}</td><td className="py-1.5 text-right text-muted">{m.overtime} ц</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>

            <Card title="Хоолны мөнгө — хэн хэдэн удаа авсан" icon={<UtensilsCrossed size={17} />} className="xl:col-span-2" bodyClassName="p-0">
              {!data.meals?.length ? <EmptyState text="Энэ хугацаанд хоолны мөнгө олгоогүй." /> : (
                <div className="overflow-x-auto">
                  <table className="app-table w-full min-w-[720px] text-[13px]">
                    <thead className="text-left">
                      <tr>
                        <th className="px-4 py-2">Ажилтан</th>
                        <th className="px-3 py-2 text-right">Урьдчилж авсан</th>
                        <th className="px-3 py-2 text-right">Одоо авсан</th>
                        <th className="px-3 py-2 text-right">Нөхөж авсан</th>
                        <th className="px-3 py-2 text-right">Нийт</th>
                        <th className="px-3 py-2 text-right">Сүүлд</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.meals.map((m) => (
                        <tr key={m.name + m.department}>
                          <td className="px-4 py-2"><span className="block font-medium text-ink">{m.name}</span><span className="block text-[11px] text-subtle">{m.department}</span></td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {m.advance ? <><span className="font-semibold text-warning">{m.advance} удаа</span><span className="block text-[11px] text-subtle">{money(m.advanceSum)}</span></> : <span className="text-subtle">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{m.now ? <><span className="text-ink">{m.now} удаа</span><span className="block text-[11px] text-subtle">{money(m.nowSum)}</span></> : <span className="text-subtle">—</span>}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{m.catchup ? <><span className="text-ink">{m.catchup} удаа</span><span className="block text-[11px] text-subtle">{money(m.catchupSum)}</span></> : <span className="text-subtle">—</span>}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{money(m.total)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted">{m.last}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Бензин — машин бүрээр" icon={<Fuel size={17} />}>
              {!data.fuel.length ? <EmptyState text="Энэ хугацаанд бензин цэнэглээгүй." /> : <HBarChart data={data.fuel.slice(0, 8).map((f) => ({ name: f.plate, value: f.cost }))} unit="₮" color={c.s3} labelWidth={90} />}
              <p className="mt-2 text-[12px] text-subtle">Нийт {money(data.kpi.fuelCost)} · {data.kpi.fuelLiters} л</p>
            </Card>

            <Card title="Хамгийн олон хоцорсон" icon={<AlertTriangle size={17} />}>
              {!data.lateTop.length ? <EmptyState text="Хоцорсон ажилтан алга." /> : (
                <table className="w-full text-[13px]">
                  <thead className="text-left text-[12px] text-muted"><tr><th className="py-1.5">Ажилтан</th><th className="py-1.5 text-right">Хоцорсон</th><th className="py-1.5 text-right">Дундаж</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {data.lateTop.map((p) => (
                      <tr key={p.name}>
                        <td className="py-1.5"><span className="block font-medium text-ink">{p.name}</span><span className="block text-[11px] text-subtle">{p.department}</span></td>
                        <td className="py-1.5 text-right tabular-nums text-ink">{p.late} / {p.days} өдөр</td>
                        <td className="py-1.5 text-right tabular-nums text-muted">{p.avgLateMin} мин</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <p className="text-[11px] text-subtle">Цалин нь ажилласан цаг × тухайн өдрийн тарифаар тооцоолсон (суутгал, шагналгүй). Хоолны мөнгө — ажилласан өдрийн хуримтлал. Бензин — бүртгэгдсэн цэнэглэлт.</p>
        </>
      )}
    </div>
  );
}
