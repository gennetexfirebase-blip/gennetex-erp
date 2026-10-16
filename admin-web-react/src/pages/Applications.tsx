import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ClipboardList, FileDown, PenLine, RefreshCw, Smartphone } from 'lucide-react';
import { PageHeader, Card, Button, Select, Modal, Loading, ErrorState, EmptyState } from '../components/ui';
import SignatureCanvas from '../components/SignatureCanvas';
import { useAsync } from '../lib/data';
import { supabase } from '../lib/supabase';
import brandLogo from '../assets/report-logo.png';

/** hr.gennetex.com — Ажлын байрны анкет (хуучин «applications»). */

type App = {
  id: string; created_at: string; name: string | null; last_name: string | null; position: string | null; phone: string | null; email: string | null;
  status: string | null; message: string | null; form_data: any; photo_url: string | null; signature_svg: string | null; signed_at: string | null;
  admin_signature_svg: string | null; admin_signed_at: string | null; admin_signed_by_name: string | null;
};
const APP_STATUS: Record<string, string> = { new: 'Шинэ', reviewing: 'Хянаж буй', contacted: 'Холбогдсон', hired: 'Ажилд авсан', rejected: 'Татгалзсан' };

function parseForm(r: App) {
  if (r.form_data && typeof r.form_data === 'object' && r.form_data.general) return r.form_data;
  const msg = String(r.message || '');
  const i = msg.indexOf('[[GENNETEX_FORM]]');
  if (i < 0) return null;
  try {
    const p = JSON.parse(msg.slice(i + '[[GENNETEX_FORM]]'.length));
    return p?.general ? p : null;
  } catch {
    return null;
  }
}
function minimalForm(r: App) {
  return {
    company: 'ЖЕННЕТЕКС ХХК', title: 'Ажилд орохыг хүсэгчийн анкет',
    general: { clanName: '', fatherName: r.last_name || '', firstName: r.name || '', email: r.email || '', phoneMobile: r.phone || '' },
    family: { married: '', members: [] }, education: [], workExperience: [], languages: [], personal: { strengths: '', weaknesses: '' },
    jobInterest: { position: r.position || '', desiredSalary: '' }, emergencyContacts: [], consent: false, signatureSvg: '', signedAt: '',
  };
}
const displayName = (r: App) => {
  const fd = parseForm(r);
  return fd ? `${fd.general?.clanName || ''} ${fd.general?.fatherName || ''} ${fd.general?.firstName || ''}`.trim() : `${r.name || ''} ${r.last_name || ''}`.trim() || '—';
};

async function paperHtml(r: App) {
  await import('../../../admin-web/job-application-paper.js');
  const build = (globalThis as any).buildJobApplicationPaperHtml as (fd: unknown, o: unknown) => string;
  const base = parseForm(r) || minimalForm(r);
  const fd = r.photo_url && base.general && !base.general.photoDataUrl ? { ...base, general: { ...base.general, photoDataUrl: r.photo_url } } : base;
  return build(fd, {
    logoUrl: new URL(brandLogo, window.location.href).href,
    signatureSvg: r.signature_svg || fd.signatureSvg || '', signedAt: r.signed_at || fd.signedAt || '',
    adminSignatureSvg: r.admin_signature_svg || '', adminSignedAt: r.admin_signed_at || '', adminName: r.admin_signed_by_name || '',
    stampUrl: 'https://gennetex.com/company-stamp.png',
  });
}

export function ApplicationsPage() {
  const { profile } = useOutletContext<{ profile: { id?: string; name?: string | null } }>();
  const { data, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('job_applications').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return (data || []) as App[];
  }, [], []);
  const [view, setView] = useState<{ app: App; html: string } | null>(null);
  const [sign, setSign] = useState<App | null>(null);
  const [status, setStatus] = useState('');

  const setAppStatus = async (r: App, s: string) => {
    const { error } = await supabase.from('job_applications').update({ status: s }).eq('id', r.id);
    if (error) window.alert(error.message);
    else reload();
  };
  const open = async (r: App) => setView({ app: r, html: await paperHtml(r) });
  const list = data.filter((r) => !status || (r.status || 'new') === status);

  return (
    <>
      <PageHeader
        title="Ажлын байрны анкет"
        crumb="Хүний нөөц"
        description="Бүрэн анкет ирсэн бол «Бүрэн» гэж харагдана. Анкетыг цаасан загвараар харж, PDF болгож, гарын үсгээр батална."
        actions={
          <>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Төлөв">
              <option value="">Бүх төлөв</option>
              {Object.entries(APP_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>
          </>
        }
      />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : (
        <Card title={`Анкет (${list.length})`} icon={<ClipboardList size={17} />} bodyClassName="p-0">
          {!list.length ? <EmptyState text="Анкет алга." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead className="bg-card2 text-left text-[12px] text-muted"><tr>{['Нэр', 'Албан тушаал', 'Утас', 'Имэйл', 'Огноо', 'Төлөв', ''].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {list.map((r) => {
                    const fd = parseForm(r);
                    const phone = fd?.general?.phoneMobile || r.phone;
                    return (
                      <tr key={r.id}>
                        <td className="px-3 py-2 font-medium text-ink">{displayName(r)}{fd ? <span className="ml-1.5 rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] text-success">Бүрэн</span> : null}{r.admin_signature_svg ? <span className="ml-1 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] text-brand">Батлагдсан</span> : null}</td>
                        <td className="px-3 py-2 text-ink">{fd?.jobInterest?.position || r.position || '—'}</td>
                        <td className="px-3 py-2">{phone ? <a className="text-brand underline" href={`tel:${phone}`}>{phone}</a> : '—'}</td>
                        <td className="px-3 py-2">{r.email ? <a className="text-brand underline" href={`mailto:${r.email}`}>{r.email}</a> : '—'}</td>
                        <td className="px-3 py-2 text-muted">{new Date(r.created_at).toLocaleString('mn-MN')}</td>
                        <td className="px-3 py-2">
                          <Select value={r.status || 'new'} onChange={(e) => setAppStatus(r, e.target.value)} aria-label="Төлөв">
                            {Object.entries(APP_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </Select>
                        </td>
                        <td className="px-3 py-2"><Button onClick={() => open(r)}>Харах</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {view ? (
        <Modal title={`Анкет — ${displayName(view.app)}`} onClose={() => setView(null)} wide>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button icon={<FileDown size={15} />} onClick={() => (globalThis as any).printJobApplicationPaper?.(view.html)}>PDF / Хэвлэх</Button>
            <Button variant="outline" icon={<PenLine size={15} />} onClick={() => { setSign(view.app); setView(null); }}>{view.app.admin_signature_svg ? 'Дахин батлах' : 'Баталж гарын үсэг зурах'}</Button>
          </div>
          <iframe title="Ажлын байрны анкет" srcDoc={view.html} sandbox="allow-same-origin allow-modals" className="h-[70vh] w-full rounded-[var(--radius-sm)] border border-line bg-[#c8c8cd]" />
        </Modal>
      ) : null}
      {sign ? <SignDialog app={sign} me={profile} onClose={() => setSign(null)} onDone={() => { setSign(null); reload(); }} /> : null}
    </>
  );
}

function SignDialog({ app, me, onClose, onDone }: { app: App; me: { id?: string; name?: string | null }; onClose: () => void; onDone: () => void }) {
  const [png, setPng] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!png) return;
    setBusy(true);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="180"><image href="${png}" width="600" height="180"/></svg>`;
    const { error } = await supabase.from('job_applications').update({ admin_signature_svg: svg, admin_signed_at: new Date().toISOString(), admin_signed_by: me.id || null, admin_signed_by_name: me.name || 'Админ' }).eq('id', app.id);
    setBusy(false);
    if (error) window.alert(error.message);
    else onDone();
  };
  return (
    <Modal title="Анкет батлах" onClose={onClose}>
      <p className="mb-2 text-[13px] text-muted">Админ: <b className="text-ink">{me.name || 'Админ'}</b>. Цагаан талбайд гарын үсгээ зурна уу.</p>
      <SignatureCanvas onChange={(_b, preview) => setPng(preview)} />
      <div className="mt-3 flex gap-2"><Button disabled={!png || busy} onClick={save}>Баталж хадгалах</Button><Button variant="outline" onClick={onClose}>Болих</Button></div>
    </Modal>
  );
}

/* ═══════════════════ Төхөөрөмж зөвшөөрөл (зөвхөн sysadmin) ═══════════════════ */
type Device = {
  id: string; user_id: string; user_name: string | null; device_brand: string | null; device_model: string | null; os: string | null; os_version: string | null;
  public_ip: string | null; local_ip: string | null; mac: string | null; requested_at: string; status: 'pending' | 'approved' | 'rejected';
  decided_by_name?: string | null; decided_at?: string | null;
};
const DEV_STATUS = { pending: 'Хүлээгдэж буй', approved: 'Зөвшөөрсөн', rejected: 'Татгалзсан' };

export function DevicesPage() {
  const { profile } = useOutletContext<{ profile: { id?: string; name?: string | null; role?: string | null } }>();
  const isSuper = profile?.role === 'superadmin';
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('device_approvals').select('*').order('requested_at', { ascending: false }).limit(500);
    if (error) throw error;
    return (data || []) as Device[];
  }, [], []);
  const decide = async (d: Device, s: 'approved' | 'rejected') => {
    const { error } = await supabase.from('device_approvals').update({ status: s, decided_at: new Date().toISOString(), decided_by: profile?.id || null, decided_by_name: profile?.name || null }).eq('id', d.id);
    if (error) window.alert(error.message);
    else reload();
  };
  const list = data.filter((d) => !status || d.status === status);
  return (
    <>
      <PageHeader
        title="Төхөөрөмж зөвшөөрөл"
        crumb="Тохиргоо"
        description="Ажилтан шинэ төхөөрөмжөөр нэвтрэхэд энд харагдана. Зөвшөөрснөөр л апп-ыг ашиглана."
        actions={
          <>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Төлөв">
              <option value="">Бүх төлөв</option>
              {Object.entries(DEV_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>
          </>
        }
      />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : (
        <Card title={`Хүсэлт (${list.length})`} icon={<Smartphone size={17} />} bodyClassName="p-0">
          {!list.length ? <EmptyState text="Хүсэлт алга." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead className="bg-card2 text-left text-[12px] text-muted"><tr>{['Ажилтан', 'Төхөөрөмж', 'Систем', 'IP', 'Дотоод IP', 'MAC', 'Огноо', 'Төлөв', ''].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {list.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 font-medium text-ink">{d.user_name || 'Ажилтан'}</td>
                      <td className="px-3 py-2 text-ink">{`${d.device_brand || ''} ${d.device_model || ''}`.trim() || '—'}</td>
                      <td className="px-3 py-2 text-muted">{`${d.os || ''} ${d.os_version || ''}`.trim() || '—'}</td>
                      <td className="px-3 py-2 text-ink">{d.public_ip || '—'}</td>
                      <td className="px-3 py-2 text-muted">{d.local_ip || '—'}</td>
                      <td className="px-3 py-2 text-muted">{d.mac || '—'}</td>
                      <td className="px-3 py-2 text-muted">{new Date(d.requested_at).toLocaleString('mn-MN')}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[12px] ${d.status === 'approved' ? 'bg-success-soft text-success' : d.status === 'rejected' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>{DEV_STATUS[d.status] || d.status}</span></td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {isSuper ? (
                          <>
                            {d.status !== 'approved' ? <Button variant="success" className="!min-h-8" onClick={() => decide(d, 'approved')}>Зөвшөөрөх</Button> : null}
                            {d.status !== 'rejected' ? <Button variant="danger" className="ml-1 !min-h-8" onClick={() => decide(d, 'rejected')}>Татгалзах</Button> : null}
                          </>
                        ) : <span className="text-[12px] text-muted">Зөвхөн sysadmin</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
