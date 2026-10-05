import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, FileText, Globe2, Link2Off, Mail, MousePointerClick, Pencil, Printer, Save, Send, ZoomIn, ZoomOut } from 'lucide-react';
import ActDocument, { actPageCount, type ActSection } from '../components/ActDocument';
import { Button, Card, Loading, PageHeader, Textarea } from '../components/ui';
import { ACT_STATUS_LABELS, actError, duplicateAct, fetchAct, fetchActInventory, fetchActTemplates, logActEmail, logActExport, removeActImage, saveAct, sendActEmail, setActPublicShare, snapshotDraft, transitionAct, uploadActPdf, type Act, type ActDraft, type ActInventoryItem, type ActTemplate } from '../lib/acts';

export default function ActPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useOutletContext<{ profile: { role?: string; permissions?: Record<string, boolean> } }>();
  const [act, setAct] = useState<Act | null>(null);
  const [templates, setTemplates] = useState<ActTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(() => window.innerWidth < 640 ? .38 : .8);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  // PDF editor — preview хуудсан дээр хэсэг дээр дарж тэр хэсгийг нь шууд засна.
  const [draft, setDraft] = useState<ActDraft | null>(null);
  const [section, setSection] = useState<ActSection | null>(null);
  const [inventory, setInventory] = useState<ActInventoryItem[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSaved = useRef('');
  const canEdit = ['menejer', 'manager', 'admin', 'superadmin'].includes(profile?.role || '') || Boolean(profile?.permissions?.['acts.edit']);
  const editLocked = ['approved', 'delivered'].includes(act?.status || '');
  const shown = useMemo(() => act && draft ? { ...act, ...draft } as Act : act, [act, draft]);
  const template = useMemo(() => templates.find((row) => row.id === act?.template_id), [templates, act?.template_id]);
  const total = shown ? actPageCount(shown) : 1;
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
  useEffect(() => { setPage((current) => Math.min(Math.max(1, current), total)); }, [total]);

  useEffect(() => {
    if (!draft || !act) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSaved.current) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try { await saveAct(act.id, draft); lastSaved.current = serialized; setSaveState('saved'); }
      catch (cause) { setSaveState('error'); setToast(actError(cause)); }
    }, 900);
    return () => clearTimeout(timer);
  }, [draft, act?.id]);

  const editing = Boolean(draft);
  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSection(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const startEditing = () => {
    if (!act || !canEdit || editLocked) return;
    const value = snapshotDraft(act);
    lastSaved.current = JSON.stringify(value);
    setDraft(value); setSection(null); setSaveState('idle');
    if (!inventory.length) fetchActInventory().then(setInventory).catch(() => null);
  };

  const finishEditing = async () => {
    if (!draft || !act) return;
    setBusy('Хадгалж байна...');
    try {
      if (JSON.stringify(draft) !== lastSaved.current) await saveAct(act.id, draft);
      setAct(await fetchAct(act.id)); setDraft(null); setSection(null); setSaveState('idle');
      setToast('Өөрчлөлт хадгалагдлаа');
    } catch (cause) { setToast(actError(cause)); }
    finally { setBusy(''); }
  };

  const patch = (value: Partial<ActDraft>) => setDraft((current) => current ? { ...current, ...value } : current);
  const removePhoto = async (index: number) => {
    if (!draft) return;
    const photo = draft.photos[index];
    if (photo.storage_path) await removeActImage(photo.storage_path).catch(() => null);
    patch({ photos: draft.photos.filter((_, photoIndex) => photoIndex !== index) });
  };

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
    setToast('Холбоос хуулагдлаа');
  };

  /** Олон хаяг — таслал, цэг таслал, зай, мөрөөр тусгаарлана. */
  const parseRecipients = (value: string) => [...new Set(value.split(/[\s,;]+/).map((row) => row.trim().toLowerCase()).filter(Boolean))];

  const emailAct = async () => {
    if (!act) return;
    const recipients = parseRecipients(recipientEmail);
    const invalid = recipients.filter((to) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to));
    if (!recipients.length || invalid.length) { setToast(invalid.length ? `Буруу хаяг: ${invalid.join(', ')}` : 'Зөв и-мэйл хаяг оруулна уу.'); return; }
    setBusy('PDF болон public link бэлтгэж байна...');
    const sent: string[] = [];
    const failed: string[] = [];
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
      // Хүлээн авагч бүрт тусад нь илгээнэ — бие биеийнхээ хаягийг харахгүй.
      for (const [index, to] of recipients.entries()) {
        setBusy(`Илгээж байна ${index + 1}/${recipients.length}: ${to}`);
        try {
          await sendActEmail({ to, actNumber: current.act_number, projectName: current.project_name, publicUrl, pdfUrl: uploaded.signedUrl, pdfFilename });
          await logActEmail(current.id, to);
          sent.push(to);
        } catch { failed.push(to); }
        if (index < recipients.length - 1) await new Promise((resolve) => setTimeout(resolve, 600));
      }
      const refreshed = await fetchAct(current.id); setAct(refreshed);
      setRecipientEmail(failed.join(', '));
      setToast(failed.length ? `${sent.length} хаяг руу илгээлээ. Амжилтгүй: ${failed.join(', ')}` : `Акт ${sent.length} хаяг руу амжилттай илгээгдлээ`);
    } catch (cause) { setToast(actError(cause)); }
    finally { setBusy(''); }
  };

  if (loading || !act) return <Loading text="Актын preview ачаалж байна..." />;
  return <>
    <PageHeader title={act.act_number} crumb="Баримт бичиг / Актын дэлгэрэнгүй" description={`${act.project_name || 'Төсөл сонгоогүй'} · ${ACT_STATUS_LABELS[act.status]}`} actions={<Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/admin/documents/acts')}>Жагсаалт</Button>} />
    <div className="surface mb-4 grid grid-cols-2 gap-2 p-3 sm:flex sm:flex-wrap">
      {canEdit ? editing
        ? <Button variant="success" icon={<Check size={15} />} onClick={finishEditing}>Засварлаж дууслаа</Button>
        : <Button icon={<MousePointerClick size={15} />} disabled={editLocked} title={editLocked ? 'Баталгаажсан актыг "Засах" цэсээр засна' : 'Актын хэсэг дээр дарж шууд засна'} onClick={startEditing}>PDF editor</Button> : null}
      <Button variant="outline" icon={<Pencil size={15} />} disabled={editing} onClick={() => navigate(`/admin/documents/acts/${act.id}/edit`)}>Засах</Button>
      <Button variant="outline" icon={<Save size={15} />} disabled={editing} onClick={() => setToast('Бүх өөрчлөлт хадгалагдсан')}>Хадгалах</Button>
      <Button variant="success" icon={<CheckCircle2 size={15} />} disabled={editing || ['approved','delivered'].includes(act.status)} onClick={() => transition('approve')}>Баталгаажуулах</Button>
      <Button icon={<Download size={15} />} disabled={editing} onClick={() => exportFile('pdf')}>PDF татах</Button>
      <Button variant="outline" icon={<FileText size={15} />} disabled={editing} onClick={() => exportFile('docx')}>Word татах</Button>
      <Button variant="outline" icon={<Printer size={15} />} disabled={editing} onClick={() => exportFile('print')}>Хэвлэх</Button>
      <Button variant="outline" icon={<Copy size={15} />} disabled={editing} onClick={duplicate}>Хуулбарлах</Button>
      {!act.public_share_enabled ? <Button variant="outline" icon={<Globe2 size={15} />} disabled={editing} onClick={() => togglePublicShare(true)}>Нийтийн холбоос</Button> : null}
      <Button variant="ghost" icon={<Archive size={15} />} disabled={editing} onClick={() => transition('archive')}>Архивлах</Button>
    </div>
    {shareUrl ? <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius)] border border-blue-200 bg-blue-50 p-3.5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold text-brand">Нийтийн холбоос идэвхтэй</p><p className="mt-1 truncate text-[12px] text-muted">{shareUrl}</p></div><div className="flex gap-2"><Button className="flex-1 sm:flex-none" icon={<Copy size={15} />} onClick={copyShareLink}>Холбоос хуулах</Button><Button className="flex-1 sm:flex-none" variant="outline" icon={<Link2Off size={15} />} onClick={() => togglePublicShare(false)}>Хаах</Button></div></div> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card title={editing ? 'PDF editor' : 'Баримтын урьдчилсан харагдац'} actions={<><Button aria-label="Жижигрүүлэх" variant="outline" className="!px-2" onClick={() => setZoom(Math.max(.3, zoom - .1))}><ZoomOut size={15} /></Button><span className="w-12 text-center text-[12px] font-medium text-muted">{Math.round(zoom * 100)}%</span><Button aria-label="Томруулах" variant="outline" className="!px-2" onClick={() => setZoom(Math.min(1.2, zoom + .1))}><ZoomIn size={15} /></Button><Button variant="ghost" onClick={() => setZoom(window.innerWidth < 640 ? .38 : .75)}>Хуудсанд тааруулах</Button></>} bodyClassName="!p-0">
        {editing ? <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-soft px-4 py-2.5 text-[12px] text-ink">
          <MousePointerClick size={15} className="text-brand" />
          <span className="min-w-0 flex-1">{section ? 'Өөр хэсэг дээр дарж шилжинэ, Esc дарж гарна.' : 'Засах хэсэг (мэдээлэл, материал, шаардлага, зураг) дээрээ дарна уу.'}</span>
          <span className={`font-medium ${saveState === 'error' ? 'text-danger' : 'text-success'}`}>{saveState === 'saving' ? 'Хадгалж байна...' : saveState === 'saved' ? '✓ Хадгалагдлаа' : saveState === 'error' ? 'Хадгалж чадсангүй' : ''}</span>
        </div> : null}
        <div className="overflow-auto bg-[#e6e1d6] p-2 sm:p-4 md:p-8"><div style={{ width: `${210 * zoom}mm`, height: `${297 * zoom}mm`, margin: '0 auto' }}><div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: '210mm' }}><ActDocument act={shown || act} template={template} onlyPage={page} edit={draft ? {
          onChange: patch, inventory, onRemovePhoto: removePhoto,
          onActivateSection: setSection, activeSection: section,
          onEditReceivers: () => { void finishEditing().then(() => navigate(`/admin/documents/acts/${act.id}/edit`)); },
        } : undefined} /></div></div></div>
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line p-3 sm:gap-4"><Button variant="outline" disabled={page <= 1} icon={<ChevronLeft size={15} />} onClick={() => setPage(page - 1)}>Өмнөх</Button><span className="text-[13px] text-muted">Хуудас: <b className="text-ink">{page} / {total}</b></span><Button variant="outline" disabled={page >= total} icon={<ChevronRight size={15} />} onClick={() => setPage(page + 1)}>Дараах</Button></div>
      </Card>
      <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <Card title="И-мэйлээр илгээх" actions={<Mail size={17} className="text-brand" />}>
          <p className="mb-3 text-[12px] leading-5 text-muted">Олон хаяг оруулж болно — таслал эсвэл шинэ мөрөөр тусгаарлана. Хүн бүрт PDF файл болон нийтийн богино холбоос тусад нь очно.</p>
          <Textarea rows={4} value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder={'name@company.mn, boss@company.mn'} />
          <Button className="mt-3 w-full" icon={<Send size={15} />} disabled={!recipientEmail.trim()} onClick={emailAct}>{parseRecipients(recipientEmail).length > 1 ? `${parseRecipients(recipientEmail).length} хаяг руу илгээх` : 'Илгээх'}</Button>
        </Card>
      </div>
    </div>
    <div className="act-print-root hidden print:block"><ActDocument act={act} template={template} /></div>
    {busy ? <div className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(35,38,36,0.42)] p-4 backdrop-blur-[2px]"><div className="surface flex items-center gap-3 px-6 py-5 text-[14px] text-ink"><span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />{busy}</div></div> : null}
    {toast ? <div className="app-toast fixed bottom-4 left-4 right-4 z-[130] rounded-[var(--radius-sm)] border border-line bg-card px-4 py-3 text-[13px] text-ink shadow-panel sm:left-auto sm:right-6 sm:max-w-md">{toast}</div> : null}
  </>;
}
