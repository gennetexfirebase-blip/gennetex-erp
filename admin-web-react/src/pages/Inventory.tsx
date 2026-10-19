import { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, Camera, Coins, PackageCheck, Download, Minus, PackagePlus, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, Textarea, Modal, Field, Loading, ErrorState, EmptyState, StatCard, KpiRow } from '../components/ui';
import { useAsync } from '../lib/data';
import { supabase } from '../lib/supabase';
import { downloadSheets } from '../lib/attendanceExport';

/** aguulah.gennetex.com — Агуулах ба Барааны хэрэглээ (хуучин «inventory», «usage»). */

type Cat = 'material' | 'tool' | 'supply';
type Item = {
  id: string; name: string; unit: string | null; quantity: number; price: number | null; barcode: string | null; category: Cat | null;
  image_url: string | null; model: string | null; serial_number: string | null; brand: string | null; company: string | null; supplier?: string | null;
};
type Movement = { id: string; created_at: string; user_id: string | null; user_name: string | null; item_id: string | null; item_name: string | null; quantity: number; unit: string | null; movement_type: string | null; photo_url: string | null };

const CATS: [Cat, string][] = [['material', 'Бараа материал'], ['tool', 'Багаж'], ['supply', 'Хангамж']];
const catName = (c: string | null) => CATS.find(([k]) => k === c)?.[1] || 'Бараа материал';
const normCat = (c: string | null): Cat => (c === 'tool' ? 'tool' : c === 'supply' ? 'supply' : 'material');
const money = (n: number) => `${new Intl.NumberFormat('mn-MN').format(Math.round(n || 0))}₮`;
const delta = (m: Movement) => (m.movement_type === 'consume' || m.movement_type === 'return' ? -1 : 1) * (Number(m.quantity) || 0);
const fmtQ = (q: number) => (q % 1 ? q.toFixed(1) : String(q));

async function fetchInventory() {
  const { data, error } = await supabase.from('inventory').select('*').order('name');
  if (error) throw error;
  return (data || []) as Item[];
}
async function fetchMovements() {
  const { data, error } = await supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(5000);
  if (error) throw error;
  return (data || []) as Movement[];
}

/** Барааны каталогийг (products) агуулахтай уялдуулна — хуучин syncProductFromInventory. */
async function syncProduct(item: Item) {
  try {
    const cat = normCat(item.category);
    const { data: products } = await supabase.from('products').select('id, sku, barcode, name, category');
    const list = (products || []) as { id: string; sku: string | null; barcode: string | null; name: string; category: string | null }[];
    const match = list.find((p) => p.sku === item.id) || (item.barcode ? list.find((p) => p.barcode === item.barcode && normCat(p.category) === cat) : undefined) || list.find((p) => p.name === item.name && normCat(p.category) === cat);
    const row = { name: item.name.trim(), sku: item.id, barcode: item.barcode || null, category: cat, stock: Number(item.quantity) || 0, purchase_price: Number(item.price) || 0 };
    if (match) await supabase.from('products').update({ ...row, updated_at: new Date().toISOString() }).eq('id', match.id);
    else await supabase.from('products').insert(row);
  } catch {
    /* каталог тусдаа — агуулахын хадгалалтыг саатуулахгүй */
  }
}

/* ═══════════════════ Агуулах ═══════════════════ */
export function InventoryPage() {
  const { data, loading, error, reload } = useAsync(fetchInventory, [], []);
  const [cat, setCat] = useState<Cat>('material');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Item | 'new' | null>(null);
  const [receipt, setReceipt] = useState(false);
  const [zoom, setZoom] = useState<Item | null>(null);
  const list = data.filter((it) => normCat(it.category) === cat && `${it.name} ${it.barcode || ''} ${it.model || ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const totalQty = list.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalValue = list.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  const adj = async (it: Item, d: number) => {
    const { error } = await supabase.from('inventory').update({ quantity: Math.max(0, Number(it.quantity) + d) }).eq('id', it.id);
    if (error) window.alert(error.message);
    else reload();
  };
  const remove = async (it: Item) => {
    if (!window.confirm(`${it.name} устгах уу?`)) return;
    const { error } = await supabase.from('inventory').delete().eq('id', it.id);
    if (error) window.alert(error.message);
    else reload();
  };

  return (
    <>
      <PageHeader
        title="Агуулах" description="Багаж, бараа материалын үлдэгдэл, орлого болон ангиллыг удирдана."
        crumb="Агуулах"
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>
            <Button variant="success" icon={<PackagePlus size={15} />} onClick={() => setReceipt(true)}>Орлого авах</Button>
            <Button icon={<Plus size={15} />} onClick={() => setEdit('new')}>{catName(cat)} нэмэх</Button>
          </>
        }
      />
      <div className="mb-4 inline-flex rounded-full border border-line bg-card2 p-1" role="tablist">
        {CATS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={cat === k} onClick={() => setCat(k)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${cat === k ? 'bg-brand text-white' : 'text-muted'}`}>
            {l} ({data.filter((it) => normCat(it.category) === k).length})
          </button>
        ))}
      </div>
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : (
        <>
          <KpiRow cols={3}>
            <StatCard tone="green" icon={<Boxes size={19} />} value={list.length} label="Нэр төрөл" />
            <StatCard tone="blue" icon={<PackageCheck size={19} />} value={fmtQ(totalQty)} label="Нийт тоо (агуулахад)" />
            <StatCard tone="amber" icon={<Coins size={19} />} value={money(totalValue)} label="Нийт үнэлгээ" />
          </KpiRow>
          <Card title={`${catName(cat)} (${list.length})`} icon={<Boxes size={17} />} bodyClassName="p-0" actions={<Input placeholder="Нэр, баркод хайх" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />}>
            {!list.length ? <EmptyState text="Бараа алга." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-[13px]">
                  <thead className="bg-card2 text-left text-[12px] text-muted">
                    <tr><th className="px-3 py-2" /><th className="px-3 py-2 font-medium">Нэр</th><th className="px-3 py-2 font-medium">Нэгж</th><th className="px-3 py-2 font-medium">Тоо</th><th className="px-3 py-2 text-right font-medium">Нэгж үнэ</th><th className="px-3 py-2 text-right font-medium">Нийт үнэ</th><th className="px-3 py-2 font-medium">Баркод</th><th className="px-3 py-2" /></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {list.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2">{it.image_url ? <button type="button" onClick={() => setZoom(it)} aria-label={`${it.name} зургийг томруулах`}><img src={it.image_url} alt="" className="h-16 w-16 cursor-zoom-in rounded-[var(--radius-sm)] border border-line object-cover" loading="lazy" /></button> : <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-sm)] bg-card2 text-subtle"><Boxes size={20} /></span>}</td>
                        <td className="px-3 py-2"><b className="text-ink">{it.name}</b>{it.model || it.brand ? <span className="block text-[12px] text-muted">{[it.brand, it.model].filter(Boolean).join(' · ')}</span> : null}</td>
                        <td className="px-3 py-2 text-muted">{it.unit || ''}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className="inline-flex items-center gap-1">
                            <Button variant="ghost" className="!min-h-7 !px-1.5" aria-label="Хасах" onClick={() => adj(it, -1)}><Minus size={13} /></Button>
                            <b className="min-w-[2ch] text-center text-ink">{fmtQ(Number(it.quantity))}</b>
                            <Button variant="ghost" className="!min-h-7 !px-1.5" aria-label="Нэмэх" onClick={() => adj(it, 1)}><Plus size={13} /></Button>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-ink">{money(Number(it.price))}</td>
                        <td className="px-3 py-2 text-right font-semibold text-ink">{money((Number(it.quantity) || 0) * (Number(it.price) || 0))}</td>
                        <td className="px-3 py-2 text-muted">{it.barcode || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <Button variant="ghost" className="!min-h-8 !px-2" aria-label="Засах" onClick={() => setEdit(it)}><Pencil size={15} /></Button>
                          <Button variant="ghost" className="!min-h-8 !px-2 hover:!text-danger" aria-label="Устгах" onClick={() => remove(it)}><Trash2 size={15} /></Button>
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
      {edit ? <ItemDialog item={edit === 'new' ? null : edit} defaultCat={cat} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} /> : null}
      {zoom ? (
        <Modal title={zoom.name} onClose={() => setZoom(null)} wide>
          <img src={zoom.image_url!} alt={zoom.name} className="mx-auto max-h-[75vh] w-auto rounded-[var(--radius-sm)] object-contain" />
          <p className="mt-3 text-center text-[13px] text-muted">{[zoom.brand, zoom.model, zoom.barcode].filter(Boolean).join(' · ')}</p>
        </Modal>
      ) : null}
      {receipt ? <ReceiptDialog items={data.filter((it) => normCat(it.category) === cat)} cat={cat} onClose={() => setReceipt(false)} onSaved={() => { setReceipt(false); reload(); }} /> : null}
    </>
  );
}

function ItemDialog({ item, defaultCat, onClose, onSaved }: { item: Item | null; defaultCat: Cat; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    category: normCat(item?.category ?? defaultCat), name: item?.name || '', model: item?.model || '', serial_number: item?.serial_number || '',
    brand: item?.brand || '', company: item?.company || '', unit: item?.unit || 'ширхэг', quantity: String(item?.quantity ?? 0), price: String(item?.price ?? 0), barcode: item?.barcode || '',
  });
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : item?.image_url || ''), [file, item?.image_url]);
  useEffect(() => () => { if (file) URL.revokeObjectURL(preview); }, [file, preview]);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    if (!f.name.trim()) return setErr('Нэр оруулна уу.');
    setBusy(true);
    setErr('');
    try {
      let image_url = item?.image_url || null;
      if (file) {
        const path = `${item?.id || 'new'}/${Date.now()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
        const up = await supabase.storage.from('inventory').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });
        if (up.error) throw up.error;
        image_url = supabase.storage.from('inventory').getPublicUrl(path).data.publicUrl;
      }
      const row = {
        name: f.name.trim(), unit: f.unit.trim() || 'ширхэг', quantity: Number(f.quantity) || 0, price: Number(f.price) || 0, barcode: f.barcode.trim() || null,
        category: f.category, image_url, model: f.model.trim() || null, serial_number: f.serial_number.trim() || null, brand: f.brand.trim() || null, company: f.company.trim() || null,
      };
      const res = item ? await supabase.from('inventory').update(row).eq('id', item.id).select().single() : await supabase.from('inventory').insert(row).select().single();
      if (res.error) throw res.error;
      await syncProduct(res.data as Item);
      onSaved();
    } catch (e) {
      setErr((e as Error).message || 'Хадгалж чадсангүй.');
      setBusy(false);
    }
  };

  return (
    <Modal title={item ? 'Бараа засах' : `${catName(f.category)} нэмэх`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Ангилал"><Select className="w-full" value={f.category} onChange={set('category')}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        {preview ? (
          <a href={preview} target="_blank" rel="noreferrer" className="block" title="Шинэ цонхонд бүтэн хэмжээгээр">
            <img src={preview} alt="Барааны зураг" className="mx-auto max-h-80 w-full rounded-[var(--radius-sm)] border border-line bg-card2 object-contain" />
          </a>
        ) : null}
        <Field label="Нэр"><Input value={f.name} onChange={set('name')} placeholder="Router (чиглүүлэгч)" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Модель"><Input value={f.model} onChange={set('model')} /></Field>
          <Field label="Сериал"><Input value={f.serial_number} onChange={set('serial_number')} /></Field>
          <Field label="Брэнд"><Input value={f.brand} onChange={set('brand')} /></Field>
          <Field label="Компани"><Input value={f.company} onChange={set('company')} /></Field>
        </div>
        <Field label={item ? 'Шинэ зураг' : 'Зураг (заавал биш)'}><input type="file" accept="image/*" className="text-[13px]" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Нэгж"><Input value={f.unit} onChange={set('unit')} /></Field>
          <Field label="Тоо"><Input type="number" value={f.quantity} onChange={set('quantity')} /></Field>
          <Field label="Нэгж үнэ (₮)"><Input type="number" value={f.price} onChange={set('price')} /></Field>
        </div>
        <Field label="Баркод">
          <div className="flex gap-2"><Input value={f.barcode} onChange={set('barcode')} placeholder="Скан эсвэл гараар" /><Button variant="outline" icon={<Camera size={14} />} onClick={() => setScan(true)}>Скан</Button></div>
        </Field>
        {err ? <p className="text-[13px] text-danger" role="alert">{err}</p> : null}
        <div className="flex gap-2"><Button disabled={busy} onClick={save}>{busy ? 'Хадгалж байна…' : 'Хадгалах'}</Button><Button variant="outline" onClick={onClose}>Болих</Button></div>
      </div>
      {scan ? <BarcodeScan onClose={() => setScan(false)} onCode={(c) => { setF((x) => ({ ...x, barcode: c })); setScan(false); }} /> : null}
    </Modal>
  );
}

function ReceiptDialog({ items, cat, onClose, onSaved }: { items: Item[]; cat: Cat; onClose: () => void; onSaved: () => void }) {
  const [id, setId] = useState(items[0]?.id || '');
  const cur = items.find((it) => it.id === id);
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState(String(Number(cur?.price) || 0));
  const [supplier, setSupplier] = useState(cur?.supplier || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    setPrice(String(Number(cur?.price) || 0));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) {
    return <Modal title="Орлого авах" onClose={onClose}><p className="text-[13px] text-muted">Эхлээд {catName(cat)} бүртгэнэ үү.</p></Modal>;
  }
  const save = async () => {
    const q = Number(qty);
    const p = Number(price);
    if (!Number.isFinite(q) || q <= 0) return setErr('Орлогын тоо 0-ээс их байна.');
    if (!Number.isFinite(p) || p < 0) return setErr('Нэгж үнэ буруу байна.');
    setBusy(true);
    const { error } = await supabase.rpc('receive_inventory_stock', { p_item_id: id, p_quantity: q, p_unit_price: p, p_supplier: supplier.trim() || null, p_note: note.trim() || null, p_received_at: new Date().toISOString() });
    setBusy(false);
    if (error) setErr(error.message);
    else onSaved();
  };
  return (
    <Modal title={`${catName(cat)} — орлого авах`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Бараа / багаж / хангамж">
          <Select className="w-full" value={id} onChange={(e) => setId(e.target.value)}>
            {items.map((it) => <option key={it.id} value={it.id}>{it.name} — {fmtQ(Number(it.quantity))} {it.unit || 'ш'} · {money(Number(it.price))}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Орлогын тоо"><Input type="number" min={0.01} step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Нэгж үнэ (₮)"><Input type="number" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        <p className="text-[13px] text-muted">Нийт дүн: <b className="text-[16px] text-ink">{money((Number(qty) || 0) * (Number(price) || 0))}</b></p>
        <Field label="Нийлүүлэгч"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
        <Field label="Тэмдэглэл" hint="Үлдэгдэл нэмэгдэж, нэгж үнэ жигнэсэн дундаж өртгөөр шинэчлэгдэнэ."><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {err ? <p className="text-[13px] text-danger" role="alert">{err}</p> : null}
        <div className="flex gap-2"><Button disabled={busy} onClick={save}>Орлого авах</Button><Button variant="outline" onClick={onClose}>Болих</Button></div>
      </div>
    </Modal>
  );
}

/** Камераар бар код уншуулах (BarcodeDetector). */
export function BarcodeScan({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const BD = (window as any).BarcodeDetector;
    if (!BD) return setErr('Энэ хөтөч камераар код уншихыг дэмждэггүй. Гараар оруулна уу.');
    let stream: MediaStream | null = null;
    let stop = false;
    const detector = new BD();
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            const r = await detector.detect(video.current);
            if (r[0]?.rawValue) return onCode(r[0].rawValue);
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
    <Modal title="Бар код уншуулах" onClose={onClose}>
      {err ? <p className="text-[13px] text-muted">{err}</p> : <video ref={video} className="w-full rounded-[var(--radius-sm)] bg-black" muted playsInline />}
    </Modal>
  );
}

/* ═══════════════════ Барааны хэрэглээ ═══════════════════ */
export function UsagePage() {
  const inv = useAsync(fetchInventory, [], []);
  const mov = useAsync(fetchMovements, [], []);
  const [tab, setTab] = useState<'balances' | 'log'>('balances');
  const [photo, setPhoto] = useState<Movement | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const catOf = useMemo(() => new Map(inv.data.map((it) => [it.id, normCat(it.category)])), [inv.data]);

  const balances = useMemo(() => {
    const by = new Map<string, { user_id: string | null; user_name: string; items: Map<string, { name: string; unit: string; cat: Cat; q: number }> }>();
    mov.data.forEach((m) => {
      const uid = m.user_id || m.user_name;
      const key = m.item_id || m.item_name;
      if (!uid || !key) return;
      if (!by.has(uid)) by.set(uid, { user_id: m.user_id, user_name: m.user_name || 'Тодорхойгүй', items: new Map() });
      const u = by.get(uid)!;
      if (!u.items.has(key)) u.items.set(key, { name: m.item_name || '—', unit: m.unit || 'ширхэг', cat: catOf.get(m.item_id || '') || 'material', q: 0 });
      u.items.get(key)!.q += delta(m);
    });
    return [...by.entries()]
      .map(([k, u]) => ({ key: k, ...u, list: [...u.items.values()].filter((it) => it.q > 0.0001) }))
      .filter((u) => u.list.length)
      .sort((a, b) => a.user_name.localeCompare(b.user_name, 'mn'));
  }, [mov.data, catOf]);
  const withdraws = mov.data.filter((m) => (m.movement_type || 'withdraw') === 'withdraw');

  const exportExcel = () => {
    const a: (string | number)[][] = [['Ажилтан', 'Бараа', 'Ангилал', 'Үлдэгдэл', 'Нэгж']];
    balances.forEach((u) => u.list.forEach((it) => a.push([u.user_name, it.name, catName(it.cat), Number(it.q.toFixed(2)), it.unit])));
    const b: (string | number)[][] = [['Огноо', 'Ажилтан', 'Бараа', 'Тоо', 'Нэгж', 'Төрөл', 'Зураг']];
    mov.data.forEach((m) => b.push([new Date(m.created_at).toLocaleString('mn-MN'), m.user_name || '', m.item_name || '', Number(m.quantity), m.unit || '', m.movement_type || 'withdraw', m.photo_url || '']));
    void downloadSheets('gennetex_baraanii_hereglee.xlsx', [{ name: 'Үлдэгдэл', rows: a }, { name: 'Хөдөлгөөн', rows: b }]);
  };
  const loading = inv.loading || mov.loading;
  const error = inv.error || mov.error;
  const sel = balances.find((u) => u.key === person);

  return (
    <>
      <PageHeader
        title="Барааны хэрэглээ"
        crumb="Агуулах"
        description="Ажилтан бар код уншуулж, хэдэн ширхэг авснаа зургаар баталгаажуулбал энд автоматаар бүртгэгдэнэ. Агуулахаас авсан − ажил дээр хэрэглэсэн = үлдэгдэл."
        actions={
          <>
            <div className="inline-flex rounded-full border border-line bg-card2 p-1" role="tablist">
              {([['balances', `Үлдэгдэл (${balances.reduce((s, u) => s + u.list.length, 0)})`], ['log', `Авсан (${withdraws.length})`]] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${tab === k ? 'bg-brand text-white' : 'text-muted'}`}>{l}</button>
              ))}
            </div>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={() => { inv.reload(); mov.reload(); }}>Шинэчлэх</Button>
            <Button icon={<Download size={15} />} onClick={exportExcel}>Excel</Button>
          </>
        }
      />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={() => { inv.reload(); mov.reload(); }} /> : tab === 'balances' ? (
        <Card title={`Ажилтны үлдэгдэл — ${balances.length} ажилтан`} bodyClassName="p-0">
          {!balances.length ? <EmptyState text="Үлдэгдэл алга." /> : (
            <table className="w-full text-[13px]">
              <thead className="bg-card2 text-left text-[12px] text-muted"><tr><th className="px-4 py-2 font-medium">Ажилтан</th><th className="px-3 py-2 font-medium">Бараа</th><th className="px-3 py-2 font-medium">Ангилал</th><th className="px-3 py-2 font-medium">Үлдэгдэл</th></tr></thead>
              <tbody className="divide-y divide-line">
                {balances.flatMap((u) => u.list.map((it, i) => (
                  <tr key={`${u.key}-${i}`} className="cursor-pointer hover:bg-hover" onClick={() => setPerson(u.key)}>
                    <td className="px-4 py-2 font-medium text-ink">{i === 0 ? u.user_name : ''}</td>
                    <td className="px-3 py-2 text-ink">{it.name}</td>
                    <td className="px-3 py-2 text-muted">{catName(it.cat)}</td>
                    <td className="px-3 py-2"><b className="text-brand">{fmtQ(Number(it.q.toFixed(2)))}</b> <span className="text-muted">{it.unit}</span></td>
                  </tr>
                )))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        (['material', 'tool'] as const).map((c) => {
          const rows = withdraws.filter((m) => (catOf.get(m.item_id || '') || 'material') === c);
          return (
            <Card key={c} className="mb-5" title={`${c === 'tool' ? 'Багаж' : 'Бараа материал'} авсан (${rows.length})`} bodyClassName="p-0">
              {!rows.length ? <EmptyState text="Бүртгэл алга." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-[13px]">
                    <thead className="bg-card2 text-left text-[12px] text-muted"><tr><th className="px-3 py-2 font-medium">Зураг</th><th className="px-3 py-2 font-medium">Ажилтан</th><th className="px-3 py-2 font-medium">Бараа / Багаж</th><th className="px-3 py-2 font-medium">Тоо</th><th className="px-3 py-2 font-medium">Огноо</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {rows.map((m) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2">{m.photo_url ? <button type="button" onClick={() => setPhoto(m)}><img src={m.photo_url} alt="Баталгаа" className="h-16 w-16 cursor-zoom-in rounded-[var(--radius-sm)] border border-line object-cover" loading="lazy" /></button> : <span className="text-muted">—</span>}</td>
                          <td className="px-3 py-2 font-medium text-ink">{m.user_name || '—'}</td>
                          <td className="px-3 py-2 text-ink">{m.item_name || '—'}</td>
                          <td className="px-3 py-2"><span className="rounded-full bg-success-soft px-2 py-0.5 text-[12px] text-success">+{m.quantity} {m.unit || 'ш'}</span></td>
                          <td className="px-3 py-2 text-muted">{new Date(m.created_at).toLocaleString('mn-MN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })
      )}
      {photo ? (
        <Modal title={`Зураг — ${photo.user_name || 'Ажилтан'}`} onClose={() => setPhoto(null)} wide>
          <a href={photo.photo_url!} target="_blank" rel="noreferrer" title="Шинэ цонхонд бүтэн хэмжээгээр">
            <img src={photo.photo_url!} alt="Авсан баталгаа" className="mx-auto max-h-[75vh] w-auto rounded-[var(--radius-sm)] object-contain" />
          </a>
          <p className="mt-3 text-[13px] text-ink"><b>{photo.item_name}</b> · +{photo.quantity} {photo.unit || 'ш'}</p>
          <p className="text-[12px] text-muted">{new Date(photo.created_at).toLocaleString('mn-MN')}</p>
        </Modal>
      ) : null}
      {sel ? (
        <Modal title={`${sel.user_name} — үлдэгдэл`} onClose={() => setPerson(null)}>
          <p className="mb-2 text-[12px] text-muted">Олголт − хэрэглээ = үлдэгдэл</p>
          {(['material', 'tool'] as const).map((c) => {
            const items = sel.list.filter((it) => (c === 'tool' ? it.cat === 'tool' : it.cat !== 'tool'));
            return (
              <div key={c} className="mb-3">
                <p className="text-[13px] font-semibold text-ink">{c === 'tool' ? 'Багаж' : 'Бараа материал'}</p>
                {items.length ? <ul className="list-disc pl-5 text-[13px]">{items.map((it, i) => <li key={i}><b>{it.name}</b> — <span className="text-brand">{fmtQ(Number(it.q.toFixed(2)))}</span> {it.unit}</li>)}</ul> : <p className="text-[12px] text-muted">Үлдэгдэл алга</p>}
              </div>
            );
          })}
        </Modal>
      ) : null}
    </>
  );
}
