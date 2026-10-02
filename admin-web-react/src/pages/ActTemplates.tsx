import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { actError, fetchActTemplates, saveActTemplate, type ActTemplate } from '../lib/acts';
import { Button, Card, Input, Loading, PageHeader, Select, Textarea } from '../components/ui';

const blankTemplate: Partial<ActTemplate> = {
  name: '', title: 'Ажил гүйцэтгэлийн акт', company: 'Женнетекс ХХК', logo_url: '', project_types: ['general'],
  configuration: { fields: ['location','contractor_name','customer_name','work_description','start_date','end_date'], checklist: [], signature_sections: ['customer','site','contractor'] },
  photo_layout: 1, footer_text: 'Ажил хүлээлцэх акт', is_default: false,
};

export default function ActTemplatesPage() {
  const navigate = useNavigate();
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
    if (!value.name?.trim()) { setToast('Template name оруулна уу.'); return; }
    setSaving(true);
    try {
      const payload = { ...value, project_types: value.project_types || [], configuration: { ...value.configuration, checklist: checklistText.split('\n').map((row) => row.trim()).filter(Boolean) } };
      const id = await saveActTemplate(value.id, payload);
      setToast('Template хадгалагдлаа');
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
          <div className="mt-4 rounded-[var(--radius-sm)] border border-line bg-card2 p-3 text-[12px] leading-5 text-muted">Талбарууд болон гарын үсгийн хэсгүүд нь баримтын үндсэн бүтэц болж хадгалагдана. Checklist-ийн утгууд шинэ акт үүсэх үед snapshot хэлбэрээр хуулна.</div>
        </Card>
      </div>}
      {toast ? <div className="app-toast fixed bottom-4 left-4 right-4 z-[100] rounded-[var(--radius-sm)] border border-line bg-white px-4 py-3 text-[13px] text-ink shadow-panel sm:left-auto sm:right-6 sm:max-w-md">{toast}</div> : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-muted">{label}</span>{children}</label>;
}
