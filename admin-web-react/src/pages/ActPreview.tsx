import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, FileText, Globe2, Link2Off, Mail, Pencil, Printer, Save, Send, ZoomIn, ZoomOut } from 'lucide-react';
import ActDocument, { actPageCount } from '../components/ActDocument';
import { Button, Card, Input, Loading, PageHeader } from '../components/ui';
import { ACT_STATUS_LABELS, actError, duplicateAct, fetchAct, fetchActTemplates, logActEmail, logActExport, sendActEmail, setActPublicShare, transitionAct, uploadActPdf, type Act, type ActTemplate } from '../lib/acts';

export default function ActPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [act, setAct] = useState<Act | null>(null);
  const [templates, setTemplates] = useState<ActTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(() => window.innerWidth < 640 ? .38 : .8);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const template = useMemo(() => templates.find((row) => row.id === act?.template_id), [templates, act?.template_id]);
  const total = act ? actPageCount(act) : 1;
  const shareUrl = act?.public_share_enabled && (act.public_share_slug || act.public_share_token)
    ? `${window.location.origin}${act.public_share_slug ? `/s/${act.public_share_slug}` : `/share/acts/${act.public_share_token}`}`
    : '';

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try { const [current, rows] = await Promise.all([fetchAct(id), fetchActTemplates()]); setAct(current); setTemplates(rows); }
    catch (cause) { setToast(actError(cause)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2800); return () => clearTimeout(timer); }, [toast]);

  const exportFile = async (format: 'pdf'|'docx'|'print') => {
    if (!act) return;
    setBusy(format === 'pdf' ? 'PDF үүсгэж байна...' : format === 'docx' ? 'Word үүсгэж байна...' : 'Хэвлэхэд бэлтгэж байна...');
    try {
      if (format === 'pdf') { const { downloadActPdf } = await import('../lib/actExport'); await downloadActPdf(act, template); }
      else if (format === 'docx') { const { downloadActDocx } = await import('../lib/actExport'); await downloadActDocx(act, template); }
      else { await logActExport(act.id, 'print'); setBusy(''); setTimeout(() => window.print(), 100); return; }
      await logActExport(act.id, format); setToast('Файл бэлэн боллоо');
    } catch (cause) { setToast(actError(cause)); }
    finally { setBusy(''); }
  };

  const transition = async (action: 'approve'|'archive') => {
    if (!act) return;
    try { await transitionAct(act.id, action); await load(); setToast(action === 'approve' ? 'Акт баталгаажлаа' : 'Акт архивлагдлаа'); }
    catch (cause) { setToast(actError(cause)); }
  };

  const duplicate = async () => {
    if (!act) return;
    try { const next = await duplicateAct(act.id); navigate(`/admin/documents/acts/${next}/edit`); }
    catch (cause) { setToast(actError(cause)); }
  };

  const togglePublicShare = async (enabled: boolean) => {
    if (!act) return;
    setBusy(enabled ? 'Public share link үүсгэж байна...' : 'Public share link хааж байна...');
    try {
      const token = await setActPublicShare(act.id, enabled);
      const current = await fetchAct(act.id); setAct(current);
      if (enabled) {
        const url = `${window.location.origin}${current.public_share_slug ? `/s/${current.public_share_slug}` : `/share/acts/${token}`}`;
        await navigator.clipboard.writeText(url).catch(() => null);
        setToast('Public link үүслээ, clipboard-д хууллаа');
      } else setToast('Public link хаагдлаа');
    } catch (cause) { setToast(actError(cause)); }
    finally { setBusy(''); }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setToast('Public link clipboard-д хууллаа');
  };

  const emailAct = async () => {
    if (!act) return;
    const to = recipientEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { setToast('Зөв и-мэйл хаяг оруулна уу.'); return; }
    setBusy('PDF болон public link бэлтгэж байна...');
    try {
      if (act.status === 'draft') await transitionAct(act.id, 'ready');
      await setActPublicShare(act.id, true);
      const current = await fetchAct(act.id);
      const currentTemplate = templates.find((row) => row.id === current.template_id);
      const publicUrl = `${window.location.origin}${current.public_share_slug ? `/s/${current.public_share_slug}` : `/share/acts/${current.public_share_token}`}`;
      const { actExportFilename, createActPdfBlob } = await import('../lib/actExport');
      const pdfFilename = actExportFilename(current, 'pdf');
      const pdf = await createActPdfBlob(current, currentTemplate);
      const uploaded = await uploadActPdf(current.id, pdf, pdfFilename);
      setBusy(`${to} хаяг руу илгээж байна...`);
      await sendActEmail({ to, actNumber: current.act_number, projectName: current.project_name, publicUrl, pdfUrl: uploaded.signedUrl, pdfFilename });
      await logActEmail(current.id, to);
      const refreshed = await fetchAct(current.id); setAct(refreshed);
      setRecipientEmail(''); setToast(`Акт ${to} хаяг руу амжилттай илгээгдлээ`);
    } catch (cause) { setToast(actError(cause)); }
    finally { setBusy(''); }
  };

  if (loading || !act) return <Loading text="Актын preview ачаалж байна..." />;
  return <>
    <PageHeader title={act.act_number} crumb="Баримт бичиг / Актын дэлгэрэнгүй" description={`${act.project_name || 'Төсөл сонгоогүй'} · ${ACT_STATUS_LABELS[act.status]}`} actions={<Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/admin/documents/acts')}>Жагсаалт</Button>} />
    <div className="surface mb-4 grid grid-cols-2 gap-2 p-3 sm:flex sm:flex-wrap">
      <Button variant="outline" icon={<Pencil size={15} />} onClick={() => navigate(`/admin/documents/acts/${act.id}/edit`)}>Засах</Button>
      <Button variant="outline" icon={<Save size={15} />} onClick={() => setToast('Бүх өөрчлөлт хадгалагдсан')}>Хадгалах</Button>
      <Button variant="success" icon={<CheckCircle2 size={15} />} disabled={['approved','delivered'].includes(act.status)} onClick={() => transition('approve')}>Баталгаажуулах</Button>
      <Button icon={<Download size={15} />} onClick={() => exportFile('pdf')}>PDF татах</Button>
      <Button variant="outline" icon={<FileText size={15} />} onClick={() => exportFile('docx')}>Word татах</Button>
      <Button variant="outline" icon={<Printer size={15} />} onClick={() => exportFile('print')}>Хэвлэх</Button>
      <Button variant="outline" icon={<Copy size={15} />} onClick={duplicate}>Хуулбарлах</Button>
      {!act.public_share_enabled ? <Button variant="outline" icon={<Globe2 size={15} />} onClick={() => togglePublicShare(true)}>Нийтийн холбоос</Button> : null}
      <Button variant="ghost" icon={<Archive size={15} />} onClick={() => transition('archive')}>Архивлах</Button>
    </div>
    {shareUrl ? <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius)] border border-blue-200 bg-blue-50 p-3.5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold text-brand">Нийтийн холбоос идэвхтэй</p><p className="mt-1 truncate text-[12px] text-muted">{shareUrl}</p></div><div className="flex gap-2"><Button className="flex-1 sm:flex-none" icon={<Copy size={15} />} onClick={copyShareLink}>Холбоос хуулах</Button><Button className="flex-1 sm:flex-none" variant="outline" icon={<Link2Off size={15} />} onClick={() => togglePublicShare(false)}>Хаах</Button></div></div> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card title="Баримтын урьдчилсан харагдац" actions={<><Button aria-label="Жижигрүүлэх" variant="outline" className="!px-2" onClick={() => setZoom(Math.max(.3, zoom - .1))}><ZoomOut size={15} /></Button><span className="w-12 text-center text-[12px] font-medium text-muted">{Math.round(zoom * 100)}%</span><Button aria-label="Томруулах" variant="outline" className="!px-2" onClick={() => setZoom(Math.min(1.2, zoom + .1))}><ZoomIn size={15} /></Button><Button variant="ghost" onClick={() => setZoom(window.innerWidth < 640 ? .38 : .75)}>Хуудсанд тааруулах</Button></>} bodyClassName="!p-0">
        <div className="overflow-auto bg-[#dfe4ea] p-2 sm:p-4 md:p-8"><div style={{ width: `${210 * zoom}mm`, height: `${297 * zoom}mm`, margin: '0 auto' }}><div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: '210mm' }}><ActDocument act={act} template={template} onlyPage={page} /></div></div></div>
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line p-3 sm:gap-4"><Button variant="outline" disabled={page <= 1} icon={<ChevronLeft size={15} />} onClick={() => setPage(page - 1)}>Өмнөх</Button><span className="text-[13px] text-muted">Page: <b className="text-ink">{page} / {total}</b></span><Button variant="outline" disabled={page >= total} icon={<ChevronRight size={15} />} onClick={() => setPage(page + 1)}>Дараах</Button></div>
      </Card>
      <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <Card title="И-мэйлээр илгээх" actions={<Mail size={17} className="text-brand" />}>
          <p className="mb-3 text-[12px] leading-5 text-muted">Хүлээн авагчид PDF файл болон нийтийн богино холбоос хамт очно.</p>
          <Input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void emailAct(); }} placeholder="name@company.mn" />
          <Button className="mt-3 w-full" icon={<Send size={15} />} disabled={!recipientEmail.trim()} onClick={emailAct}>Илгээх</Button>
        </Card>
      </div>
    </div>
    <div className="act-print-root hidden print:block"><ActDocument act={act} template={template} /></div>
    {busy ? <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-900/45 p-4 backdrop-blur-[2px]"><div className="surface flex items-center gap-3 px-6 py-5 text-[14px] text-ink"><span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />{busy}</div></div> : null}
    {toast ? <div className="app-toast fixed bottom-4 left-4 right-4 z-[130] rounded-[var(--radius-sm)] border border-line bg-white px-4 py-3 text-[13px] text-ink shadow-panel sm:left-auto sm:right-6 sm:max-w-md">{toast}</div> : null}
  </>;
}
