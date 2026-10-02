import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Copy, Eye, FilePlus2, Pencil, Search, Settings2, SlidersHorizontal, Trash2 } from 'lucide-react';
import { ACT_STATUS_LABELS, actError, deleteAct, duplicateAct, fetchActs, type Act, type ActStatus } from '../lib/acts';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, SkeletonRows } from '../components/ui';

const tone: Record<ActStatus, 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'purple'> = {
  draft: 'neutral', ready: 'brand', approved: 'success', delivered: 'purple', cancelled: 'danger', archived: 'warning',
};

function Status({ value }: { value: ActStatus }) {
  return <Badge tone={tone[value]}>{ACT_STATUS_LABELS[value]}</Badge>;
}

function fmt(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('mn-MN');
}

export default function ActsPage() {
  const navigate = useNavigate();
  const { profile } = useOutletContext<{ profile: { role?: string; permissions?: Record<string, boolean> } }>();
  const [rows, setRows] = useState<Act[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ActStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const pageSize = 20;
  const canDelete = ['admin', 'superadmin'].includes(profile?.role || '') || Boolean(profile?.permissions?.['acts.delete']);
  const canCreate = ['menejer', 'manager', 'admin', 'superadmin'].includes(profile?.role || '') || Boolean(profile?.permissions?.['acts.create']);
  const canEdit = ['menejer', 'manager', 'admin', 'superadmin'].includes(profile?.role || '') || Boolean(profile?.permissions?.['acts.edit']);
  const canTemplates = ['admin', 'superadmin'].includes(profile?.role || '') || Boolean(profile?.permissions?.['acts.templates']);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await fetchActs({ search: query, status, from, to, page, pageSize });
      setRows(result.rows); setCount(result.count);
    } catch (cause) { setError(actError(cause)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [query, status, from, to, page]);
  useEffect(() => { const timer = setTimeout(() => { setPage(1); setQuery(search); }, 350); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer); }, [toast]);

  const pages = Math.max(1, Math.ceil(count / pageSize));
  const range = useMemo(() => count ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} / ${count}` : '0', [count, page]);

  const copy = async (id: string) => {
    try { const next = await duplicateAct(id); setToast('Акт амжилттай хуулбарлагдлаа'); navigate(`/admin/documents/acts/${next}/edit`); }
    catch (cause) { setToast(actError(cause)); }
  };

  const remove = async () => {
    if (!confirmId) return;
    try { await deleteAct(confirmId); setConfirmId(null); setToast('Акт устгагдлаа'); load(); }
    catch (cause) { setToast(actError(cause)); }
  };

  return (
    <>
      <PageHeader title="Актын бүртгэл" crumb="Баримт бичиг / Ажил гүйцэтгэлийн акт" description="Үүсгэсэн актуудаа хайх, төлөвөөр шүүх болон шинэ акт боловсруулах." actions={
        <>
          {canTemplates ? <Button variant="outline" icon={<Settings2 size={16} />} onClick={() => navigate('/admin/settings/act-templates')}>Загварууд</Button> : null}
          {canCreate ? <Button icon={<FilePlus2 size={16} />} onClick={() => navigate('/admin/documents/acts/new')}>Акт үүсгэх</Button> : null}
        </>
      } />

      <Card className="mb-4" title="Хайлт ба шүүлтүүр" icon={<SlidersHorizontal size={16} />} actions={<span className="text-[12px] text-muted">Нийт {count} акт</span>} bodyClassName="!p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_170px_150px_150px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 text-subtle" size={15} /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Актын №, төсөл, захиалагч, ажил..." /></label>
          <Select className="w-full" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as ActStatus | ''); }}><option value="">Бүх төлөв</option>{Object.entries(ACT_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
          <Input type="date" aria-label="Эхлэх огноо" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} />
          <Input type="date" aria-label="Дуусах огноо" value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} />
          <Button variant="outline" disabled={!search && !status && !from && !to} onClick={() => { setSearch(''); setQuery(''); setStatus(''); setFrom(''); setTo(''); setPage(1); }}>Цэвэрлэх</Button>
        </div>
      </Card>

      <Card title="Актын жагсаалт" actions={<Badge tone="neutral">{range}</Badge>} bodyClassName="!p-0">
        <div className="space-y-3 p-3 md:hidden">
          {loading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-[var(--radius-sm)] bg-card2" />) : rows.map((act) => (
            <article key={act.id} className="rounded-[var(--radius-sm)] border border-line bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="tabular-nums font-semibold text-brand">{act.act_number}</p><h3 className="mt-1 truncate text-[14px] font-semibold text-ink">{act.project_name || act.location || '—'}</h3></div><Status value={act.status} /></div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]"><div><dt className="text-subtle">Захиалагч</dt><dd className="truncate text-muted">{act.customer_name || '—'}</dd></div><div><dt className="text-subtle">Огноо</dt><dd className="text-muted">{fmt(act.start_date)} – {fmt(act.end_date)}</dd></div><div className="col-span-2"><dt className="text-subtle">Гүйцэтгэсэн ажил</dt><dd className="line-clamp-2 text-muted">{act.work_description || '—'}</dd></div></dl>
              <div className="mt-3 flex flex-wrap justify-end gap-1 border-t border-line pt-2"><Button aria-label="Акт харах" title="Харах" variant="ghost" className="!p-2" onClick={() => navigate(`/admin/documents/acts/${act.id}/preview`)}><Eye size={16} /></Button><Button aria-label={canEdit ? 'Акт засах' : 'Зураг нэмэх'} title={canEdit ? 'Засах' : 'Зураг нэмэх'} variant="ghost" className="!p-2" onClick={() => navigate(`/admin/documents/acts/${act.id}/edit`)}><Pencil size={16} /></Button>{canCreate ? <Button aria-label="Акт хуулбарлах" title="Хуулбарлах" variant="ghost" className="!p-2" onClick={() => copy(act.id)}><Copy size={16} /></Button> : null}{canDelete ? <Button aria-label="Акт устгах" title="Устгах" variant="ghost" className="!p-2 !text-danger" onClick={() => setConfirmId(act.id)}><Trash2 size={16} /></Button> : null}</div>
            </article>
          ))}
          {!loading && !rows.length ? <EmptyState text={error || 'Шүүлтэд тохирох акт олдсонгүй.'} /> : null}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="app-table w-full min-w-[1320px] text-left text-[12px]">
            <thead><tr className="border-b border-line bg-card2 text-subtle">
              {['Актын №','Төсөл / Объект','Захиалагч','Гүйцэтгэсэн ажил','Эхэлсэн огноо','Дууссан огноо','Үүсгэсэн ажилтан','Төлөв','Үүсгэсэн огноо','Үйлдэл'].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <SkeletonRows rows={7} cols={10} /> : rows.map((act) => (
                <tr key={act.id} className="border-b border-line align-top hover:bg-hover">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-brand">{act.act_number}</td>
                  <td className="max-w-52 px-4 py-3 font-medium text-ink">{act.project_name || act.location || '—'}</td>
                  <td className="max-w-44 px-4 py-3 text-muted">{act.customer_name || '—'}</td>
                  <td className="max-w-64 px-4 py-3 text-muted"><span className="line-clamp-2">{act.work_description || '—'}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmt(act.start_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmt(act.end_date)}</td>
                  <td className="px-4 py-3 text-muted">{act.created_by_name || '—'}</td>
                  <td className="px-4 py-3"><Status value={act.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmt(act.created_at)}</td>
                  <td className="px-4 py-2"><div className="flex items-center gap-1">
                    <Button aria-label="Акт харах" title="Харах" variant="ghost" className="!p-2" onClick={() => navigate(`/admin/documents/acts/${act.id}/preview`)}><Eye size={15} /></Button>
                    <Button aria-label={canEdit ? 'Акт засах' : 'Зураг нэмэх'} title={canEdit ? 'Засах' : 'Зураг нэмэх'} variant="ghost" className="!p-2" onClick={() => navigate(`/admin/documents/acts/${act.id}/edit`)}><Pencil size={15} /></Button>
                    {canCreate ? <Button aria-label="Акт хуулбарлах" title="Хуулбарлах" variant="ghost" className="!p-2" onClick={() => copy(act.id)}><Copy size={15} /></Button> : null}
                    {canDelete ? <Button aria-label="Акт устгах" title="Устгах" variant="ghost" className="!p-2 !text-danger" onClick={() => setConfirmId(act.id)}><Trash2 size={15} /></Button> : null}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !rows.length ? <EmptyState text={error || 'Шүүлтэд тохирох акт олдсонгүй.'} /> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-3 text-[12px] text-muted sm:px-4">
          <span>{range}</span><div className="flex items-center gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Өмнөх</Button><span>{page} / {pages}</span><Button variant="outline" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Дараах</Button></div>
        </div>
      </Card>

      {confirmId ? <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/45 p-4 backdrop-blur-[2px]"><div className="surface w-full max-w-md p-6"><h2 className="text-lg font-semibold text-ink">Энэ актыг устгахдаа итгэлтэй байна уу?</h2><p className="mt-2 text-[13px] leading-5 text-muted">Акт жагсаалтаас архивлагдана. Зөвхөн эрхтэй админ энэ үйлдлийг хийж чадна.</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmId(null)}>Болих</Button><Button variant="danger" onClick={remove}>Устгах</Button></div></div></div> : null}
      {toast ? <div className="app-toast fixed bottom-4 left-4 right-4 z-[100] rounded-[var(--radius-sm)] border border-line bg-white px-4 py-3 text-[13px] text-ink shadow-panel sm:left-auto sm:right-6 sm:max-w-md">{toast}</div> : null}
    </>
  );
}
