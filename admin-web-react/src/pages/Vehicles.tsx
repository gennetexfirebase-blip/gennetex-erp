import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Car, ExternalLink, Pencil, Plus, Printer, QrCode, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader, Card, Button, Input, Modal, Field, Loading, ErrorState, EmptyState } from '../components/ui';
import { useAsync } from '../lib/data';
import { supabase } from '../lib/supabase';
import { fetchFleet, formatPlate, fuelStats, tankOf, type Vehicle } from '../lib/fleet';
import { RefillDialog } from './Fuel';

/** Машины мэдээлэл солих — хуучин панелийн «vehicles» модулийн оронд. */

const qrUrl = (code: string) => `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(code)}`;
const autoboxQuery = (plate: string) => {
  const [d, l] = formatPlate(plate).split(' ');
  return d ? d + (l || '').toLowerCase() : '';
};

export default function VehiclesPage() {
  const { data, loading, error, reload } = useAsync(() => fetchFleet(30), [], { vehicles: [], trips: [] });
  const stats = useMemo(() => fuelStats(data.vehicles, data.trips, 30), [data]);
  const [edit, setEdit] = useState<Vehicle | 'new' | null>(null);
  const [qr, setQr] = useState<Vehicle | null>(null);
  const [refill, setRefill] = useState<Vehicle | null>(null);
  const [scan, setScan] = useState(false);
  const [msg, setMsg] = useState('');

  const lookup = (code: string) => {
    const c = code.trim();
    const v = data.vehicles.find((x) => x.code === c) || data.vehicles.find((x) => formatPlate(x.plate_number) === formatPlate(c));
    if (v) {
      setEdit(v);
      setMsg('');
    } else setMsg(`«${c}» кодтой машин олдсонгүй.`);
  };
  const remove = async (v: Vehicle) => {
    if (!window.confirm(`${v.plate_number} машиныг устгах уу?`)) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', v.id);
    if (error) window.alert(error.message);
    else reload();
  };

  return (
    <>
      <PageHeader
        title="Машины мэдээлэл солих"
        crumb="Машин"
        description="QR уншуулж эсвэл жагсаалтаас сонгож машины мэдээллийг засна. Шинэ машинд QR үүсгэж хэвлээд машин дээр наана."
        actions={
          <>
            <Button variant="outline" icon={<Camera size={15} />} onClick={() => setScan(true)}>QR уншуулах</Button>
            <Button variant="outline" icon={<QrCode size={15} />} onClick={() => { const c = window.prompt('Машины QR код эсвэл улсын дугаар'); if (c) lookup(c); }}>Код гараар</Button>
            <Button icon={<Plus size={15} />} onClick={() => setEdit('new')}>Машин нэмэх</Button>
          </>
        }
      />
      {msg ? <p className="mb-3 text-[13px] text-warning" role="status">{msg}</p> : null}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState text={error} onRetry={reload} />
      ) : (
        <Card title={`Машин (${data.vehicles.length})`} icon={<Car size={17} />} bodyClassName="p-0" actions={<Button variant="ghost" icon={<RefreshCw size={14} />} onClick={reload}>Шинэчлэх</Button>}>
          {!data.vehicles.length ? (
            <EmptyState text="Машин алга." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-[13px]">
                <thead className="bg-card2 text-left text-[12px] text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Улсын дугаар</th>
                    <th className="px-3 py-2 font-medium">Код</th>
                    <th className="px-3 py-2 font-medium">100км/л</th>
                    <th className="px-3 py-2 font-medium">Сав</th>
                    <th className="px-3 py-2 font-medium">Км (30х)</th>
                    <th className="px-3 py-2 font-medium">Бензин</th>
                    <th className="px-3 py-2 font-medium">Жолооч</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.vehicles.map((v) => {
                    const s = stats.find((r) => r.vehicle?.id === v.id);
                    const lvl = s?.currentLevel ?? Number(v.fuel_level_percent ?? 0);
                    return (
                      <tr key={v.id}>
                        <td className="px-4 py-2">
                          <b className="rounded border border-line bg-card px-1.5 py-0.5 tracking-wide text-ink">{v.plate_number}</b>
                          {s?.active ? <span className="ml-2 rounded-full bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white">Явж</span> : null}
                        </td>
                        <td className="px-3 py-2 text-muted">{v.code}</td>
                        <td className="px-3 py-2 text-ink">{v.liters_per_100km ?? 12} л</td>
                        <td className="px-3 py-2 text-ink">{tankOf(v)} л</td>
                        <td className="px-3 py-2 text-ink">{(s?.totalKm ?? 0).toFixed(1)}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color: s?.color }}>{lvl}%</td>
                        <td className="px-3 py-2 text-ink">{v.driver_name || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <Button variant="ghost" className="!min-h-8 !px-2" title="Засах" aria-label="Засах" onClick={() => setEdit(v)}><Pencil size={15} /></Button>
                          <Button variant="ghost" className="!min-h-8 !px-2" title="QR" aria-label="QR" onClick={() => setQr(v)}><QrCode size={15} /></Button>
                          <Button variant="outline" className="!min-h-8" onClick={() => setRefill(v)}>Цэнэглэх</Button>
                          <Button variant="ghost" className="!min-h-8 !px-2 hover:!text-danger" title="Устгах" aria-label="Устгах" onClick={() => remove(v)}><Trash2 size={15} /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {edit ? <VehicleDialog vehicle={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={(v) => { setEdit(null); reload(); if (v) setQr(v); }} /> : null}
      {qr ? <QrDialog v={qr} onClose={() => setQr(null)} /> : null}
      {refill ? <RefillDialog row={{ vehicle: refill, plate: refill.plate_number }} onClose={() => setRefill(null)} onDone={() => { setRefill(null); reload(); }} /> : null}
      {scan ? <ScanDialog onClose={() => setScan(false)} onCode={(c) => { setScan(false); lookup(c); }} /> : null}
    </>
  );
}

function VehicleDialog({ vehicle, onClose, onSaved }: { vehicle: Vehicle | null; onClose: () => void; onSaved: (created: Vehicle | null) => void }) {
  const [plate, setPlate] = useState(vehicle?.plate_number || '');
  const [lit, setLit] = useState(String(vehicle?.liters_per_100km ?? 12));
  const [tank, setTank] = useState(String(tankOf(vehicle)));
  const [driver, setDriver] = useState(vehicle?.driver_name || '');
  const [code, setCode] = useState(vehicle?.code || `VH-${Math.floor(1000 + Math.random() * 9000)}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    const p = formatPlate(plate);
    if (!p) return setErr('Улсын дугаар оруулна уу.');
    setBusy(true);
    setErr('');
    const row = { plate_number: p, liters_per_100km: Number(lit) || 12, tank_capacity_liters: Number(tank) || 60, driver_name: driver.trim() || null };
    const res = vehicle
      ? await supabase.from('vehicles').update(row).eq('id', vehicle.id).select().single()
      : await supabase.from('vehicles').insert({ ...row, code: code.trim() }).select().single();
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    onSaved(vehicle ? null : (res.data as Vehicle));
  };
  return (
    <Modal title={vehicle ? `Машин засах — ${vehicle.plate_number}` : 'Шинэ машин нэмэх'} onClose={onClose} wide={!!vehicle}>
      <div className={vehicle ? 'grid gap-5 md:grid-cols-[1fr_1.2fr]' : ''}>
        <div className="space-y-3">
          <Field label="Улсын дугаар" hint={formatPlate(plate) ? `Харагдах: ${formatPlate(plate)}` : 'Жишээ: 1234 УБА'}>
            <Input value={plate} onChange={(e) => setPlate(formatPlate(e.target.value))} autoFocus autoComplete="off" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="100км-т литр"><Input type="number" value={lit} onChange={(e) => setLit(e.target.value)} /></Field>
            <Field label="Бензиний сав (л)"><Input type="number" min={10} value={tank} onChange={(e) => setTank(e.target.value)} /></Field>
          </div>
          <Field label="Жолооч"><Input value={driver} onChange={(e) => setDriver(e.target.value)} /></Field>
          <Field label="QR код"><Input value={code} readOnly={!!vehicle} onChange={(e) => setCode(e.target.value)} /></Field>
          {err ? <p className="text-[13px] text-danger" role="alert">{err}</p> : null}
          <div className="flex gap-2">
            <Button disabled={busy} onClick={save}>{busy ? 'Хадгалж байна…' : vehicle ? 'Мэдээлэл хадгалах' : 'Үүсгэх + QR'}</Button>
            <Button variant="outline" onClick={onClose}>Болих</Button>
          </div>
        </div>
        {vehicle ? <Autobox plate={vehicle.plate_number} /> : null}
      </div>
    </Modal>
  );
}

/** Autobox.mn-ээс ирсэн HTML хүснэгтийг зөвхөн текст болгож харуулна (скрипт, холбоос оруулахгүй). */
function htmlRows(html?: string) {
  if (!html) return [] as string[][];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())).filter((r) => r.some(Boolean));
}

function Autobox({ plate }: { plate: string }) {
  const q = autoboxQuery(plate);
  const [state, setState] = useState<{ loading: boolean; error?: string; data?: Record<string, string> }>({ loading: true });
  useEffect(() => {
    if (!q) return setState({ loading: false, error: 'Улсын дугаар буруу' });
    let live = true;
    supabase.functions
      .invoke(`autobox-vehicle?plateNo=${encodeURIComponent(q)}`, { method: 'GET' })
      .then(({ data, error }) => {
        if (!live) return;
        if (error || data?.ok === false) setState({ loading: false, error: data?.error || error?.message || 'Autobox татахад алдаа' });
        else setState({ loading: false, data });
      });
    return () => {
      live = false;
    };
  }, [q]);
  const blocks: [string, string][] = [['general', 'Ерөнхий мэдээлэл'], ['technical', 'Техникийн мэдээлэл'], ['diagnosis', 'Техникийн хяналтын үзлэг'], ['fines', 'Торгууль']];
  return (
    <div className="space-y-3 border-t border-line pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-semibold text-ink">Autobox.mn</h3>
        {q ? <a className="inline-flex items-center gap-1 text-[12px] text-muted underline" href={`https://www.autobox.mn/Autobox?plateNo=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer">нээх <ExternalLink size={11} /></a> : null}
      </div>
      {state.loading ? <Loading text="Autobox.mn уншиж байна…" /> : state.error ? <p className="text-[13px] text-muted">{state.error}</p> : (
        blocks.map(([k, l]) => {
          const rows = htmlRows(state.data?.[k]);
          return (
            <div key={k}>
              <p className="mb-1 text-[12px] font-semibold text-muted">{l}</p>
              {rows.length ? (
                <table className="w-full text-[12px]"><tbody className="divide-y divide-line">
                  {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`py-1 pr-2 ${j === 0 ? 'text-muted' : 'text-ink'}`}>{c}</td>)}</tr>)}
                </tbody></table>
              ) : <p className="text-[12px] text-subtle">Бүртгэл алга</p>}
            </div>
          );
        })
      )}
    </div>
  );
}

function QrDialog({ v, onClose }: { v: Vehicle; onClose: () => void }) {
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><body style="text-align:center;font-family:sans-serif;padding:24px"><h2 style="letter-spacing:2px">${v.plate_number.replace(/</g, '')}</h2><p>${String(v.code || '').replace(/</g, '')}</p><img src="${qrUrl(v.code || '')}" style="width:420px;height:420px"></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };
  return (
    <Modal title="Машины QR код" onClose={onClose}>
      <div className="text-center">
        <b className="rounded border border-line bg-card2 px-3 py-1 text-[18px] tracking-wide text-ink">{v.plate_number}</b>
        <p className="mt-2 text-[13px] text-muted">{v.code} · {v.liters_per_100km ?? 12} л/100км</p>
        <img src={qrUrl(v.code || '')} width={320} height={320} alt={`${v.plate_number} QR`} className="mx-auto mt-3 h-auto max-w-full" />
        <p className="mt-2 text-[12px] text-muted">Хэвлээд машин дээр наана. Ажилтан уншиж аялал эхлүүлнэ.</p>
        <Button className="mt-3" icon={<Printer size={15} />} onClick={print}>Хэвлэх</Button>
      </div>
    </Modal>
  );
}

/** Камераар QR уншуулах — хөтчийн BarcodeDetector (Chrome, Edge, Android). */
function ScanDialog({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const BD = (window as any).BarcodeDetector;
    if (!BD) {
      setErr('Энэ хөтөч камераар QR уншихыг дэмждэггүй. «Код гараар» ашиглана уу.');
      return;
    }
    let stream: MediaStream | null = null;
    let stop = false;
    const detector = new BD({ formats: ['qr_code'] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) return onCode(codes[0].rawValue);
          } catch {
            /* дараагийн кадр */
          }
          setTimeout(tick, 300);
        };
        tick();
      } catch (e) {
        setErr('Камер нээж чадсангүй: ' + ((e as Error).message || ''));
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);
  return (
    <Modal title="Машины QR уншуулах" onClose={onClose}>
      {err ? <p className="text-[13px] text-muted">{err}</p> : <video ref={video} className="w-full rounded-[var(--radius-sm)] bg-black" muted playsInline />}
    </Modal>
  );
}
