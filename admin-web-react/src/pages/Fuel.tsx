import { useMemo, useState } from 'react';
import { Fuel, Gauge, RefreshCw, Route } from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, Modal, Field, Loading, ErrorState, EmptyState } from '../components/ui';
import { useAsync } from '../lib/data';
import { fetchFleet, fuelStats, litersLast7, refuelByAmount, type FuelRow } from '../lib/fleet';

/** sanhuu.gennetex.com — Бензин зарцуулалт ба нөхөж цэнэглэх (хуучин панелийн модулийн оронд). */

const money = (n: number) => `${new Intl.NumberFormat('mn-MN').format(Math.round(n || 0))}₮`;
const WD = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];

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
  const [refill, setRefill] = useState<FuelRow | null>(null);
  const [pick, setPick] = useState('');
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
          <Card className="mb-5" title="Нөхөж цэнэглэх" icon={<Fuel size={17} />}>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Машин">
                <Select className="min-w-[240px]" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Машин сонгох…</option>
                  {withVehicle.map((r) => <option key={r.vehicle!.id} value={r.vehicle!.id}>{r.plate} — {r.driver}</option>)}
                </Select>
              </Field>
              <Button disabled={!pick} onClick={() => setRefill(withVehicle.find((r) => r.vehicle!.id === pick) || null)}>Бензин нөхөж цэнэглэх</Button>
              {pick ? (() => {
                const r = withVehicle.find((x) => x.vehicle!.id === pick);
                return r ? <span className="pb-2 text-[13px] text-muted">Үлдэгдэл: {r.currentLevel}% · {r.remainingLiters.toFixed(1)} / {r.tank} л</span> : null;
              })() : null}
            </div>
            {!withVehicle.length ? <p className="mt-2 text-[13px] text-muted">Машин бүртгэгдээгүй байна. «Машины мэдээлэл солих» хэсгээс нэмнэ.</p> : null}
          </Card>

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {([[Fuel, rows.length, 'Машин'], [Gauge, rows.filter((r) => r.active).length, 'Явж байна'], [Route, Math.round(totalKm), 'Нийт км (30 хоног)']] as const).map(([I, v, l]) => (
              <div key={l} className="surface flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-brand-soft text-brand"><I size={18} /></span>
                <div><p className="text-[20px] font-semibold text-ink">{v}</p><p className="text-[12px] text-muted">{l}</p></div>
              </div>
            ))}
          </div>

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
                        {r.vehicle?.id ? <Button variant="outline" className="mt-2 !min-h-8" onClick={() => setRefill(r)}>Нөхөж цэнэглэх</Button> : null}
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
      {refill ? <RefillDialog row={refill} onClose={() => setRefill(null)} onDone={() => { setRefill(null); reload(); }} /> : null}
    </>
  );
}

export function RefillDialog({ row, onClose, onDone }: { row: { vehicle: { id: string } | null; plate: string }; onClose: () => void; onDone: () => void }) {
  const today = (() => {
    const n = new Date();
    return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  })();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const save = async () => {
    const a = Number(amount);
    const p = price.trim() ? Number(price) : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return setMsg('Огноогоо зөв сонгоно уу (ирээдүйн огноо болохгүй).');
    if (!Number.isFinite(a) || a <= 0) return setMsg('0-ээс их мөнгөн дүн оруулна уу.');
    if (p !== null && (!Number.isFinite(p) || p <= 0)) return setMsg('1 литрийн үнийг зөв оруулна уу.');
    setBusy(true);
    setMsg('');
    try {
      const liters = await refuelByAmount(row.vehicle!.id, a, date, p);
      setMsg(`${row.plate} — ${liters.toFixed(2)} л цэнэглэлээ`);
      setTimeout(onDone, 700);
    } catch (e) {
      setMsg((e as Error).message || 'Хадгалж чадсангүй.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Бензин нөхөж цэнэглэх — ${row.plate}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Цэнэглэсэн огноо"><Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Цэнэглэсэн мөнгөн дүн (₮)"><Input type="number" min={1} placeholder="Жишээ: 50000" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
        <Field label="Хөнгөлөлттэй 1 литрийн үнэ (₮, заавал биш)" hint="Хоосон бол бүртгэлтэй үнээр. Цэнэглэлт зардлын түүхэнд хадгалагдана.">
          <Input type="number" min={1} step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        {msg ? <p className="text-[13px] text-ink" role="status">{msg}</p> : null}
        <div className="flex gap-2">
          <Button disabled={busy} onClick={save}>{busy ? 'Хадгалж байна…' : 'Цэнэглэх'}</Button>
          <Button variant="outline" onClick={onClose}>Болих</Button>
        </div>
      </div>
    </Modal>
  );
}
