import { useEffect, useMemo, useState } from 'react';
import { Award, Cable, ChevronLeft, ChevronRight, Link2, RefreshCw, Settings2, Users, Wrench } from 'lucide-react';
import { Avatar, Button, Card, EmptyState, ErrorState, Input, KpiRow, Loading, PageHeader, Select, StatCard } from '../components/ui';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';
import { fetchAliases, fetchPerfSummary, kindLabel, setAlias, setRate, syncSheet, type PerfAlias, type PerfSummary } from '../lib/perf';

/**
 * sanhuu.gennetex.com → Гүйцэтгэл. Google Sheet-ээс ажлуудыг татаж, инженер бүрийн
 * гүйцэтгэл ба цалингийн нэмэгдлийг тооцно (Цалин хуудас = ирцийн цалин + энэ дүн).
 *   1. «Sheet-ээс татах» — perf-sync
 *   2. Үнэлгээ — ажлын төрөл бүрт ₮ (кабель татсан бол нэмэгдэл)
 *   3. Нэр холбох — Sheet дээрх латин нэр → ажилтан
 */

const pad = (n: number) => String(n).padStart(2, '0');
const money = (n: number) => `${new Intl.NumberFormat('mn-MN').format(Math.round(n || 0))}₮`;
const fullName = (e: Employee) => [e.last_name, e.name].filter(Boolean).join(' ').trim() || e.email || 'Ажилтан';

export default function PerformancePage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const from = `${ym.y}-${pad(ym.m + 1)}-01`;
  const to = `${ym.y}-${pad(ym.m + 1)}-${pad(new Date(ym.y, ym.m + 1, 0).getDate())}`;
  const summary = useAsync<PerfSummary | null>(() => fetchPerfSummary(from, to), [from, to], null);
  const emps = useAsync<Employee[]>(fetchEmployees, [], []);
  const aliases = useAsync<PerfAlias[]>(fetchAliases, [], []);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const reloadAll = () => {
    summary.reload();
    aliases.reload();
  };
  const sync = async () => {
    setSyncing(true);
    setMsg('');
    try {
      const r = await syncSheet();
      setMsg(`Sheet-ээс ${r.rows} ажил татлаа (${r.from || '—'} — ${r.to || '—'}).`);
      reloadAll();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const s = summary.data;
  const people = s?.people || [];
  const totalAmount = people.reduce((a, p) => a + p.amount, 0);
  const totalCredits = people.reduce((a, p) => a + p.jobs, 0);
  const kinds = useMemo(() => (s?.rates || []).filter((r) => r.kind !== 'cable').map((r) => r.kind), [s]);

  return (
    <>
      <PageHeader
        title="Гүйцэтгэл"
        crumb="Санхүү"
        description="Google Sheet-ийн ажил бүрийг инженер тус бүрт (хамт ч бүтэн 1) тоолж, төрлийн үнэлгээгээр гүйцэтгэлийн нэмэгдлийг бодно. «Цалин» хуудсанд ирцийн цалин дээр нэмэгдэнэ."
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

      {summary.loading && !s ? <Loading /> : summary.error ? <ErrorState text={summary.error} onRetry={summary.reload} /> : !s ? null : (
        <>
          <KpiRow>
            <StatCard tone="green" icon={<Wrench size={19} />} value={s.jobs} label="Ажил (Sheet)" note={`${from} — ${to}`} />
            <StatCard tone="blue" icon={<Users size={19} />} value={people.length} label="Инженер" note={`${totalCredits} ажил-хүн`} />
            <StatCard tone="violet" icon={<Award size={19} />} value={money(totalAmount)} label="Гүйцэтгэлийн нэмэгдэл" note="Цалин дээр нэмэгдэнэ" />
            <StatCard tone="amber" icon={<Link2 size={19} />} value={s.unmapped.length} label="Холбогдоогүй нэр" note={s.last_sync_at ? `Сүүлд татсан ${new Date(s.last_sync_at).toLocaleString('mn-MN')}` : 'Хараахан татаагүй'} />
          </KpiRow>

          {s.unmapped.length ? (
            <p className="mb-5 rounded-[var(--radius)] border border-warning/30 bg-warning-soft px-4 py-3 text-[13px] text-warning">
              {s.unmapped.length} нэр ажилтантай холбогдоогүй тул тэдний ажил цалинд орохгүй байна — доорх «Нэр холбох» хэсгээс холбоно уу.
            </p>
          ) : null}

          <Card title={`Инженер бүрээр (${people.length})`} icon={<Award size={17} />} bodyClassName="p-0" className="mb-5">
            {!people.length ? <EmptyState text="Энэ сард холбогдсон инженерийн ажил алга. Sheet-ээс татаад, нэрсийг ажилтантай холбоно уу." /> : (
              <div className="overflow-x-auto">
                <table className="app-table w-full min-w-[900px] text-[13px]">
                  <thead className="text-left">
                    <tr>
                      <th className="px-4 py-2">Инженер</th>
                      <th className="px-3 py-2 text-right">Ажил</th>
                      <th className="px-3 py-2 text-right">Өдөр</th>
                      <th className="px-3 py-2 text-right">Ганцаараа / хамт</th>
                      {kinds.map((k) => <th key={k} className="px-3 py-2 text-right">{kindLabel(k)}</th>)}
                      <th className="px-3 py-2 text-right">Кабель</th>
                      <th className="px-3 py-2 text-right">Нэмэгдэл</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {people.map((p) => (
                      <tr key={p.user_id}>
                        <td className="px-4 py-2">
                          <span className="block font-medium text-ink">{p.name}</span>
                          <span className="block text-[11px] text-subtle">{p.department || 'Хэлтэсгүй'} · {(p.aliases || []).join(', ')}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{p.jobs}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{p.days}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{p.solo} / {p.pair}</td>
                        {kinds.map((k) => <td key={k} className="px-3 py-2 text-right tabular-nums text-ink">{p.kinds?.[k] || '—'}</td>)}
                        <td className="px-3 py-2 text-right tabular-nums text-ink">{p.cable || '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <RatesCard rates={s.rates} onSaved={summary.reload} />
            <AliasCard aliases={aliases.data} unmapped={s.unmapped} emps={emps.data} onSaved={reloadAll} />
          </div>
        </>
      )}
    </>
  );
}

function RatesCard({ rates, onSaved }: { rates: PerfSummary['rates']; onSaved: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => setVals(Object.fromEntries(rates.map((r) => [r.kind, String(r.amount)]))), [rates]);
  const dirty = rates.some((r) => Number(vals[r.kind] || 0) !== r.amount);
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      for (const r of rates) if (Number(vals[r.kind] || 0) !== r.amount) await setRate(r.kind, Math.max(0, Number(vals[r.kind]) || 0));
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Ажлын үнэлгээ (₮)" icon={<Settings2 size={17} />} actions={<Button disabled={!dirty || busy} onClick={save}>{busy ? 'Хадгалж байна…' : 'Хадгалах'}</Button>}>
      <div className="space-y-2.5">
        {rates.map((r) => (
          <label key={r.kind} className="flex items-center gap-3 text-[13px]">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink">{r.kind === 'cable' ? <Cable size={14} className="text-subtle" /> : null}{kindLabel(r.kind)}</span>
            <Input type="number" min={0} step={500} value={vals[r.kind] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [r.kind]: e.target.value }))} className="w-36 text-right" />
          </label>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-subtle">Ажил бүрт оролцсон инженер бүр тухайн төрлийн бүтэн үнэлгээг авна. Кабель татсан бол нэмэгдэл дээр нь нэмнэ.</p>
      {err ? <p className="mt-2 text-[13px] text-danger" role="alert">{err}</p> : null}
    </Card>
  );
}

function AliasCard({ aliases, unmapped, emps, onSaved }: { aliases: PerfAlias[]; unmapped: PerfSummary['unmapped']; emps: Employee[]; onSaved: () => void }) {
  const staff = useMemo(() => emps.filter((e) => e.user_id).sort((a, b) => fullName(a).localeCompare(fullName(b), 'mn')), [emps]);
  const jobsOf = new Map(unmapped.map((u) => [u.alias, u.jobs]));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const save = async (alias: string, value: string) => {
    setBusy(alias);
    setErr('');
    try {
      await setAlias(alias, value && value !== '__ignore' ? value : null, value === '__ignore');
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy('');
    }
  };
  // Холбогдоогүйг эхэнд.
  const list = [...aliases].sort((a, b) => Number(!!a.user_id || a.ignored) - Number(!!b.user_id || b.ignored) || a.alias.localeCompare(b.alias));
  return (
    <Card title="Нэр холбох (Sheet → ажилтан)" icon={<Link2 size={17} />}>
      {!list.length ? <EmptyState text="Sheet-ээс татсны дараа нэрс энд гарна." /> : (
        <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {list.map((a) => (
            <li key={a.alias} className="flex items-center gap-2.5 text-[13px]">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {a.user_id ? <Avatar name={fullName(staff.find((e) => e.user_id === a.user_id) || ({} as Employee))} size={22} /> : <span className={`h-2 w-2 shrink-0 rounded-full ${a.ignored ? 'bg-card2' : 'bg-warning'}`} aria-hidden="true" />}
                <span className="truncate font-mono text-ink">{a.alias}</span>
                {jobsOf.get(a.alias) ? <span className="shrink-0 text-[11px] text-subtle">{jobsOf.get(a.alias)} ажил</span> : null}
              </span>
              <Select className="w-52" value={a.ignored ? '__ignore' : a.user_id || ''} disabled={busy === a.alias} onChange={(e) => save(a.alias, e.target.value)} aria-label={`${a.alias} — ажилтан`}>
                <option value="">— Холбоогүй —</option>
                {staff.map((e) => <option key={e.user_id!} value={e.user_id!}>{fullName(e)}</option>)}
                <option value="__ignore">Тоолохгүй (ажилтан биш)</option>
              </Select>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-subtle">Нэг хүний хэд хэдэн бичлэгийг (lkhavgadash, lhavgadash) нэг ажилтанд холбоно.</p>
      {err ? <p className="mt-2 text-[13px] text-danger" role="alert">{err}</p> : null}
    </Card>
  );
}
