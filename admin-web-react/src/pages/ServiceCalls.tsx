import { useMemo, useState } from 'react';
import { Building2, Clock, Home, PhoneCall, Plus, RefreshCw } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader, Card, Button, Input, Select, Textarea, Modal, Field, Loading, ErrorState, EmptyState, StatCard, KpiRow } from '../components/ui';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';
import { supabase } from '../lib/supabase';

/** Дуудлага — админ айл/байгууллагын дуудлагыг инженерт онооно (хуучин «servicecalls»). */

type Call = {
  id: string;
  created_at: string;
  site_kind: string | null;
  call_type: string | null;
  customer: string | null;
  phone: string | null;
  address: string | null;
  problem: string | null;
  engineer_id: string | null;
  engineer_name: string | null;
  created_by_name: string | null;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
};

const CALL_TYPES: [string, string][] = [['new', 'Шинэ айл'], ['t30', 'Шилжүүлэг 30k'], ['t100', 'Шилжүүлэг 100k'], ['gombol', 'Гомбол'], ['repair', 'Засвар'], ['other', 'Бусад']];
const typeLabel = (k: string | null) => CALL_TYPES.find(([x]) => x === k)?.[1] || 'Бусад';
const STATUSES = ['Хүлээгдэж буй', 'Явж байгаа', 'Дууссан'];
const statusClass = (s: string | null) => (s === 'Дууссан' ? 'bg-success-soft text-success' : s === 'Явж байгаа' ? 'bg-brand-soft text-brand' : 'bg-warning-soft text-warning');
const empName = (e: Employee) => [e.last_name, e.name].filter(Boolean).join(' ') || e.email || 'Ажилтан';

async function fetchCalls() {
  const { data, error } = await supabase.from('service_calls').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []) as Call[];
}

export default function ServiceCallsPage() {
  const { profile } = useOutletContext<{ profile: { id?: string; name?: string | null; email?: string | null } }>();
  const { data, loading, error, reload } = useAsync(fetchCalls, [], []);
  const { data: emps } = useAsync<Employee[]>(() => fetchEmployees().catch(() => []), [], []);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Call | null>(null);
  const [status, setStatus] = useState('');
  const engineers = useMemo(() => emps.filter((e) => e.user_id && e.role !== 'superadmin').sort((a, b) => empName(a).localeCompare(empName(b), 'mn')), [emps]);
  const list = data.filter((c) => !status || c.status === status);
  const ail = list.filter((c) => (c.site_kind || 'ail') === 'ail');
  const org = list.filter((c) => c.site_kind === 'baiguulga');

  const table = (title: string, rows: Call[]) => (
    <Card className="mb-5" title={`${title} (${rows.length})`} bodyClassName="p-0">
      {!rows.length ? <EmptyState text="Дуудлага алга." /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead className="bg-card2 text-left text-[12px] text-muted">
              <tr>{['Захиалагч', 'Утас / Хаяг', 'Юу болохгүй байгаа', 'Инженер', 'Илгээсэн', 'Үйлчилгээ', 'Төлөв'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="cursor-pointer align-top hover:bg-hover" onClick={() => setOpen(c)}>
                  <td className="px-3 py-2 font-medium text-ink">{c.customer || '—'}</td>
                  <td className="px-3 py-2 text-ink">{c.phone || '—'}<br /><span className="text-[12px] text-muted">{c.address || '—'}</span></td>
                  <td className="max-w-[260px] px-3 py-2 text-ink">{c.problem || '—'}</td>
                  <td className="px-3 py-2 text-ink">{c.engineer_name || '—'}</td>
                  <td className="px-3 py-2 text-[12px] text-muted">{c.created_by_name || '—'}<br />{new Date(c.created_at).toLocaleDateString('mn-MN')}</td>
                  <td className="px-3 py-2 text-ink">{typeLabel(c.call_type)}</td>
                  <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] ${statusClass(c.status)}`}>{c.status || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Дуудлага"
        crumb="Дуудлага"
        description="Айл эсвэл байгууллагын дуудлагыг бүртгэж инженерт онооно. Инженерт апп-аар мэдэгдэл очно."
        actions={
          <>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Төлөв">
              <option value="">Бүх төлөв</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>
            <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>Дуудлага бүртгэх</Button>
          </>
        }
      />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : (
        <>
          <KpiRow>
            <StatCard tone="green" icon={<PhoneCall size={19} />} value={data.length} label="Нийт дуудлага" />
            <StatCard tone="blue" icon={<Home size={19} />} value={data.filter((c) => (c.site_kind || 'ail') === 'ail').length} label="Айл" />
            <StatCard tone="violet" icon={<Building2 size={19} />} value={data.filter((c) => c.site_kind === 'baiguulga').length} label="Байгууллага" />
            <StatCard tone="amber" icon={<Clock size={19} />} value={data.filter((c) => c.status !== 'Дууссан').length} label="Хүлээгдэж буй" />
          </KpiRow>
          {table('Айл дээрх дуудлага', ail)}
          {table('Байгууллага дээрх дуудлага', org)}
        </>
      )}
      {creating ? <NewCall engineers={engineers} me={profile} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} /> : null}
      {open ? <CallDetail call={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); reload(); }} /> : null}
    </>
  );
}

function NewCall({ engineers, me, onClose, onSaved }: { engineers: Employee[]; me: { id?: string; name?: string | null; email?: string | null }; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ site: 'ail', eng: '', type: 'other', customer: '', phone: '', address: '', problem: '', lat: '', lng: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    if (!f.eng || !f.customer.trim()) return setErr('Инженер болон захиалагчийн нэр шаардлагатай.');
    if (!f.phone.trim()) return setErr('Утасны дугаар шаардлагатай.');
    if (!f.problem.trim()) return setErr('«Юу болохгүй байгаа» тайлбар шаардлагатай.');
    const eng = engineers.find((e) => e.user_id === f.eng);
    setBusy(true);
    setErr('');
    const { data: created, error } = await supabase.from('service_calls').insert({
      engineer_id: f.eng, engineer_name: eng?.name || '', site_kind: f.site, call_type: f.type, customer: f.customer.trim(),
      phone: f.phone.trim(), address: f.address.trim() || null, problem: f.problem.trim(),
      latitude: Number(f.lat) || 47.9185, longitude: Number(f.lng) || 106.9176, status: 'Хүлээгдэж буй',
      created_by: me.id, created_by_name: me.name || me.email || 'Админ',
    }).select('id').single();
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    await supabase.functions.invoke('send-push', {
      body: {
        audience: { kind: 'users', userIds: [f.eng] },
        notification: {
          type: 'service_call',
          title: `${eng?.name || 'Ажилтан'}, танд шинээр дуудлага ирлээ`,
          body: `${f.site === 'baiguulga' ? 'Байгууллага' : 'Айл'}: ${f.customer} · ${f.problem} · ${f.phone}`,
          data: { type: 'service_call', siteKind: f.site, callId: created?.id },
        },
      },
    }).catch(() => null);
    setBusy(false);
    onSaved();
  };
  return (
    <Modal title="Шинэ дуудлага бүртгэх" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Айл / Байгууллага *"><Select className="w-full" value={f.site} onChange={set('site')}><option value="ail">Айл</option><option value="baiguulga">Байгууллага</option></Select></Field>
          <Field label="Үйлчилгээ"><Select className="w-full" value={f.type} onChange={set('type')}>{CALL_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        </div>
        <Field label="Инженер *">
          <Select className="w-full" value={f.eng} onChange={set('eng')}>
            <option value="">— Сонгох —</option>
            {engineers.map((e) => <option key={e.user_id!} value={e.user_id!}>{empName(e)}{e.role && e.role !== 'employee' ? ` (${e.role})` : ''}</option>)}
          </Select>
        </Field>
        <Field label="Захиалагчийн нэр *"><Input value={f.customer} onChange={set('customer')} placeholder="Айл / байгууллагын нэр" /></Field>
        <Field label="Утасны дугаар *"><Input value={f.phone} onChange={set('phone')} placeholder="99112233" inputMode="tel" /></Field>
        <Field label="Хаяг"><Input value={f.address} onChange={set('address')} /></Field>
        <Field label="Юу болохгүй байгаа *"><Textarea rows={3} value={f.problem} onChange={set('problem')} placeholder="Жишээ: Интернет ажиллахгүй, ONU гэрэл асахгүй…" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Өргөрөг"><Input value={f.lat} onChange={set('lat')} placeholder="47.9185" /></Field>
          <Field label="Уртраг"><Input value={f.lng} onChange={set('lng')} placeholder="106.9176" /></Field>
        </div>
        {err ? <p className="text-[13px] text-danger" role="alert">{err}</p> : null}
        <div className="flex gap-2"><Button disabled={busy} onClick={save}>{busy ? 'Хадгалж байна…' : 'Оноох'}</Button><Button variant="outline" onClick={onClose}>Болих</Button></div>
      </div>
    </Modal>
  );
}

function CallDetail({ call, onClose, onSaved }: { call: Call; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(call.status || STATUSES[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('service_calls').update({ status, updated_at: new Date().toISOString() }).eq('id', call.id);
    setBusy(false);
    if (error) setErr(error.message);
    else onSaved();
  };
  const rows: [string, string][] = [
    ['Айл / Байгууллага', call.site_kind === 'baiguulga' ? 'Байгууллага' : 'Айл'], ['Инженер', call.engineer_name || '—'], ['Илгээсэн админ', call.created_by_name || '—'],
    ['Үйлчилгээ', typeLabel(call.call_type)], ['Утас', call.phone || '—'], ['Хаяг', call.address || '—'], ['Юу болохгүй байгаа', call.problem || '—'],
    ['Бүртгэсэн', new Date(call.created_at).toLocaleString('mn-MN')],
  ];
  return (
    <Modal title={`Дуудлага — ${call.customer || ''}`} onClose={onClose}>
      <dl className="mb-4 space-y-1.5 text-[13px]">
        {rows.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-36 shrink-0 text-muted">{k}</dt><dd className="text-ink">{v}</dd></div>)}
        {call.latitude != null ? <div className="flex gap-2"><dt className="w-36 shrink-0 text-muted">Байршил</dt><dd><a className="text-brand underline" href={`https://www.google.com/maps?q=${call.latitude},${call.longitude}`} target="_blank" rel="noreferrer">Газрын зураг</a></dd></div> : null}
      </dl>
      <Field label="Төлөв өөрчлөх"><Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      {err ? <p className="mt-2 text-[13px] text-danger" role="alert">{err}</p> : null}
      <div className="mt-3 flex gap-2"><Button disabled={busy} onClick={save}>Хадгалах</Button><Button variant="outline" onClick={onClose}>Хаах</Button></div>
    </Modal>
  );
}
