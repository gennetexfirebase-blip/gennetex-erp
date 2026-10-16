import { useState } from 'react';
import { Download, Plus, RefreshCw, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, Modal, Field, Avatar, Loading, ErrorState, EmptyState } from '../components/ui';
import { useAsync } from '../lib/data';
import { supabase } from '../lib/supabase';
import { downloadSheets } from '../lib/attendanceExport';

/**
 * sanhuu.gennetex.com — Хоолны мөнгө.
 *
 * Хуримтлагдсан = ажилласан өдөр × өдрийн хоолны мөнгө (ирцээс автоматаар).
 * Админ «Нөхөж авсан» (өнгөрсөн өдрүүдийнх) ба «Түрүүлж авсан» (урьдчилгаа)
 * олголтыг бүртгэнэ. Үлдэгдэл хасах бол урьдчилгаа хараахан нөхөгдөөгүй.
 */

type Row = {
  id: string; name: string; department: string | null; avatar_url: string | null; allowance: number | null;
  earned: number; month_days: number; month_earned: number; catchup: number; advance: number; adjust: number;
};
type Ledger = { id: string; kind: 'catchup' | 'advance' | 'adjust'; amount: number; d: string; note: string | null; by: string | null; at: string };
type Detail = { days: { d: string; h: number; a: number }[]; ledger: Ledger[] };

const money = (n: number) => `${new Intl.NumberFormat('mn-MN').format(Math.round(n || 0))}₮`;
const KIND: Record<Ledger['kind'], string> = { catchup: 'Нөхөж авсан', advance: 'Түрүүлж авсан', adjust: 'Залруулга' };
const balanceOf = (r: { earned: number; adjust: number; catchup: number; advance: number }) => Number(r.earned) + Number(r.adjust) - Number(r.catchup) - Number(r.advance);
const today = () => {
  const n = new Date();
  return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

async function rpc<T>(name: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(/forbidden/.test(error.message) ? 'Зөвхөн админ.' : error.message);
  return data as T;
}

export default function MealMoneyPage() {
  const { data, loading, error, reload } = useAsync(() => rpc<Row[]>('meal_overview'), [], []);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Row | null>(null);
  const list = data.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const sum = (f: (r: Row) => number) => list.reduce((a, r) => a + f(r), 0);

  const exportExcel = () => {
    const rows: (string | number)[][] = [['Ажилтан', 'Хэлтэс', 'Өдрийн хоолны мөнгө', 'Энэ сарын өдөр', 'Энэ сарын хуримтлал', 'Нийт хуримтлагдсан', 'Нөхөж авсан', 'Түрүүлж авсан', 'Залруулга', 'Үлдэгдэл']];
    list.forEach((r) => rows.push([r.name, r.department || '', Number(r.allowance || 0), r.month_days, Math.round(r.month_earned), Math.round(r.earned), Math.round(r.catchup), Math.round(r.advance), Math.round(r.adjust), Math.round(balanceOf(r))]));
    void downloadSheets(`gennetex_hoolnii_mongo_${today()}.xlsx`, [{ name: 'Хоолны мөнгө', rows }]);
  };

  return (
    <>
      <PageHeader
        title="Хоолны мөнгө"
        crumb="Санхүү"
        description="Ажилласан өдөр бүрт хоолны мөнгө автоматаар хуримтлагдана. Ажилтан дээр дарж бүх түүх, нөхөж авах, түрүүлж авахыг бүртгэнэ. Өдрийн хоолны мөнгийг «Цалин» хэсгээс тохируулна."
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>
            <Button icon={<Download size={15} />} disabled={!list.length} onClick={exportExcel}>Excel</Button>
          </>
        }
      />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([['Энэ сарын хуримтлал', money(sum((r) => Number(r.month_earned)))], ['Нийт олгосон', money(sum((r) => Number(r.catchup) + Number(r.advance)))], ['Олгох үлдэгдэл', money(sum((r) => Math.max(0, balanceOf(r))))], ['Урьдчилгаа (нөхөгдөөгүй)', money(sum((r) => Math.max(0, -balanceOf(r))))]] as const).map(([k, v]) => (
              <div key={k} className="surface p-4"><p className="text-[12px] text-muted">{k}</p><p className="mt-1 text-[20px] font-semibold text-ink">{v}</p></div>
            ))}
          </div>
          <Card
            title={`Ажилтнууд (${list.length})`}
            icon={<UtensilsCrossed size={17} />}
            bodyClassName="p-0"
            actions={
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
                <Input placeholder="Нэрээр хайх" value={q} onChange={(e) => setQ(e.target.value)} className="w-44 pl-8" />
              </div>
            }
          >
            {!list.length ? <EmptyState text="Ажилтан олдсонгүй." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-[13px]">
                  <thead className="bg-card2 text-left text-[12px] text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Ажилтан</th>
                      <th className="px-3 py-2 font-medium">Өдөрт</th>
                      <th className="px-3 py-2 text-right font-medium">Энэ сар</th>
                      <th className="px-3 py-2 text-right font-medium">Нийт хуримтлагдсан</th>
                      <th className="px-3 py-2 text-right font-medium">Нөхөж авсан</th>
                      <th className="px-3 py-2 text-right font-medium">Түрүүлж авсан</th>
                      <th className="px-3 py-2 text-right font-medium">Үлдэгдэл</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {list.map((r) => {
                      const b = balanceOf(r);
                      return (
                        <tr key={r.id} className="cursor-pointer hover:bg-hover" onClick={() => setOpen(r)}>
                          <td className="px-4 py-2">
                            <span className="flex items-center gap-2.5">
                              <Avatar name={r.name} src={r.avatar_url} size={28} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink">{r.name || 'Ажилтан'}</span>
                                <span className="block truncate text-[12px] text-muted">{r.department || 'Хэлтэсгүй'}</span>
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-ink">{r.allowance ? money(r.allowance) : <span className="text-[12px] text-warning">Тохируулаагүй</span>}</td>
                          <td className="px-3 py-2 text-right text-ink">{money(r.month_earned)} <span className="text-[11px] text-muted">({r.month_days} өдөр)</span></td>
                          <td className="px-3 py-2 text-right text-ink">{money(r.earned)}</td>
                          <td className="px-3 py-2 text-right text-ink">{Number(r.catchup) ? money(r.catchup) : '—'}</td>
                          <td className="px-3 py-2 text-right text-ink">{Number(r.advance) ? money(r.advance) : '—'}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${b < 0 ? 'text-danger' : 'text-ink'}`}>{money(b)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
      {open ? <EmployeeMeal row={open} onClose={() => setOpen(null)} onChanged={reload} /> : null}
    </>
  );
}

function EmployeeMeal({ row, onClose, onChanged }: { row: Row; onClose: () => void; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<Detail | null>(() => rpc<Detail>('meal_employee', { p_user: row.id }), [row.id], null);
  const [form, setForm] = useState<Ledger['kind'] | null>(null);
  const [tab, setTab] = useState<'ledger' | 'days'>('ledger');
  const earned = (data?.days || []).reduce((a, d) => a + Number(d.a), 0);
  const sumKind = (k: Ledger['kind']) => (data?.ledger || []).filter((l) => l.kind === k).reduce((a, l) => a + Number(l.amount), 0);
  const balance = earned + sumKind('adjust') - sumKind('catchup') - sumKind('advance');
  const refresh = () => {
    reload();
    onChanged();
  };
  const remove = async (l: Ledger) => {
    if (!window.confirm(`${KIND[l.kind]} ${money(l.amount)} (${l.d})-ийг устгах уу?`)) return;
    try {
      await rpc('meal_delete', { p_id: l.id });
      refresh();
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  return (
    <Modal title={`${row.name} — хоолны мөнгө`} onClose={onClose} wide>
      {loading && !data ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([['Хуримтлагдсан', earned], ['Нөхөж авсан', sumKind('catchup')], ['Түрүүлж авсан', sumKind('advance')], ['Үлдэгдэл', balance]] as const).map(([k, v]) => (
              <div key={k} className="rounded-[var(--radius-sm)] border border-line bg-card2 p-3">
                <p className="text-[12px] text-muted">{k}</p>
                <p className={`text-[17px] font-semibold ${k === 'Үлдэгдэл' && v < 0 ? 'text-danger' : 'text-ink'}`}>{money(v)}</p>
              </div>
            ))}
          </div>
          <p className="mb-3 text-[12px] text-muted">
            {balance >= 0 ? `Ажилтанд ${money(balance)} олгох үлдэгдэлтэй.` : `Ажилтан ${money(-balance)} урьдчилж авсан — цаашдын ажилласан өдрүүдээр нөхөгдөнө.`}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button icon={<Plus size={14} />} onClick={() => setForm('catchup')}>Нөхөж авах</Button>
            <Button variant="outline" icon={<Plus size={14} />} onClick={() => setForm('advance')}>Түрүүлж авах</Button>
            <Button variant="ghost" onClick={() => setForm('adjust')}>Залруулга</Button>
          </div>

          <div className="mb-2 inline-flex rounded-full border border-line bg-card2 p-1" role="tablist">
            {([['ledger', `Олголт (${data?.ledger.length || 0})`], ['days', `Ажилласан өдөр (${data?.days.length || 0})`]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${tab === k ? 'bg-brand text-white' : 'text-muted'}`}>{l}</button>
            ))}
          </div>

          {tab === 'ledger' ? (
            !data?.ledger.length ? <EmptyState text="Олголт бүртгэгдээгүй." /> : (
              <table className="w-full text-[13px]">
                <thead className="text-left text-[12px] text-muted"><tr><th className="py-1.5 font-medium">Огноо</th><th className="py-1.5 font-medium">Төрөл</th><th className="py-1.5 text-right font-medium">Дүн</th><th className="py-1.5 font-medium">Тэмдэглэл</th><th /></tr></thead>
                <tbody className="divide-y divide-line">
                  {data.ledger.map((l) => (
                    <tr key={l.id}>
                      <td className="py-1.5 text-ink">{l.d}</td>
                      <td className="py-1.5"><span className={`rounded-full px-2 py-0.5 text-[12px] ${l.kind === 'advance' ? 'bg-warning-soft text-warning' : l.kind === 'catchup' ? 'bg-success-soft text-success' : 'bg-card2 text-muted'}`}>{KIND[l.kind]}</span></td>
                      <td className="py-1.5 text-right font-medium text-ink">{money(l.amount)}</td>
                      <td className="py-1.5 text-[12px] text-muted">{l.note || ''}{l.by ? ` · ${l.by}` : ''}</td>
                      <td className="py-1.5 text-right"><Button variant="ghost" className="!min-h-7 !px-1.5 hover:!text-danger" aria-label="Устгах" onClick={() => remove(l)}><Trash2 size={14} /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : !data?.days.length ? <EmptyState text="Ажилласан өдөр алга." /> : (
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-card text-left text-[12px] text-muted"><tr><th className="py-1.5 font-medium">Огноо</th><th className="py-1.5 text-right font-medium">Цаг</th><th className="py-1.5 text-right font-medium">Хоолны мөнгө</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {data.days.map((d) => (
                    <tr key={d.d}><td className="py-1.5 text-ink">{d.d}</td><td className="py-1.5 text-right text-muted">{Number(d.h).toFixed(1)}</td><td className="py-1.5 text-right text-ink">{Number(d.a) ? money(d.a) : <span className="text-[12px] text-warning">тохируулаагүй</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {form ? <LedgerForm user={row} kind={form} suggested={form === 'catchup' ? Math.max(0, balance) : row.allowance ? Number(row.allowance) * 5 : 0} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} /> : null}
        </>
      )}
    </Modal>
  );
}

function LedgerForm({ user, kind, suggested, onClose, onSaved }: { user: Row; kind: Ledger['kind']; suggested: number; onClose: () => void; onSaved: () => void }) {
  const [k, setK] = useState(kind);
  const [amount, setAmount] = useState(suggested ? String(Math.round(suggested)) : '');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    const a = Number(amount);
    if (!Number.isFinite(a) || a === 0 || (k !== 'adjust' && a < 0)) return setErr(k === 'adjust' ? 'Залруулга 0 биш байна (хасах бол «-»).' : '0-ээс их дүн оруулна уу.');
    setBusy(true);
    setErr('');
    try {
      await rpc('meal_record', { p_user: user.id, p_kind: k, p_amount: a, p_date: date, p_note: note });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal title={`${user.name} — ${KIND[k]}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Төрөл">
          <Select className="w-full" value={k} onChange={(e) => setK(e.target.value as Ledger['kind'])}>
            <option value="catchup">Нөхөж авах — хуримтлагдсанаас олгох</option>
            <option value="advance">Түрүүлж авах — урьдчилгаа</option>
            <option value="adjust">Залруулга (+/−)</option>
          </Select>
        </Field>
        <Field label="Дүн (₮)" hint={k === 'catchup' && suggested ? `Одоогийн үлдэгдэл ${money(suggested)}` : undefined}>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Огноо"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Тэмдэглэл (заавал биш)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {err ? <p className="text-[13px] text-danger" role="alert">{err}</p> : null}
        <div className="flex gap-2"><Button disabled={busy} onClick={save}>{busy ? 'Хадгалж байна…' : 'Бүртгэх'}</Button><Button variant="outline" onClick={onClose}>Болих</Button></div>
      </div>
    </Modal>
  );
}
