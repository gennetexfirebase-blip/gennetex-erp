import { useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Copy, Eye, FileSignature, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { PageHeader, Card, Badge, Button, EmptyState, ErrorState, Input, Loading, Select } from '../components/ui';
import ContractPdfView from '../components/ContractPdfView';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';
import {
  STATUS_LABEL,
  contractUrl,
  defaultFields,
  deleteContract,
  directorStampUrl,
  fetchContracts,
  saveContract,
  sendContract,
  signatureUrl,
  type Contract,
  type ContractFields,
  type ContractInput,
} from '../lib/contracts';
import type { ContractImages } from '../lib/contractPdf';

type Profile = { id?: string | null; name?: string | null; role?: string | null };

const TONE: Record<Contract['status'], 'neutral' | 'warning' | 'brand' | 'success' | 'danger'> = {
  draft: 'neutral',
  sent: 'warning',
  signed: 'brand',
  approved: 'success',
  returned: 'danger',
};

const FIELD_LABELS: [keyof ContractFields, string, string?][] = [
  ['contract_date', 'Гэрээний огноо', 'date'],
  ['register_no', 'Регистрийн дугаар'],
  ['phone', 'Утас'],
  ['address', 'Оршин суугаа хаяг'],
  ['work_unit', '1.1 Ажил үүргээ гүйцэтгэх газар'],
  ['duties', '1.2 Гүйцэтгэх үндсэн үүрэг'],
  ['office', '1.3 Ажлын газрын байршил'],
  ['salary', '1.4 Сарын ажил гүйцэтгэлийн хэмжээ'],
  ['bonus', '1.5 Нэмэгдэл хөлс, урамшуулал'],
  ['term', '1.13 Гэрээний хугацаа'],
];

const emptyInput = (): ContractInput => ({ employee_id: null, employee_email: '', family_name: '', given_name: '', fields: defaultFields() });

/** Хөдөлмөрийн (ажил гүйцэтгэх) гэрээ — бөглөх, ажилтанд илгээх. */
export default function ContractsPage({ profile: given }: { profile?: Profile } = {}) {
  // Admin Layout дотор Outlet-оос, geree.gennetex.com дээр props-оор ирнэ.
  const outlet = useOutletContext<{ profile: Profile } | null>();
  const profile = given || outlet?.profile;
  const canEdit = ['admin', 'superadmin'].includes(String(profile?.role || ''));

  const { data: contracts, loading, error, reload } = useAsync<Contract[]>(fetchContracts, [], []);
  const { data: employees } = useAsync<Employee[]>(() => fetchEmployees().catch(() => []), [], []);

  const [filter, setFilter] = useState<'all' | Contract['status']>('all');
  const [editing, setEditing] = useState<{ id: string | null; input: ContractInput } | null>(null);
  const [preview, setPreview] = useState<{ contract: Contract; images: ContractImages } | null>(null);
  const [busy, setBusy] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const shown = useMemo(() => contracts.filter((c) => filter === 'all' || c.status === filter), [contracts, filter]);
  const people = useMemo(
    () => employees.filter((e) => e.email).sort((a, b) => `${a.last_name || ''}${a.name || ''}`.localeCompare(`${b.last_name || ''}${b.name || ''}`, 'mn')),
    [employees]
  );

  const pickEmployee = (recordId: string) => {
    const e = people.find((x) => x.record_id === recordId);
    if (!e || !editing) return;
    setEditing({
      ...editing,
      input: {
        ...editing.input,
        employee_id: e.user_id,
        employee_email: e.email || '',
        family_name: e.last_name || '',
        given_name: e.name || '',
        fields: { ...editing.input.fields, phone: editing.input.fields.phone || e.phone || '' },
      },
    });
  };

  const openPreview = async (c: Contract) => {
    setNotice('');
    const [sig, dir] = await Promise.all([signatureUrl(c.employee_signature_path), directorStampUrl().catch(() => ({ stamp: '', signature: '' }))]);
    setPreview({ contract: c, images: { employeeSignature: sig, directorStamp: dir.stamp, directorSignature: dir.signature } });
  };

  // Бөглөж буй гэрээг хадгалахгүйгээр PDF-ээр харах.
  const previewDraft = () => {
    if (!editing) return;
    const now = new Date().toISOString();
    setPreview({
      contract: {
        id: editing.id || 'draft',
        contract_number: contracts.find((c) => c.id === editing.id)?.contract_number || 0,
        slug: '',
        employee_id: editing.input.employee_id,
        employee_email: editing.input.employee_email,
        family_name: editing.input.family_name,
        given_name: editing.input.given_name || '________',
        fields: editing.input.fields,
        status: 'draft',
        employee_signature_path: null,
        employee_signed_at: null,
        director_note: null,
        approved_at: null,
        sent_at: null,
        created_by: null,
        created_by_name: null,
        created_at: now,
        updated_at: now,
      },
      images: {},
    });
  };

  const save = async (andSend: boolean, event?: FormEvent) => {
    event?.preventDefault();
    if (!editing || busy) return;
    const { input } = editing;
    if (!input.given_name.trim()) return setFormError('Ажилтны нэрийг оруулна уу.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.employee_email.trim())) return setFormError('Ажилтны имэйл хаяг буруу байна.');
    if (andSend && !input.fields.register_no.trim()) return setFormError('Илгээхийн өмнө регистрийн дугаарыг оруулна уу.');
    setBusy('save');
    setFormError('');
    try {
      const saved = await saveContract(editing.id, input, { id: profile?.id, name: profile?.name });
      if (andSend) {
        await sendContract(saved.id);
        setNotice(`№${saved.contract_number} гэрээг ${saved.employee_email} хаяг руу илгээлээ.`);
      } else {
        setNotice(`№${saved.contract_number} гэрээ хадгалагдлаа.`);
      }
      setEditing(null);
      setPreview(null);
      await reload();
    } catch (e: any) {
      setFormError(e?.message || 'Хадгалж чадсангүй.');
      await reload();
    } finally {
      setBusy('');
    }
  };

  const send = async (c: Contract) => {
    if (!window.confirm(`№${c.contract_number} гэрээг ${c.employee_email} руу илгээх үү?`)) return;
    setBusy(c.id);
    try {
      await sendContract(c.id);
      setNotice(`№${c.contract_number} гэрээг ${c.employee_email} руу илгээлээ.`);
      await reload();
    } catch (e: any) {
      window.alert(e?.message || 'Илгээж чадсангүй.');
      await reload();
    } finally {
      setBusy('');
    }
  };

  const remove = async (c: Contract) => {
    if (!window.confirm(`№${c.contract_number} (${c.given_name}) гэрээг устгах уу?`)) return;
    try {
      await deleteContract(c.id);
      if (preview?.contract.id === c.id) setPreview(null);
      await reload();
    } catch (e: any) {
      window.alert(e?.message || 'Устгаж чадсангүй.');
    }
  };

  const copyLink = async (c: Contract) => {
    await navigator.clipboard.writeText(contractUrl(c.slug)).catch(() => {});
    setNotice(`Холбоос хуулагдлаа: ${contractUrl(c.slug)}`);
  };

  const editable = (c: Contract) => c.status === 'draft' || c.status === 'returned';

  return (
    <>
      <PageHeader
        title="Хөдөлмөрийн гэрээ"
        crumb="Баримт бичиг / Хөдөлмөрийн гэрээ"
        actions={
          canEdit ? (
            <Button icon={<Plus size={15} />} onClick={() => { setFormError(''); setPreview(null); setEditing({ id: null, input: emptyInput() }); }}>
              Шинэ гэрээ
            </Button>
          ) : null
        }
      />

      {notice ? (
        <div className="mb-4 rounded-[var(--radius)] border border-brand bg-brand-soft px-4 py-3 text-[13px] text-ink" role="status">
          {notice}
        </div>
      ) : null}

      {editing ? (
        <Card
          title={editing.id ? 'Гэрээ засах' : 'Шинэ гэрээ'}
          icon={<FileSignature size={17} />}
          className="mb-4"
          actions={<Button variant="ghost" className="!px-2" aria-label="Хаах" onClick={() => setEditing(null)}><X size={16} /></Button>}
        >
          <form onSubmit={(e) => save(false, e)} className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-[13px] text-ink md:col-span-2">
              <span>Ажилтан сонгох</span>
              <Select className="w-full" value="" onChange={(e) => pickEmployee(e.target.value)}>
                <option value="">— Ажилтны жагсаалтаас сонгох (нэр, имэйл автоматаар бөглөгдөнө) —</option>
                {people.map((e) => (
                  <option key={e.record_id} value={e.record_id}>
                    {[e.last_name, e.name].filter(Boolean).join(' ')} · {e.email}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-[13px] text-ink">
              <span>Овог</span>
              <Input value={editing.input.family_name} onChange={(e) => setEditing((s) => s && { ...s, input: { ...s.input, family_name: e.target.value } })} />
            </label>
            <label className="space-y-1 text-[13px] text-ink">
              <span>Нэр</span>
              <Input value={editing.input.given_name} onChange={(e) => setEditing((s) => s && { ...s, input: { ...s.input, given_name: e.target.value } })} />
            </label>
            <label className="space-y-1 text-[13px] text-ink md:col-span-2">
              <span>Имэйл (гэрээ байгуулах хүсэлт энэ хаяг руу очно)</span>
              <Input type="email" value={editing.input.employee_email} onChange={(e) => setEditing((s) => s && { ...s, input: { ...s.input, employee_email: e.target.value } })} />
            </label>
            {FIELD_LABELS.map(([key, label, type]) => (
              <label key={key} className={`space-y-1 text-[13px] text-ink ${['work_unit', 'duties', 'bonus', 'address'].includes(key) ? 'md:col-span-2' : ''}`}>
                <span>{label}</span>
                <Input
                  type={type || 'text'}
                  value={editing.input.fields[key]}
                  onChange={(e) => setEditing((s) => s && { ...s, input: { ...s.input, fields: { ...s.input.fields, [key]: e.target.value } } })}
                />
              </label>
            ))}
            <p className="text-[12px] text-muted md:col-span-2">Бусад заалт (1.7–1.14, 2–5-р зүйл, Хавсралт-1 SLA ба KPI) нь «ХӨДӨЛМӨРИЙН ГЭРЭЭ ЖЕННЕТЕКС ХХК» загвартай ижил тогтмол.</p>
            {formError ? <p className="text-[13px] text-danger md:col-span-2" role="alert">{formError}</p> : null}
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="button" variant="outline" icon={<Eye size={15} />} onClick={previewDraft}>Урьдчилан харах</Button>
              <Button type="submit" variant="outline" disabled={!!busy}>Хадгалах</Button>
              <Button type="button" icon={<Send size={15} />} disabled={!!busy} onClick={() => save(true)}>
                {busy === 'save' ? 'Илгээж байна…' : 'Хадгалаад илгээх'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {preview ? (
        <Card
          title={`Гэрээ${preview.contract.contract_number ? ` №${preview.contract.contract_number}` : ''} — ${preview.contract.given_name}`}
          icon={<Eye size={17} />}
          className="mb-4"
          actions={<Button variant="ghost" className="!px-2" aria-label="Хаах" onClick={() => setPreview(null)}><X size={16} /></Button>}
        >
          <ContractPdfView contract={preview.contract} images={preview.images} />
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(['all', 'draft', 'sent', 'signed', 'approved', 'returned'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`focus-ring rounded-full px-4 py-2 text-[13px] font-semibold transition ${filter === k ? 'bg-brand text-white' : 'bg-card text-muted hover:bg-hover'}`}
          >
            {k === 'all' ? `Бүгд · ${contracts.length}` : `${STATUS_LABEL[k]} · ${contracts.filter((c) => c.status === k).length}`}
          </button>
        ))}
      </div>

      <Card title="Гэрээнүүд" icon={<FileSignature size={17} />}>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState text={error} onRetry={reload} />
        ) : shown.length === 0 ? (
          <EmptyState text={canEdit ? 'Гэрээ алга. «Шинэ гэрээ»-ээр эхлүүлнэ үү.' : 'Гэрээ алга.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase text-subtle">
                  <th className="px-3 py-3 font-semibold">№</th>
                  <th className="px-3 py-3 font-semibold">Ажилтан</th>
                  <th className="px-3 py-3 font-semibold">Төлөв</th>
                  <th className="px-3 py-3 font-semibold">Огноо</th>
                  <th className="px-3 py-3 text-right font-semibold">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className="border-b border-line text-[13px] hover:bg-hover">
                    <td className="px-3 py-3 font-semibold text-ink">{c.contract_number}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-ink">{[c.family_name, c.given_name].filter(Boolean).join(' ')}</div>
                      <div className="text-[12px] text-muted">{c.employee_email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                      {c.status === 'returned' && c.director_note ? <div className="mt-1 text-[12px] text-danger">{c.director_note}</div> : null}
                    </td>
                    <td className="px-3 py-3 text-muted">{c.fields.contract_date}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="!min-h-8 !px-2" title="PDF харах" aria-label="PDF харах" onClick={() => openPreview(c)}><Eye size={15} /></Button>
                        {c.status !== 'draft' ? (
                          <Button variant="ghost" className="!min-h-8 !px-2" title="Холбоос хуулах" aria-label="Холбоос хуулах" onClick={() => copyLink(c)}><Copy size={15} /></Button>
                        ) : null}
                        {canEdit && editable(c) ? (
                          <>
                            <Button variant="ghost" className="!min-h-8 !px-2" title="Засах" aria-label="Засах" onClick={() => { setFormError(''); setPreview(null); setEditing({ id: c.id, input: { employee_id: c.employee_id, employee_email: c.employee_email, family_name: c.family_name || '', given_name: c.given_name, fields: c.fields } }); }}><Pencil size={15} /></Button>
                            <Button variant="ghost" className="!min-h-8 !px-2" title="Илгээх" aria-label="Илгээх" disabled={busy === c.id} onClick={() => send(c)}><Send size={15} /></Button>
                          </>
                        ) : null}
                        {canEdit && c.status !== 'approved' ? (
                          <Button variant="ghost" className="!min-h-8 !px-2 hover:!text-danger" title="Устгах" aria-label="Устгах" onClick={() => remove(c)}><Trash2 size={15} /></Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
