import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { useParams } from 'react-router-dom';
import ActDocument, { actPageCount } from '../components/ActDocument';
import { Button, Loading } from '../components/ui';
import { actError, fetchPublicAct, type Act } from '../lib/acts';

export default function PublicActPage() {
  const { token = '' } = useParams();
  const [act, setAct] = useState<Act | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(() => window.innerWidth < 640 ? .38 : .75);
  const template = act?.template;
  const total = useMemo(() => act ? actPageCount(act) : 1, [act]);

  useEffect(() => {
    let active = true;
    fetchPublicAct(token).then((value) => { if (active) setAct(value); }).catch((cause) => { if (active) setError(actError(cause)); });
    return () => { active = false; };
  }, [token]);

  const downloadPdf = async () => {
    if (!act) return;
    setBusy(true);
    try { const { downloadActPdf } = await import('../lib/actExport'); await downloadActPdf(act, template); }
    catch (cause) { setError(actError(cause)); }
    finally { setBusy(false); }
  };

  if (error) return <main className="grid min-h-screen place-items-center bg-app p-4"><section className="surface max-w-md p-7 text-center"><h1 className="text-xl font-semibold text-ink">Акт нээж чадсангүй</h1><p className="mt-3 text-[13px] text-muted">{error}</p></section></main>;
  if (!act) return <main className="grid min-h-screen place-items-center bg-app"><Loading text="Public акт ачаалж байна..." /></main>;

  return <main className="min-h-screen bg-app pb-8">
    <header className="sticky top-0 z-20 border-b border-line bg-card/95 px-3 py-3 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-brand">Gennetex public document</p><h1 className="truncate text-[15px] font-semibold text-ink sm:text-lg">{act.act_number} · {act.project_name || 'Ажил гүйцэтгэлийн акт'}</h1></div><div className="flex gap-2"><Button variant="outline" icon={<Printer size={15} />} onClick={() => window.print()}>Хэвлэх</Button><Button icon={<Download size={15} />} disabled={busy} onClick={downloadPdf}>{busy ? 'Үүсгэж байна...' : 'PDF татах'}</Button></div></div></header>
    <section className="mx-auto mt-4 max-w-7xl px-2 sm:px-4"><div className="surface overflow-hidden"><div className="flex flex-wrap items-center justify-center gap-2 border-b border-line p-3"><Button variant="outline" className="!px-2" onClick={() => setZoom(Math.max(.3, zoom - .1))}><ZoomOut size={15} /></Button><span className="w-12 text-center text-[12px] text-muted">{Math.round(zoom * 100)}%</span><Button variant="outline" className="!px-2" onClick={() => setZoom(Math.min(1.2, zoom + .1))}><ZoomIn size={15} /></Button><Button variant="ghost" onClick={() => setZoom(window.innerWidth < 640 ? .38 : .75)}>Fit page</Button></div><div className="overflow-auto bg-[#252a35] p-2 sm:p-6"><div style={{ width: `${210 * zoom}mm`, height: `${297 * zoom}mm`, margin: '0 auto' }}><div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: '210mm' }}><ActDocument act={act} template={template} onlyPage={page} /></div></div></div><div className="flex flex-wrap items-center justify-center gap-2 border-t border-line p-3 sm:gap-4"><Button variant="outline" icon={<ChevronLeft size={15} />} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Өмнөх</Button><span className="text-[13px] text-muted">Page: <b className="text-ink">{page} / {total}</b></span><Button variant="outline" icon={<ChevronRight size={15} />} disabled={page >= total} onClick={() => setPage((value) => value + 1)}>Дараах</Button></div></div></section>
    <div className="act-print-root hidden print:block"><ActDocument act={act} template={template} /></div>
  </main>;
}
