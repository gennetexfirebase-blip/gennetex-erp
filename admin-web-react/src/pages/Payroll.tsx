import { useMemo, useState } from 'react';
import { Banknote, Check, Clock, UtensilsCrossed, ChevronLeft, ChevronRight, Download, Pencil, Search, Wallet, X } from 'lucide-react';
import { PageHeader, Card, Input, Select, Button, Avatar, Loading, ErrorState, EmptyState, StatCard, KpiRow } from '../components/ui';
import { useAsync } from '../lib/data';
import { supabase } from '../lib/supabase';
import { downloadSheets } from '../lib/attendanceExport';

/**
 * sanhuu.gennetex.com — ирцээс цалин.
 *
 * Админ ажилтан бүрийн өдрийн цалин, өдрийн ажлын цаг, хоолны мөнгийг
 * оруулна. Ажилласан цагийг сервер ирцээс автоматаар бичнэ (ирцийн цэг дээр
 * «Ирлээ» дармагц эхэлж, «Явлаа» дарахад эцэслэнэ). Цэгээс гадуурх
 * ирэлтийг админ зөвшөөрвөл л тооцогдоно.
 */

type Rate = { daily_rate: number; standard_hours: number; meal_allowance: number; overtime_multiplier: number; effective_from: string };
type Emp = { id: string; name: string; position: string | null; department: string | null; avatar_url: string | null; rate: Rate | null };
type Entry = {
  e: string; d: string; h: number; ot: number; src: string; in: string | null; out: string | null; open: boolean; note: string | null;
  rate: number | null; std: number | null; meal: number | null; mult: number | null;
};
type Pending = { id: string; e: string; name: string; at: string; distance: number | null; note: string | null };
type Payload = { employees: Emp[]; entries: Entry[]; pending: Pending[] };

type Row = Emp & { days: number; hours: number; ot: number; regular: number; overtime: number; meal: number; total: number; open: boolean };

const pad = (n: number) => String(n).padStart(2, '0');
const money = (n: number) => `${new Intl.NumberFormat('mn-MN').format(Math.round(n || 0))}₮`;
const hrs = (n: number) => (Math.round(n * 10) / 10).toLocaleString('mn-MN');
const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

async function fetchPayroll(from: string, to: string): Promise<Payload> {
  const { data, error } = await supabase.rpc('sanhuu_payroll', { p_from: from, p_to: to });
  if (error) throw new Error(/forbidden/.test(error.message) ? 'Цалин харах эрх зөвхөн админд.' : error.message);
  return data as Payload;
}

export default function PayrollPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const from = `${ym.y}-${pad(ym.m + 1)}-01`;
  const to = `${ym.y}-${pad(ym.m + 1)}-${pad(new Date(ym.y, ym.m + 1, 0).getDate())}`;
  const { data, loading, error, reload } = useAsync<Payload | null>(() => fetchPayroll(from, to), [from, to], null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [edit, setEdit] = useState<Emp | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const by = new Map<string, Entry[]>();
    data.entries.forEach((x) => (by.get(x.e) || by.set(x.e, []).get(x.e)!).push(x));
    return data.employees.map((emp) => {
      const list = by.get(emp.id) || [];
      let hours = 0, ot = 0, regular = 0, overtime = 0, meal = 0, days = 0, open = false;
      list.forEach((x) => {
        const std = Number(x.std) || 8;
        const rate = Number(x.rate) || 0;
        hours += Number(x.h);
        ot += Number(x.ot);
        regular += (Number(x.h) / std) * rate;
        overtime += Number(x.ot) * (rate / std) * (Number(x.mult) || 1.5);
        if (Number(x.h) > 0) {
          days++;
          meal += Number(x.meal) || 0;
        }
        if (x.open) open = true;
      });
      return { ...emp, days, hours, ot, regular, overtime, meal, total: regular + overtime + meal, open };
    });
  }, [data]);

  const depts = useMemo(() => [...new Set(rows.map((r) => r.department || 'Хэлтэсгүй'))].sort((a, b) => a.localeCompare(b, 'mn')), [rows]);
  const needle = q.trim().toLowerCase();
  const visible = rows.filter((r) => (!dept || (r.department || 'Хэлтэсгүй') === dept) && r.name.toLowerCase().includes(needle));
  const sum = (k: 'regular' | 'overtime' | 'meal' | 'total' | 'hours') => visible.reduce((a, r) => a + r[k], 0);

  const step = (d: number) => setYm(({ y, m }) => {
    const x = new Date(y, m + d, 1);
    return { y: x.getFullYear(), m: x.getMonth() };
  });

  const exportExcel = () => {
    const sheet: (string | number)[][] = [['Ажилтан', 'Хэлтэс', 'Өдрийн цалин', 'Өдрийн цаг', 'Хоолны мөнгө/өдөр', 'Ажилласан өдөр', 'Ажилласан цаг', 'Илүү цаг', 'Үндсэн цалин', 'Илүү цагийн цалин', 'Хоолны мөнгө', 'Нийт']];
    visible.forEach((r) => sheet.push([r.name, r.department || '', r.rate?.daily_rate ?? 0, r.rate?.standard_hours ?? 8, r.rate?.meal_allowance ?? 0, r.days, Math.round(r.hours * 100) / 100, Math.round(r.ot * 100) / 100, Math.round(r.regular), Math.round(r.overtime), Math.round(r.meal), Math.round(r.total)]));
    const daysSheet: (string | number)[][] = [['Ажилтан', 'Огноо', 'Ирсэн', 'Явсан', 'Цаг', 'Илүү цаг', 'Эх сурвалж', 'Тэмдэглэл']];
    const names = new Map(rows.map((r) => [r.id, r.name]));
    (data?.entries || []).forEach((x) => daysSheet.push([names.get(x.e) || '', x.d, x.in ? fmt(x.in) : '', x.out ? fmt(x.out) : '', Number(x.h), Number(x.ot), x.src === 'attendance' ? 'Ирц' : 'Гараар', x.note || '']));
    void downloadSheets(`gennetex_tsalin_${ym.y}${pad(ym.m + 1)}.xlsx`, [{ name: 'Цалин', rows: sheet }, { name: 'Өдрөөр', rows: daysSheet }]);
  };

  return (
    <>
      <PageHeader
        title="Цалин"
        crumb="Санхүү"
        description="Ажилтан ирцийн цэг дээр «Ирлээ» дармагц цалин тоологдож эхэлнэ, «Явлаа» дарахад ажилласан цагаар тооцно. Өдрийн ажлын цагаас хэтэрсэн хугацааг тооцохгүй."
        actions={
          <>
            <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-line bg-card px-1">
              <button onClick={() => step(-1)} className="focus-ring rounded p-1.5 text-muted hover:text-ink" aria-label="Өмнөх сар"><ChevronLeft size={16} /></button>
              <span className="min-w-[96px] text-center text-[13px] font-semibold text-ink">{ym.y}.{pad(ym.m + 1)}</span>
              <button onClick={() => step(1)} className="focus-ring rounded p-1.5 text-muted hover:text-ink" aria-label="Дараа сар"><ChevronRight size={16} /></button>
            </div>
            <Button icon={<Download size={15} />} disabled={!visible.length} onClick={exportExcel}>Excel</Button>
          </>
        }
      />

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState text={error} onRetry={reload} />
      ) : (
        <>
          <KpiRow>
            <StatCard tone="green" icon={<Wallet size={19} />} value={money(sum('total'))} label="Нийт цалин" />
            <StatCard tone="blue" icon={<Banknote size={19} />} value={money(sum('regular'))} label="Үндсэн" />
            <StatCard tone="amber" icon={<UtensilsCrossed size={19} />} value={money(sum('meal'))} label="Хоолны мөнгө" />
            <StatCard tone="violet" icon={<Clock size={19} />} value={`${hrs(sum('hours'))} ц`} label="Ажилласан цаг" />
          </KpiRow>

          {data?.pending.length ? <PendingPanel list={data.pending} onDone={reload} /> : null}

          <Card
            title={`Ажилтнууд (${visible.length})`}
            icon={<Wallet size={17} />}
            bodyClassName="p-0"
            actions={
              <>
                {depts.length > 1 ? (
                  <Select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Хэлтэс">
                    <option value="">Бүх хэлтэс</option>
                    {depts.map((d) => <option key={d}>{d}</option>)}
                  </Select>
                ) : null}
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
                  <Input placeholder="Нэрээр хайх" value={q} onChange={(e) => setQ(e.target.value)} className="w-44 pl-8" />
                </div>
              </>
            }
          >
            {!visible.length ? (
              <EmptyState text="Ажилтан олдсонгүй." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-[13px]">
                  <thead className="bg-card2 text-left text-[12px] text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Ажилтан</th>
                      <th className="px-3 py-2 font-medium">Өдрийн цалин</th>
                      <th className="px-3 py-2 font-medium">Өдрийн цаг</th>
                      <th className="px-3 py-2 font-medium">Хоол/өдөр</th>
                      <th className="px-3 py-2 text-right font-medium">Өдөр</th>
                      <th className="px-3 py-2 text-right font-medium">Цаг</th>
                      <th className="px-3 py-2 text-right font-medium">Үндсэн</th>
                      <th className="px-3 py-2 text-right font-medium">Илүү цаг</th>
                      <th className="px-3 py-2 text-right font-medium">Хоол</th>
                      <th className="px-3 py-2 text-right font-medium">Нийт</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visible.map((r) => (
                      <tr key={r.id} className="hover:bg-hover">
                        <td className="px-4 py-2">
                          <button type="button" onClick={() => setDetail(r.id)} className="flex items-center gap-2.5 text-left">
                            <Avatar name={r.name} src={r.avatar_url} size={28} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-ink">
                                {r.name || 'Ажилтан'}
                                {r.open ? <span className="ml-1.5 rounded-full bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white">ажил дээр</span> : null}
                              </span>
                              <span className="block truncate text-[12px] text-muted">{r.department || 'Хэлтэсгүй'}</span>
                            </span>
                          </button>
                        </td>
                        {r.rate ? (
                          <>
                            <td className="px-3 py-2 text-ink">{money(r.rate.daily_rate)}</td>
                            <td className="px-3 py-2 text-ink">{hrs(r.rate.standard_hours)} ц</td>
                            <td className="px-3 py-2 text-ink">{money(r.rate.meal_allowance)}</td>
                          </>
                        ) : (
                          <td colSpan={3} className="px-3 py-2 text-[12px] text-warning">Цалин оруулаагүй</td>
                        )}
                        <td className="px-3 py-2 text-right text-ink">{r.days}</td>
                        <td className="px-3 py-2 text-right text-ink">{hrs(r.hours)}</td>
                        <td className="px-3 py-2 text-right text-ink">{money(r.regular)}</td>
                        <td className="px-3 py-2 text-right text-ink">{r.overtime ? money(r.overtime) : '—'}</td>
                        <td className="px-3 py-2 text-right text-ink">{r.meal ? money(r.meal) : '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-ink">{money(r.total)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" className="!min-h-8 !px-2" aria-label="Цалин засах" title="Цалин засах" onClick={() => setEdit(r)}>
                            <Pencil size={15} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {edit ? <RateDialog emp={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} /> : null}
      {detail && data ? (
        <DayDialog name={rows.find((r) => r.id === detail)?.name || ''} entries={data.entries.filter((x) => x.e === detail)} onClose={() => setDetail(null)} />
      ) : null}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius)] border border-line bg-card shadow-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="focus-ring rounded p-1.5 text-muted hover:text-ink" aria-label="Хаах"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function RateDialog({ emp, onClose, onSaved }: { emp: Emp; onClose: () => void; onSaved: () => void }) {
  const [daily, setDaily] = useState(String(emp.rate?.daily_rate ?? ''));
  const [hours, setHours] = useState(String(emp.rate?.standard_hours ?? 8));
  const [meal, setMeal] = useState(String(emp.rate?.meal_allowance ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hourly = Number(daily) / (Number(hours) || 1);

  const save = async () => {
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('sanhuu_set_rate', { p_user: emp.id, p_daily: Number(daily), p_hours: Number(hours), p_meal: Number(meal) || 0 });
    setBusy(false);
    if (error) return setErr(/invalid_rate/.test(error.message) ? 'Утгаа шалгана уу: цалин ≥ 0, цаг 0–24.' : error.message);
    onSaved();
  };

  return (
    <Modal title={`${emp.name} — цалин`} onClose={onClose}>
      <div className="space-y-3">
        <label className="block space-y-1 text-[13px] text-ink">
          <span>Өдрийн цалин (₮)</span>
          <Input type="number" min={0} step={1000} value={daily} onChange={(e) => setDaily(e.target.value)} autoFocus />
        </label>
        <label className="block space-y-1 text-[13px] text-ink">
          <span>Өдрийн нийт ажлын цаг</span>
          <Input type="number" min={1} max={24} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="block space-y-1 text-[13px] text-ink">
          <span>Хоолны мөнгө (₮ / ажилласан өдөр)</span>
          <Input type="number" min={0} step={500} value={meal} onChange={(e) => setMeal(e.target.value)} />
        </label>
        <p className="text-[12px] text-muted">
          Цагийн хөлс {Number.isFinite(hourly) ? money(hourly) : '—'}. Өнөөдрөөс эхлэн хүчинтэй; өмнөх өдрүүд хуучин ханшаараа үлдэнэ.
        </p>
        {err ? <p className="text-[13px] text-danger" role="alert">{err}</p> : null}
        <div className="flex gap-2">
          <Button disabled={busy || daily === ''} onClick={save}>{busy ? 'Хадгалж байна…' : 'Хадгалах'}</Button>
          <Button variant="outline" onClick={onClose}>Болих</Button>
        </div>
      </div>
    </Modal>
  );
}

function DayDialog({ name, entries, onClose }: { name: string; entries: Entry[]; onClose: () => void }) {
  const list = [...entries].sort((a, b) => b.d.localeCompare(a.d));
  return (
    <Modal title={`${name} — өдөр бүрээр`} onClose={onClose}>
      {!list.length ? (
        <EmptyState text="Энэ сард ажилласан бүртгэл алга." />
      ) : (
        <table className="w-full text-[13px]">
          <thead className="text-left text-[12px] text-muted">
            <tr><th className="py-1.5 font-medium">Огноо</th><th className="py-1.5 font-medium">Ирсэн–Явсан</th><th className="py-1.5 text-right font-medium">Цаг</th><th className="py-1.5 text-right font-medium">Цалин</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((x) => {
              const std = Number(x.std) || 8;
              const pay = (Number(x.h) / std) * (Number(x.rate) || 0) + Number(x.ot) * ((Number(x.rate) || 0) / std) * (Number(x.mult) || 1.5) + (Number(x.h) > 0 ? Number(x.meal) || 0 : 0);
              const t = (iso: string | null) => (iso ? `${pad(new Date(iso).getHours())}:${pad(new Date(iso).getMinutes())}` : '—');
              return (
                <tr key={x.d}>
                  <td className="py-1.5 text-ink">{x.d.slice(5)}</td>
                  <td className="py-1.5 text-muted">
                    {x.src === 'attendance' ? `${t(x.in)}–${x.open ? 'ажил дээр' : t(x.out)}` : 'Гараар'}
                    {x.note && x.src !== 'attendance' ? ` · ${x.note}` : ''}
                  </td>
                  <td className="py-1.5 text-right text-ink">{hrs(Number(x.h))}{Number(x.ot) ? ` +${hrs(Number(x.ot))}` : ''}</td>
                  <td className="py-1.5 text-right text-ink">{money(pay)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/** Ирцийн цэгээс гадуур бүртгүүлсэн — зөвшөөрвөл л цалин бодогдоно. */
function PendingPanel({ list, onDone }: { list: Pending[]; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    setErr('');
    const { error } = await supabase.rpc('sanhuu_review_checkin', { p_id: id, p_approve: approve });
    setBusy(null);
    if (error) setErr(error.message);
    else onDone();
  };
  return (
    <Card className="mb-5" title={`Ирцийн цэгээс гадуур бүртгүүлсэн (${list.length})`}>
      <p className="mb-3 text-[13px] text-muted">Эдгээр өдөр цалин бодогдохгүй байна. Зөвшөөрвөл тухайн өдрийн цаг автоматаар тооцогдоно.</p>
      {err ? <p className="mb-2 text-[13px] text-danger" role="alert">{err}</p> : null}
      <ul className="divide-y divide-line">
        {list.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink">{p.name}</span>
              <span className="block text-[12px] text-muted">
                {fmt(p.at)}{p.distance != null ? ` · цэгээс ${Math.round(p.distance)} м` : ''}{p.note ? ` · ${p.note}` : ''}
              </span>
            </span>
            <Button variant="success" icon={<Check size={14} />} disabled={busy === p.id} onClick={() => review(p.id, true)}>Зөвшөөрөх</Button>
            <Button variant="outline" icon={<X size={14} />} disabled={busy === p.id} onClick={() => review(p.id, false)}>Татгалзах</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
