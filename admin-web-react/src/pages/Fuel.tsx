import { useMemo, useState } from 'react';
import { CalendarClock, Fuel, Gauge, Plus, RefreshCw, Route, Zap } from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, Modal, Field, Loading, ErrorState, EmptyState, StatCard, KpiRow, ToneIcon, type ToneName } from '../components/ui';
import { useAsync } from '../lib/data';
import { fetchFleet, fuelStats, litersLast7, refuelByAmount, type FuelRow } from '../lib/fleet';

/**
 * sanhuu.gennetex.com — Бензин зарцуулалт ба цэнэглэлт.
 *   Одоо цэнэглэх  — өнөөдөр, яг одоо цэнэглэж буйг бүртгэнэ;
 *   Нөхөж цэнэглэх — өмнө нь (жолооч өөрөө гэх мэт) цэнэглэснийг өнгөрсөн огноогоор нөхөж бүртгэнэ.
 * Төрөл нь цэнэглэлтийн тэмдэглэлд (p_note) хадгалагдана.
 */

const money = (n: number) => `${new Intl.NumberFormat('mn-MN').format(Math.round(n || 0))}₮`;
const WD = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];

type RefillKind = 'now' | 'catchup';
const REFILL: Record<RefillKind, { title: string; text: string; tone: ToneName; icon: typeof Zap; note: string }> = {
  now: { title: 'Одоо цэнэглэх', text: 'Өнөөдөр, яг одоо цэнэглэж буй бензинийг бүртгэнэ.', tone: 'green', icon: Zap, note: 'Одоо цэнэглэсэн' },
  catchup: { title: 'Нөхөж цэнэглэх', text: 'Өмнө нь цэнэглэснийг өнгөрсөн огноогоор нөхөж бүртгэнэ.', tone: 'amber', icon: CalendarClock, note: 'Нөхөж цэнэглэсэн' },
};

function Tank({ r }: { r: FuelRow }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center">
      <div className="relative h-20 w-12 overflow-hidden rounded-md border-2 border-line bg-card2">
        <div className="absolute inset-x-0 bottom-0 transition-all" style={{ height: `${r.currentLevel}%`, background: r.color }} />
        <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-ink">{Math.round(r.currentLevel)}%</span>
      </div>
      <span className="mt-1 text-[10px] text-muted">{r.remainingLiters.toFixed(1)}/{r.tank}л</span>
    </div>
  );
}

export default function FuelPage({ mode = 'consumption' }: { mode?: 'consumption' | 'refill' }) {
  const { data, loading, error, reload } = useAsync(() => fetchFleet(30), [], { vehicles: [], trips: [] });
  const rows = useMemo(() => fuelStats(data.vehicles, data.trips, 30), [data]);
  const week = useMemo(() => litersLast7(data.trips), [data]);
  const [refill, setRefill] = useState<{ row: FuelRow | null; kind: RefillKind } | null>(null);
  const maxWeek = Math.max(1, ...week);
  const totalKm = rows.reduce((s, r) => s + r.totalKm, 0);
  const withVehicle = rows.filter((r) => r.vehicle?.id);

  return (
    <>
      <PageHeader
        title={mode === 'refill' ? 'Бензин нөхөж цэнэглэх' : 'Бензин зарцуулалт'}
        crumb="Санхүү"
        description="Машин бүрийн сүүлийн 30 хоногийн км, литр, үлдэгдэл. Цэнэглэсэн мөнгөн дүнг литрт шилжүүлж үлдэгдэл дээр нэмнэ."
        actions={<Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState text={error} onRetry={reload} />
      ) : (
        <>
          <KpiRow cols={3}>
            <StatCard tone="green" icon={<Fuel size={19} />} value={rows.length} label="Машин" />
            <StatCard tone="blue" icon={<Gauge size={19} />} value={rows.filter((r) => r.active).length} label="Явж байна" />
            <StatCard tone="violet" icon={<Route size={19} />} value={Math.round(totalKm)} label="Нийт км (30 хоног)" />
          </KpiRow>

          <section className="mb-5" aria-label="Бензин цэнэглэх">
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Бензин цэнэглэх</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {(Object.keys(REFILL) as RefillKind[]).map((k) => {
                const g = REFILL[k];
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={!withVehicle.length}
                    onClick={() => setRefill({ row: null, kind: k })}
                    className="surface focus-ring flex items-start gap-3.5 p-5 text-left disabled:opacity-50"
                  >
                    <ToneIcon tone={g.tone} size={44}><g.icon size={20} /></ToneIcon>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{g.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-5 text-muted">{g.text}</span>
                      <span className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-brand"><Plus size={13} /> Бүртгэх</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {!withVehicle.length ? <p className="mt-2 text-[13px] text-muted">Машин бүртгэгдээгүй байна. «Машины мэдээлэл солих» хэсгээс нэмнэ.</p> : null}
          </section>

          <Card className="mb-5" title="Бензин зарцуулалт (7 хоног, литр)">
            <div className="flex h-40 items-end gap-2">
              {week.map((v, i) => {
                const d = new Date(Date.now() - (6 - i) * 86400000);
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[11px] text-muted">{v || ''}</span>
                    <div className="w-full rounded-t bg-brand" style={{ height: `${(v / maxWeek) * 110}px`, minHeight: v ? 3 : 0 }} />
                    <span className="text-[11px] text-subtle">{WD[d.getDay()]}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Машин бүрээр">
            {!rows.length ? (
              <EmptyState text="Машин эсвэл аяллын бүртгэл алга." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((r) => (
                  <div key={r.vehicle?.id || r.plate} className="rounded-[var(--radius-sm)] border border-line bg-card2 p-3">
                    <div className="flex gap-3">
                      <Tank r={r} />
                      <div className="min-w-0 flex-1 text-[13px]">
                        <p className="flex flex-wrap items-center gap-2">
                          <b className="rounded border border-line bg-card px-1.5 py-0.5 text-[13px] tracking-wide text-ink">{r.plate}</b>
                          {r.active ? <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-white">Явж байна</span> : null}
                        </p>
                        <p className="mt-1 text-muted">Жолооч: {r.driver}</p>
                        <p className="mt-1 text-ink"><b>{r.totalKm.toFixed(1)} км</b> · {r.periodLiters.toFixed(1)} л</p>
                        <p className="mt-0.5" style={{ color: r.color }}><b>{r.currentLevel}%</b> үлдсэн</p>
                        {r.cost ? <p className="text-[12px] text-muted">Зардал: {money(r.cost)}</p> : null}
                        {r.vehicle?.id ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Button className="!min-h-8" onClick={() => setRefill({ row: r, kind: 'now' })}>Одоо цэнэглэх</Button>
                            <Button variant="outline" className="!min-h-8" onClick={() => setRefill({ row: r, kind: 'catchup' })}>Нөхөж цэнэглэх</Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full" style={{ width: `${r.currentLevel}%`, background: r.color }} /></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
      {refill ? <RefillDialog row={refill.row} rows={withVehicle} kind={refill.kind} onClose={() => setRefill(null)} onDone={() => { setRefill(null); reload(); }} /> : null}
    </>
  );
}

type RefillTarget = { vehicle: { id: string } | null; plate: string };

export function RefillDialog({ row, rows = [], kind = 'catchup', onClose, onDone }: {
  row: RefillTarget | null;
  rows?: (RefillTarget & { driver?: string; currentLevel?: number; remainingLiters?: number; tank?: number })[];
  kind?: RefillKind;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = (() => {
    const n = new Date();
    return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  })();
  const yesterday = new Date(new Date(today).getTime() - 86400000).toISOString().slice(0, 10);
  const [k, setK] = useState<RefillKind>(kind);
  const [vid, setVid] = useState(row?.vehicle?.id || '');
  const target = row || rows.find((r) => r.vehicle?.id === vid) || null;
  const info = rows.find((r) => r.vehicle?.id === (target?.vehicle?.id || vid));
  const [date, setDate] = useState(kind === 'now' ? today : yesterday);
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const save = async () => {
    if (!target?.vehicle?.id) return setMsg('Машинаа сонгоно уу.');
    const d = k === 'now' ? today : date;
    const a = Number(amount);
    const p = price.trim() ? Number(price) : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today) return setMsg('Огноогоо зөв сонгоно уу (ирээдүйн огноо болохгүй).');
    if (!Number.isFinite(a) || a <= 0) return setMsg('0-ээс их мөнгөн дүн оруулна уу.');
    if (p !== null && (!Number.isFinite(p) || p <= 0)) return setMsg('1 литрийн үнийг зөв оруулна уу.');
    setBusy(true);
    setMsg('');
    try {
      const fullNote = [REFILL[k].note, note.trim()].filter(Boolean).join(' — ');
      const liters = await refuelByAmount(target.vehicle.id, a, d, p, fullNote);
      setMsg(`${target.plate} — ${liters.toFixed(2)} л цэнэглэлээ`);
      setTimeout(onDone, 700);
    } catch (e) {
      setMsg((e as Error).message || 'Хадгалж чадсангүй.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`${REFILL[k].title}${target ? ` — ${target.plate}` : ''}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-[var(--radius)] bg-card2 p-1" role="radiogroup" aria-label="Цэнэглэлтийн төрөл">
          {(Object.keys(REFILL) as RefillKind[]).map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={k === x}
              onClick={() => setK(x)}
              className={`rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] font-semibold ${k === x ? 'bg-card text-ink shadow-[var(--shadow)]' : 'text-muted hover:text-ink'}`}
            >
              {REFILL[x].title}
            </button>
          ))}
        </div>
        {!row ? (
          <Field label="Машин">
            <Select className="w-full" value={vid} onChange={(e) => setVid(e.target.value)} autoFocus>
              <option value="">Машин сонгох…</option>
              {rows.map((r) => <option key={r.vehicle!.id} value={r.vehicle!.id}>{r.plate}{r.driver ? ` — ${r.driver}` : ''}</option>)}
            </Select>
          </Field>
        ) : null}
        {info && info.currentLevel !== undefined ? (
          <p className="text-[12px] text-muted">Үлдэгдэл: {Math.round(info.currentLevel)}% · {info.remainingLiters?.toFixed(1)} / {info.tank} л</p>
        ) : null}
        {k === 'now' ? (
          <p className="rounded-[var(--radius-sm)] bg-card2 px-3 py-2 text-[12px] text-muted">Огноо: өнөөдөр ({today})</p>
        ) : (
          <Field label="Цэнэглэсэн огноо"><Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        )}
        <Field label="Цэнэглэсэн мөнгөн дүн (₮)"><Input type="number" min={1} placeholder="Жишээ: 50000" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!!row} /></Field>
        <Field label="Хөнгөлөлттэй 1 литрийн үнэ (₮, заавал биш)" hint="Хоосон бол бүртгэлтэй үнээр. Цэнэглэлт зардлын түүхэнд хадгалагдана.">
          <Input type="number" min={1} step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Тэмдэглэл (заавал биш)" hint={k === 'catchup' ? 'Жишээ нь: хэн өөрийн мөнгөөр цэнэглэсэн, баримтын дугаар.' : undefined}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {msg ? <p className="text-[13px] text-ink" role="status">{msg}</p> : null}
        <div className="flex gap-2">
          <Button disabled={busy || !target} onClick={save}>{busy ? 'Хадгалж байна…' : REFILL[k].title}</Button>
          <Button variant="outline" onClick={onClose}>Болих</Button>
        </div>
      </div>
    </Modal>
  );
}
