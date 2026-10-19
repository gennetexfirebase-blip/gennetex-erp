import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, Cable, ChevronLeft, ChevronRight, Clock, Lightbulb, RefreshCw, Users, Wrench } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, KpiRow, Loading, PageHeader, StatCard } from '../components/ui';
import { DonutChart, HBarChart } from '../components/charts';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';
import { fetchAliases, fetchPerfJobs, kindLabel, syncSheet, type PerfAlias, type PerfJob } from '../lib/perf';
import { useTheme } from '../lib/theme';

/**
 * guitsetgel.gennetex.com — Google Sheet-ийн ажлаар инженер, багийн гүйцэтгэлийн шинжилгээ.
 * Хамт ч, ганцаараа ч хийсэн ажил оролцсон инженер бүрт бүтэн 1 ажил; баг (хос) бүрээр тусдаа.
 */

const pad = (n: number) => String(n).padStart(2, '0');
// dataviz reference палитр — эхний 4 слот (ажлын төрөл), горим бүрт.
const PAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500'],
};

export default function GuitsetgelPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const from = `${ym.y}-${pad(ym.m + 1)}-01`;
  const to = `${ym.y}-${pad(ym.m + 1)}-${pad(new Date(ym.y, ym.m + 1, 0).getDate())}`;
  const jobs = useAsync<PerfJob[]>(() => fetchPerfJobs(from, to), [from, to], []);
  const aliases = useAsync<PerfAlias[]>(fetchAliases, [], []);
  const emps = useAsync<Employee[]>(fetchEmployees, [], []);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');
  const { theme } = useTheme();
  const pal = PAL[theme];

  // Латин нэр → ажилтны нэр (холбогдоогүй бол Sheet дээрх нэр).
  const nameOf = useMemo(() => {
    const byUser = new Map(emps.data.filter((e) => e.user_id).map((e) => [e.user_id!, [e.last_name, e.name].filter(Boolean).join(' ').trim()]));
    const map = new Map(aliases.data.map((a) => [a.alias, a.ignored ? null : (a.user_id && byUser.get(a.user_id)) || null]));
    const ignored = new Set(aliases.data.filter((a) => a.ignored).map((a) => a.alias));
    return (raw: string) => {
      const k = raw.replace(/\s+/g, ' ').trim().toLowerCase();
      if (ignored.has(k)) return null;
      return map.get(k) || raw.trim();
    };
  }, [aliases.data, emps.data]);

  const a = useMemo(() => {
    const kinds = [...new Set(jobs.data.map((j) => j.kind))].sort((x, y) => jobs.data.filter((j) => j.kind === y).length - jobs.data.filter((j) => j.kind === x).length);
    const top4 = kinds.slice(0, 4);
    const kindKey = (k: string) => (top4.includes(k) ? k : 'other');
    const daily = new Map<string, Record<string, number>>();
    const people = new Map<string, { jobs: number; days: Set<string>; cable: number; solo: number }>();
    const teams = new Map<string, { jobs: number; days: Set<string>; size: number }>();
    const hours = new Map<number, number>();
    let cable = 0;
    let solo = 0;
    for (const j of jobs.data) {
      const d = daily.get(j.work_date) || {};
      d[kindKey(j.kind)] = (d[kindKey(j.kind)] || 0) + 1;
      daily.set(j.work_date, d);
      const crew = [...new Set(j.engineers.map(nameOf).filter((n): n is string => !!n))];
      if (j.cable) cable++;
      if (crew.length === 1) solo++;
      for (const n of crew) {
        const p = people.get(n) || { jobs: 0, days: new Set<string>(), cable: 0, solo: 0 };
        p.jobs++;
        p.days.add(j.work_date);
        if (j.cable) p.cable++;
        if (crew.length === 1) p.solo++;
        people.set(n, p);
      }
      if (crew.length) {
        const key = [...crew].sort((x, y) => x.localeCompare(y, 'mn')).join(' + ');
        const t = teams.get(key) || { jobs: 0, days: new Set<string>(), size: crew.length };
        t.jobs++;
        t.days.add(j.work_date);
        teams.set(key, t);
      }
      const h = Number((j.job_time || '').split(':')[0]);
      if (Number.isFinite(h) && h >= 0 && h < 24) hours.set(h, (hours.get(h) || 0) + 1);
    }
    const peopleList = [...people.entries()].map(([name, p]) => ({ name, jobs: p.jobs, days: p.days.size, perDay: p.days.size ? p.jobs / p.days.size : 0, cable: p.cable, solo: p.solo })).sort((x, y) => y.jobs - x.jobs);
    const teamList = [...teams.entries()].map(([name, t]) => ({ name, jobs: t.jobs, days: t.days.size, perDay: t.days.size ? t.jobs / t.days.size : 0, size: t.size })).sort((x, y) => y.perDay - x.perDay);
    const workDays = daily.size;
    return {
      kinds,
      series: [...top4, ...(kinds.length > 4 ? ['other'] : [])],
      daily: [...daily.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, d]) => ({ date, ...d })),
      people: peopleList,
      teams: teamList,
      hours: [...hours.entries()].sort(([x], [y]) => x - y).map(([h, n]) => ({ hour: `${pad(h)}:00`, n })),
      total: jobs.data.length,
      cableRate: jobs.data.length ? Math.round((cable / jobs.data.length) * 100) : 0,
      soloRate: jobs.data.length ? Math.round((solo / jobs.data.length) * 100) : 0,
      perTeamDay: teamList.length ? teamList.reduce((s, t) => s + t.jobs, 0) / Math.max(1, teamList.reduce((s, t) => s + t.days, 0)) : 0,
      workDays,
      kindCounts: kinds.map((k) => ({ kind: k, n: jobs.data.filter((j) => j.kind === k).length })),
    };
  }, [jobs.data, nameOf]);

  const insights = useMemo(() => {
    const out: string[] = [];
    if (!a.total) return out;
    const best = a.teams.filter((t) => t.days >= 3)[0];
    const worst = [...a.teams].filter((t) => t.days >= 3).sort((x, y) => x.perDay - y.perDay)[0];
    if (best) out.push(`Хамгийн бүтээмжтэй баг: ${best.name} — өдөрт дунджаар ${best.perDay.toFixed(1)} ажил (${best.days} өдөр).`);
    if (worst && best && worst.name !== best.name) out.push(`Хамгийн бага: ${worst.name} — өдөрт ${worst.perDay.toFixed(1)} ажил. Маршрут, ачааллын хуваарилалтыг шалга.`);
    const complain = a.kindCounts.find((k) => k.kind === 'complain');
    if (complain && complain.n / a.total >= 0.5) out.push(`Ажлын ${Math.round((complain.n / a.total) * 100)}% нь гомдол — давтагдсан гомдлын шалтгааныг (суурилуулалтын чанар, тоног төхөөрөмж) судалж, шинэ суурилуулалтын шалгах хуудсыг чангатга.`);
    if (a.soloRate <= 20) out.push(`Ажлын ${100 - a.soloRate}% нь хосоороо хийгдсэн. Энгийн гомдлыг ганцаараа явуулбал багийн тоо нэмэгдэж, өдрийн ажил өснө.`);
    out.push(`Кабель татсан ажил ${a.cableRate}%. Кабелийн зарцуулалтыг агуулахын олголттой тулгаж хяна.`);
    const lowPeople = a.people.filter((p) => p.days >= 3 && p.perDay < a.perTeamDay * 0.7);
    if (lowPeople.length) out.push(`Дунджаас 30%-иар бага: ${lowPeople.slice(0, 4).map((p) => p.name).join(', ')}. Сургалт, хамтрагчийг өөрчлөх эсэхийг шийд.`);
    return out;
  }, [a]);

  const sync = async () => {
    setSyncing(true);
    setMsg('');
    try {
      const r = await syncSheet();
      setMsg(`Sheet-ээс ${r.rows} ажил татлаа.`);
      jobs.reload();
      aliases.reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const ink = theme === 'dark' ? '#a9aeac' : '#45534d';
  const grid = theme === 'dark' ? '#2a2d2b' : '#e3e9e6';
  const axis = { stroke: ink, fontSize: 11, tickLine: false, axisLine: false };
  const tip = { contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }, cursor: { fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' } };
  const colorOf = (k: string, i: number) => (k === 'other' ? (theme === 'dark' ? '#6b6f6d' : '#9aa09c') : pal[i]);

  return (
    <>
      <PageHeader
        title="Гүйцэтгэл"
        description="Google Sheet-ийн ажил бүрээр инженер, багийн гүйцэтгэл. Хамт ч, ганцаараа ч хийсэн ажил оролцсон хүн бүрт бүтэн 1 ажил."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="outline" className="!px-2.5" aria-label="Өмнөх сар" onClick={() => setYm(({ y, m }) => (m ? { y, m: m - 1 } : { y: y - 1, m: 11 }))}><ChevronLeft size={16} /></Button>
              <span className="min-w-[96px] text-center text-[13px] font-semibold tabular-nums text-ink">{ym.y}-{pad(ym.m + 1)}</span>
              <Button variant="outline" className="!px-2.5" aria-label="Дараагийн сар" onClick={() => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}><ChevronRight size={16} /></Button>
            </div>
            <Button icon={<RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />} disabled={syncing} onClick={sync}>{syncing ? 'Татаж байна…' : 'Sheet-ээс татах'}</Button>
          </>
        }
      />
      {msg ? <p className="mb-4 rounded-[var(--radius)] bg-card2 px-4 py-2.5 text-[13px] text-ink" role="status">{msg}</p> : null}

      {jobs.loading && !jobs.data.length ? <Loading /> : jobs.error ? <ErrorState text={jobs.error} onRetry={jobs.reload} /> : !a.total ? (
        <EmptyState text="Энэ сард ажил алга. «Sheet-ээс татах» товчоор Google Sheet-ийг татна уу." />
      ) : (
        <>
          <KpiRow>
            <StatCard tone="green" icon={<Wrench size={19} />} value={a.total} label="Нийт ажил" note={`${a.workDays} ажлын өдөр`} />
            <StatCard tone="blue" icon={<Users size={19} />} value={a.teams.length} label="Баг (бүрэлдэхүүн)" note={`${a.people.length} инженер`} />
            <StatCard tone="violet" icon={<Award size={19} />} value={a.perTeamDay.toFixed(1)} label="1 баг өдөрт" note="дундаж ажил" />
            <StatCard tone="amber" icon={<Cable size={19} />} value={`${a.cableRate}%`} label="Кабель татсан" note={`Ганцаараа ${a.soloRate}%`} />
          </KpiRow>

          <Card title="Дүгнэлт ба зөвлөгөө" icon={<Lightbulb size={17} />} className="mb-5">
            <ul className="space-y-2">
              {insights.map((t, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-5 text-ink"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />{t}</li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card title="Өдөр бүрийн ажил — төрлөөр" icon={<Wrench size={17} />} className="xl:col-span-2">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.daily}>
                    <CartesianGrid vertical={false} stroke={grid} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} {...axis} minTickGap={12} />
                    <YAxis allowDecimals={false} {...axis} width={32} />
                    <Tooltip {...tip} formatter={(v: number, n: string) => [v, n]} />
                    <Legend wrapperStyle={{ fontSize: 12, color: ink }} />
                    {a.series.map((k, i) => (
                      <Bar key={k} dataKey={k} name={k === 'other' ? 'Бусад' : kindLabel(k)} stackId="k" fill={colorOf(k, i)} stroke="var(--bg-card)" strokeWidth={1} radius={i === a.series.length - 1 ? [4, 4, 0, 0] : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Ажлын төрөл" icon={<Wrench size={17} />}>
              <DonutChart center={a.total} sub="ажил" slices={a.kindCounts.slice(0, 4).map((k, i) => ({ key: k.kind, name: kindLabel(k.kind), value: k.n, color: pal[i] })).concat(a.kindCounts.length > 4 ? [{ key: 'other', name: 'Бусад', value: a.kindCounts.slice(4).reduce((s, k) => s + k.n, 0), color: colorOf('other', 0) }] : [])} />
            </Card>

            <Card title="Инженер бүрийн ажил" icon={<Users size={17} />} className="xl:col-span-2">
              <HBarChart data={a.people.map((p) => ({ name: p.name, value: p.jobs }))} unit="ажил" color={pal[0]} labelWidth={150} />
            </Card>

            <Card title="Ажлын цаг (өдрийн аль цагт)" icon={<Clock size={17} />}>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.hours}>
                    <CartesianGrid vertical={false} stroke={grid} />
                    <XAxis dataKey="hour" {...axis} minTickGap={8} />
                    <YAxis allowDecimals={false} {...axis} width={28} />
                    <Tooltip {...tip} formatter={(v: number) => [v, 'Ажил']} />
                    <Bar dataKey="n" name="Ажил" fill={pal[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Баг бүрийн бүтээмж" icon={<Award size={17} />} className="xl:col-span-3" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="app-table w-full min-w-[640px] text-[13px]">
                  <thead className="text-left">
                    <tr><th className="px-4 py-2">Баг</th><th className="px-3 py-2 text-right">Хүн</th><th className="px-3 py-2 text-right">Ажил</th><th className="px-3 py-2 text-right">Өдөр</th><th className="px-3 py-2 text-right">Өдөрт</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {a.teams.map((t) => (
                      <tr key={t.name}>
                        <td className="px-4 py-2 font-medium text-ink">{t.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{t.size}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink">{t.jobs}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{t.days}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{t.perDay.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <p className="mt-4 text-[11px] text-subtle">Нэрс «Санхүү → Гүйцэтгэл → Нэр холбох»-оор ажилтантай холбогдсон бол ажилтны нэрээр, үгүй бол Sheet дээрх нэрээр харагдана.</p>
        </>
      )}
    </>
  );
}
