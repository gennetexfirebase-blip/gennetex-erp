import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { actError, deleteActReceiverContact, fetchActReceiverContacts, fetchActTemplates, saveActReceiverContact, saveActTemplate, type ActReceiverContact, type ActTemplate } from '../lib/acts';
import { Button, Card, Input, Loading, PageHeader, Select, Textarea } from '../components/ui';

const blankTemplate: Partial<ActTemplate> = {
  name: '', title: 'Ажил гүйцэтгэлийн акт', company: 'Женнетекс ХХК', logo_url: '', project_types: ['general'],
  configuration: { fields: ['location','contractor_name','customer_name','work_description','start_date','end_date'], checklist: [], signature_sections: ['customer','site','contractor'] },
  photo_layout: 1, footer_text: 'Ажил хүлээлцэх акт', is_default: false,
};

export default function ActTemplatesPage() {
  const navigate = useNavigate();
  const { profile } = useOutletContext<{ profile: { role?: string } }>();
  const isSuperAdmin = profile?.role === 'superadmin';
  const [templates, setTemplates] = useState<ActTemplate[]>([]);
  const [value, setValue] = useState<Partial<ActTemplate>>(blankTemplate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [checklistText, setChecklistText] = useState('');

  const load = async () => {
    setLoading(true);
    try { const rows = await fetchActTemplates(); setTemplates(rows); if (rows[0]) select(rows[0]); }
    catch (cause) { setToast(actError(cause)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2500); return () => clearTimeout(timer); }, [toast]);

  const select = (template: ActTemplate) => { setValue(template); setChecklistText((template.configuration?.checklist || []).join('\n')); };
  const create = () => { setValue({ ...blankTemplate, configuration: { ...blankTemplate.configuration, checklist: [] } }); setChecklistText(''); };
  const save = async () => {
    if (!value.name?.trim()) { setToast('Загварын нэр оруулна уу.'); return; }
    setSaving(true);
    try {
      const payload = { ...value, project_types: value.project_types || [], configuration: { ...value.configuration, checklist: checklistText.split('\n').map((row) => row.trim()).filter(Boolean) } };
      const id = await saveActTemplate(value.id, payload);
      setToast('Загвар хадгалагдлаа');
      const rows = await fetchActTemplates(); setTemplates(rows); const current = rows.find((row) => row.id === id); if (current) select(current);
    } catch (cause) { setToast(actError(cause)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Актын загварууд" crumb="Тохиргоо / Баримт бичиг" description="Төслийн төрөл бүрийн checklist, зураглал болон баримтын үндсэн мэдээллийг тохируулна." actions={<><Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/admin/documents/acts')}>Актын жагсаалт</Button><Button icon={<Plus size={16} />} onClick={create}>Шинэ загвар</Button></>} />
      {loading ? <Loading /> : <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <Card title="Загварын жагсаалт" bodyClassName="!p-2"><div className="space-y-1">{templates.map((template) => <button key={template.id} onClick={() => select(template)} className={`w-full rounded-[var(--radius-sm)] border px-3 py-3 text-left text-[13px] transition-colors ${value.id === template.id ? 'border-blue-200 bg-brand-soft text-brand' : 'border-transparent text-muted hover:bg-hover hover:text-ink'}`}><span className="block font-semibold">{template.name}</span><span className="mt-1 block text-[11px] text-subtle">{template.is_default ? 'Үндсэн загвар · ' : ''}{template.project_types.join(', ') || 'Бүх төрөл'}</span></button>)}</div></Card>
        <Card title={value.id ? 'Загвар засах' : 'Шинэ загвар'} actions={<Button icon={<Save size={16} />} disabled={saving} onClick={save}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</Button>}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Загварын нэр"><Input value={value.name || ''} onChange={(e) => setValue({ ...value, name: e.target.value })} /></Field>
            <Field label="Баримтын гарчиг"><Input value={value.title || ''} onChange={(e) => setValue({ ...value, title: e.target.value })} /></Field>
            <Field label="Компани"><Input value={value.company || ''} onChange={(e) => setValue({ ...value, company: e.target.value })} /></Field>
            <Field label="Логоны холбоос"><Input value={value.logo_url || ''} onChange={(e) => setValue({ ...value, logo_url: e.target.value })} placeholder="Хоосон бол Gennetex лого" /></Field>
            <Field label="Төслийн төрлүүд"><Input value={(value.project_types || []).join(', ')} onChange={(e) => setValue({ ...value, project_types: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="fiber_optic, network, general" /></Field>
            <Field label="Зургийн байрлал"><Select className="w-full" value={value.photo_layout || 1} onChange={(e) => setValue({ ...value, photo_layout: Number(e.target.value) as 1|2|4 })}><option value="1">1 зураг / хуудас</option><option value="2">2 зураг / хуудас</option><option value="4">4 зураг / хуудас</option></Select></Field>
            <Field label="Footer текст"><Input value={value.footer_text || ''} onChange={(e) => setValue({ ...value, footer_text: e.target.value })} /></Field>
          </div>
          <div className="mt-4"><Field label="Checklist — мөр бүр нэг шаардлага"><Textarea rows={13} value={checklistText} onChange={(e) => setChecklistText(e.target.value)} /></Field></div>
          <label className="mt-4 flex items-center gap-2 text-[13px] text-ink"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={Boolean(value.is_default)} onChange={(e) => setValue({ ...value, is_default: e.target.checked })} /> Үндсэн загвар болгох</label>
          <div className="mt-4 rounded-[var(--radius-sm)] border border-line bg-card2 p-3 text-[12px] leading-5 text-muted">Талбарууд болон гарын үсгийн хэсгүүд нь баримтын үндсэн бүтэц болж хадгалагдана. Шалгах хуудасны мөрүүд шинэ акт үүсэх үед тухайн актад хуулагдана.</div>
        </Card>
      </div>}
      {isSuperAdmin ? <ReceiverDirectory onToast={setToast} /> : null}
      {toast ? <div className="app-toast fixed bottom-4 left-4 right-4 z-[100] rounded-[var(--radius-sm)] border border-line bg-card px-4 py-3 text-[13px] text-ink shadow-panel sm:left-auto sm:right-6 sm:max-w-md">{toast}</div> : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-muted">{label}</span>{children}</label>;
}

type ContactRow = ActReceiverContact & { dirty?: boolean; isNew?: boolean };

/** Хүлээлцэх хүмүүсийн лавлах — зөвхөн superadmin. Нэр / албан тушаал
 *  өөрчлөхөд баталгаажаагүй актууд DB trigger-ээр дагаад шинэчлэгдэнэ. */
function ReceiverDirectory({ onToast }: { onToast: (message: string) => void }) {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [savingId, setSavingId] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const load = async () => { try { setRows(await fetchActReceiverContacts()); } catch (cause) { onToast(actError(cause)); } };
  useEffect(() => { void load(); }, []);

  const groups = new Map<string, ContactRow[]>();
  rows.forEach((row) => {
    const key = row.preset_group === 'gennetex_handover' ? 'Женнетекс ХХК' : `${row.organization.trim() || 'Бусад'}${row.audience_type === 'household' ? ' (Өрх)' : ''}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  });

  const update = (id: string, value: Partial<ContactRow>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...value, dirty: true } : row));
  const save = async (row: ContactRow, message = `${row.name} хадгалагдлаа — баталгаажаагүй актууд шинэчлэгдлээ`) => {
    setSavingId(row.id);
    try {
      const { dirty: _dirty, isNew: _isNew, created_at: _created, updated_at: _updated, ...contact } = row;
      await saveActReceiverContact({ ...contact, organization: contact.organization.trim(), name: contact.name.trim(), position: contact.position?.trim() || '' });
      onToast(message);
      await load();
    } catch (cause) { onToast(actError(cause)); }
    finally { setSavingId(''); }
  };
  /** Идэвхтэй чагтыг шууд хадгална — идэвхгүй хүн баталгаажаагүй актууд дээр харагдахгүй. */
  const toggleActive = (row: ContactRow, is_active: boolean) => {
    if (row.isNew || !row.name.trim()) { update(row.id, { is_active }); return; }
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, is_active } : item));
    void save({ ...row, is_active }, is_active ? `${row.name} идэвхжлээ — актууд дээр харагдана` : `${row.name} идэвхгүй боллоо — баталгаажаагүй актууд дээр харагдахгүй`);
  };
  const remove = async (row: ContactRow) => {
    if (row.isNew) { setRows((current) => current.filter((item) => item.id !== row.id)); return; }
    setConfirmId(''); setSavingId(row.id);
    try {
      await deleteActReceiverContact(row.id);
      onToast(`${row.name} лавлахаас устлаа`);
      await load();
    } catch (cause) { onToast(`Устгаж чадсангүй: ${actError(cause)}`); }
    finally { setSavingId(''); }
  };
  const add = (template: ContactRow) => {
    const id = crypto.randomUUID();
    setRows((current) => [...current, {
      ...template, id, name: '', position: '', employee_id: null, signature_url: '', stamp_url: '',
      sort_order: Math.max(0, ...current.filter((row) => row.organization === template.organization).map((row) => row.sort_order)) + 10, is_active: true, dirty: true, isNew: true,
    }]);
  };

  return <Card title="Хүлээлцэх хүмүүсийн лавлах" className="mt-5">
    <p className="mb-4 text-[12px] leading-5 text-muted">Нексмайнд, Юнивишн, Женнетексийн хүлээлцэх хүмүүс. Нэр, албан тушаалыг энд өөрчилбөл баталгаажаагүй (ноорог, бэлэн) актууд дагаад шинэчлэгдэнэ. Баталгаажсан актууд хэвээр үлдэнэ.</p>
    <div className="space-y-5">{[...groups.entries()].map(([group, members]) => <section key={group}>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-semibold text-ink">{group}</h3><Button variant="ghost" icon={<Plus size={15} />} onClick={() => add(members[members.length - 1])}>Хүн нэмэх</Button></div>
      <div className="space-y-2">{members.map((row) => <div key={row.id} className={`grid items-center gap-2 rounded-[var(--radius-sm)] border border-line p-2 transition-opacity ${row.is_active ? '' : 'opacity-60'} md:grid-cols-[1fr_1.4fr_auto_auto_auto]`}>
        <Input aria-label="Нэр" placeholder="Нэр" value={row.name} onChange={(e) => update(row.id, { name: e.target.value })} />
        <Input aria-label="Албан тушаал" placeholder="Албан тушаал" value={row.position || ''} onChange={(e) => update(row.id, { position: e.target.value })} />
        <label className="flex items-center gap-2 px-2 text-[12px] text-muted"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={row.is_active} disabled={savingId === row.id} onChange={(e) => toggleActive(row, e.target.checked)} />{row.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}</label>
        <Button icon={<Save size={15} />} disabled={!row.dirty || !row.name.trim() || savingId === row.id} onClick={() => save(row)}>{savingId === row.id ? '...' : 'Хадгалах'}</Button>
        {confirmId === row.id
          ? <div className="flex items-center gap-1"><span className="px-1 text-[12px] text-danger">Устгах уу?</span><Button variant="danger" className="!px-2.5" disabled={savingId === row.id} onClick={() => remove(row)}>Тийм</Button><Button variant="ghost" className="!px-2.5" onClick={() => setConfirmId('')}>Үгүй</Button></div>
          : <Button variant="ghost" className="!px-2 text-danger" aria-label={`${row.name || 'Хүн'} устгах`} title="Устгах" icon={<Trash2 size={15} />} disabled={savingId === row.id} onClick={() => row.isNew ? remove(row) : setConfirmId(row.id)} />}
      </div>)}</div>
    </section>)}</div>
  </Card>;
}
