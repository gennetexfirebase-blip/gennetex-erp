import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarRange, ChevronLeft, ChevronRight, Copy, Eye, FilePlus2, FileText, Pencil, Search, Settings2, Trash2, X } from 'lucide-react';
import { ACT_STATUS_LABELS, actError, deleteAct, duplicateAct, fetchActStatusCounts, fetchActs, type Act, type ActStatus } from '../lib/acts';
import { Badge, Button, Input, PageHeader, SkeletonRows } from '../components/ui';

const tone: Record<ActStatus, 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'purple'> = {
  draft: 'neutral', ready: 'brand', approved: 'success', delivered: 'purple', cancelled: 'danger', archived: 'warning',
};

const STATUS_ORDER: ActStatus[] = ['draft', 'ready', 'approved', 'delivered', 'archived', 'cancelled'];
const MAIN_STATUSES: ActStatus[] = ['draft', 'ready', 'approved', 'delivered'];

function Status({ value }: { value: ActStatus }) {
  return <Badge tone={tone[value]}>{ACT_STATUS_LABELS[value]}</Badge>;
}

/** 2026.09.26 — огноог нэг мөрөнд, уншихад ойлгомжтой. */
function fmt(value?: string | null) {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function period(act: Act) {
  if (!act.start_date && !act.end_date) return '—';
  return `${fmt(act.start_date)} – ${fmt(act.end_date)}`;
}

export default function ActsPage() {
  const navigate = useNavigate();
  const { profile } = useOutletContext<{ profile: { role?: string; permissions?: Record<string, boolean> } }>();
  const [rows, setRows] = useState<Act[]>([]);
  const [count, setCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Partial<Record<ActStatus, number>>>({});
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
  const loadCounts = () => fetchActStatusCounts().then(setStatusCounts).catch(() => null);

  useEffect(() => { load(); }, [query, status, from, to, page]);
  useEffect(() => { loadCounts(); }, []);
  useEffect(() => { const timer = setTimeout(() => { setPage(1); setQuery(search); }, 350); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer); }, [toast]);

  const pages = Math.max(1, Math.ceil(count / pageSize));
  const range = useMemo(() => count ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} / ${count}` : '0 акт', [count, page]);
  const total = Object.values(statusCounts).reduce((sum, value) => sum + (value || 0), 0);
  const filtered = Boolean(search || from || to);
  const tabs: { key: ActStatus | ''; label: string; n: number }[] = [
    { key: '', label: 'Бүгд', n: total },
    ...STATUS_ORDER.filter((key) => MAIN_STATUSES.includes(key) || statusCounts[key] || key === status)
      .map((key) => ({ key, label: ACT_STATUS_LABELS[key], n: statusCounts[key] || 0 })),
  ];

  const clearFilters = () => { setSearch(''); setQuery(''); setFrom(''); setTo(''); setPage(1); };

  const copy = async (id: string) => {
    try { const next = await duplicateAct(id); setToast('Акт амжилттай хуулбарлагдлаа'); navigate(`/admin/documents/acts/${next}/edit`); }
    catch (cause) { setToast(actError(cause)); }
  };

  const remove = async () => {
    if (!confirmId) return;
    try { await deleteAct(confirmId); setConfirmId(null); setToast('Акт устгагдлаа'); load(); loadCounts(); }
    catch (cause) { setToast(actError(cause)); }
  };

  const open = (act: Act) => navigate(`/admin/documents/acts/${act.id}/preview`);

  const actions = (act: Act, size: number) => (
    <div className="flex items-center justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
      <Button aria-label="Акт харах" title="Харах" variant="ghost" className="!min-h-8 !p-2" onClick={() => open(act)}><Eye size={size} /></Button>
      <Button aria-label={canEdit ? 'Акт засах' : 'Зураг нэмэх'} title={canEdit ? 'Засах' : 'Зураг нэмэх'} variant="ghost" className="!min-h-8 !p-2" onClick={() => navigate(`/admin/documents/acts/${act.id}/edit`)}><Pencil size={size} /></Button>
      {canCreate ? <Button aria-label="Акт хуулбарлах" title="Хуулбарлах" variant="ghost" className="!min-h-8 !p-2" onClick={() => copy(act.id)}><Copy size={size} /></Button> : null}
      {canDelete ? <Button aria-label="Акт устгах" title="Устгах" variant="ghost" className="!min-h-8 !p-2 hover:!text-danger" onClick={() => setConfirmId(act.id)}><Trash2 size={size} /></Button> : null}
    </div>
  );

  const empty = !loading && !rows.length ? (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-card2 text-subtle ring-1 ring-line"><FileText size={22} /></span>
      <p className="text-[14px] font-semibold text-ink">{error ? 'Акт ачаалж чадсангүй' : filtered || status ? 'Шүүлтэд тохирох акт олдсонгүй' : 'Одоогоор акт алга'}</p>
      <p className="mt-1 max-w-sm text-[12px] text-muted">{error || (filtered || status ? 'Хайлтын үг эсвэл огноогоо өөрчилж үзнэ үү.' : 'Шинэ акт үүсгээд ажлын явцаа баримтжуулаарай.')}</p>
      <div className="mt-4 flex gap-2">
        {filtered || status ? <Button variant="outline" onClick={() => { clearFilters(); setStatus(''); }}>Шүүлтүүр арилгах</Button> : null}
        {!filtered && !status && canCreate && !error ? <Button icon={<FilePlus2 size={16} />} onClick={() => navigate('/admin/documents/acts/new')}>Акт үүсгэх</Button> : null}
      </div>
    </div>
  ) : null;

  return (
    <>
      <PageHeader title="Актын бүртгэл" crumb="Баримт бичиг / Ажил гүйцэтгэлийн акт" description="Үүсгэсэн актуудаа хайх, төлөвөөр шүүх болон шинэ акт боловсруулах." actions={
        <>
          {canTemplates ? <Button variant="outline" icon={<Settings2 size={16} />} onClick={() => navigate('/admin/settings/act-templates')}>Загварууд</Button> : null}
          {canCreate ? <Button icon={<FilePlus2 size={16} />} onClick={() => navigate('/admin/documents/acts/new')}>Акт үүсгэх</Button> : null}
        </>
      } />

      <section className="surface overflow-hidden">
        <nav aria-label="Төлөвөөр шүүх" className="overflow-x-auto border-b border-line px-2 sm:px-3">
          <ul className="flex min-w-max">
            {tabs.map((tab) => {
              const active = status === tab.key;
              return <li key={tab.key || 'all'}>
                <button type="button" aria-current={active ? 'page' : undefined} onClick={() => { setPage(1); setStatus(tab.key); }}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-[13px] transition-colors ${active ? 'border-brand font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
                  {tab.label}
                  <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums ${active ? 'bg-brand text-white' : 'bg-card2 text-subtle ring-1 ring-line'}`}>{tab.n}</span>
                </button>
              </li>;
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-2 border-b border-line bg-card2/60 p-3 sm:flex-row sm:items-center sm:px-4">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} />
            <Input className="w-full pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Актын №, төсөл, захиалагч, ажлаар хайх..." />
          </label>
          <div className="flex items-center gap-1.5 rounded-[7px] border border-line bg-card px-2.5" title="Үүсгэсэн огноогоор шүүх">
            <CalendarRange size={15} className="shrink-0 text-subtle" />
            <input type="date" aria-label="Эхлэх огноо" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} className="h-9 min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none" />
            <span className="text-subtle">–</span>
            <input type="date" aria-label="Дуусах огноо" value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} className="h-9 min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none" />
          </div>
          {filtered ? <Button variant="ghost" icon={<X size={15} />} onClick={clearFilters}>Цэвэрлэх</Button> : null}
        </div>

        <div className="divide-y divide-line md:hidden">
          {loading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="m-3 h-32 animate-pulse rounded-[var(--radius-sm)] bg-card2" />) : rows.map((act) => (
            <article key={act.id} onClick={() => open(act)} className="cursor-pointer p-4 active:bg-hover">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold tabular-nums text-brand">{act.act_number}</p>
                  <h3 className="mt-0.5 truncate text-[14px] font-semibold text-ink">{act.project_name || act.location || '—'}</h3>
                  <p className="truncate text-[12px] text-muted">{act.customer_name || '—'}</p>
                </div>
                <Status value={act.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-[12px] text-muted">{act.work_description || '—'}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] tabular-nums text-subtle">{period(act)}</span>
                {actions(act, 16)}
              </div>
            </article>
          ))}
          {empty}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="app-table w-full min-w-[980px] text-left text-[12px]">
            <thead><tr className="border-b border-line text-[11px] uppercase tracking-wide text-subtle">
              <th className="whitespace-nowrap px-4 py-2.5 font-semibold">Актын №</th>
              <th className="px-4 py-2.5 font-semibold">Төсөл / Захиалагч</th>
              <th className="px-4 py-2.5 font-semibold">Гүйцэтгэсэн ажил</th>
              <th className="whitespace-nowrap px-4 py-2.5 font-semibold">Ажлын хугацаа</th>
              <th className="px-4 py-2.5 font-semibold">Үүсгэсэн</th>
              <th className="px-4 py-2.5 font-semibold">Төлөв</th>
              <th className="px-4 py-2.5"><span className="sr-only">Үйлдэл</span></th>
            </tr></thead>
            <tbody>
              {loading ? <SkeletonRows rows={7} cols={7} /> : rows.map((act) => (
                <tr key={act.id} onClick={() => open(act)} className="group cursor-pointer border-b border-line last:border-b-0 hover:bg-hover">
                  <td className="whitespace-nowrap px-4 py-3.5 align-top font-semibold tabular-nums text-brand">{act.act_number}</td>
                  <td className="max-w-64 px-4 py-3.5 align-top">
                    <p className="line-clamp-2 font-semibold text-ink">{act.project_name || act.location || '—'}</p>
                    <p className="mt-0.5 truncate text-muted">{act.customer_name || '—'}</p>
                  </td>
                  <td className="max-w-80 px-4 py-3.5 align-top text-muted"><span className="line-clamp-2">{act.work_description || '—'}</span></td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top tabular-nums text-muted">{period(act)}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top">
                    <p className="text-ink">{act.created_by_name || '—'}</p>
                    <p className="mt-0.5 tabular-nums text-subtle">{fmt(act.created_at)}</p>
                  </td>
                  <td className="px-4 py-3.5 align-top"><Status value={act.status} /></td>
                  <td className="px-3 py-2.5 align-top opacity-70 transition-opacity group-hover:opacity-100">{actions(act, 15)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {empty}
        </div>

        {count > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-[12px] text-muted sm:px-4">
          <span className="tabular-nums">{range}</span>
          {pages > 1 ? <div className="flex items-center gap-1">
            <Button aria-label="Өмнөх хуудас" variant="ghost" className="!min-h-8 !p-2" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></Button>
            <span className="px-1 tabular-nums">{page} / {pages}</span>
            <Button aria-label="Дараах хуудас" variant="ghost" className="!min-h-8 !p-2" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></Button>
          </div> : null}
        </div> : null}
      </section>

      {confirmId ? <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(35,38,36,0.42)] p-4 backdrop-blur-[2px]"><div className="surface w-full max-w-md p-6"><h2 className="text-lg font-semibold text-ink">Энэ актыг устгахдаа итгэлтэй байна уу?</h2><p className="mt-2 text-[13px] leading-5 text-muted">Акт жагсаалтаас архивлагдана. Зөвхөн эрхтэй админ энэ үйлдлийг хийж чадна.</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmId(null)}>Болих</Button><Button variant="danger" onClick={remove}>Устгах</Button></div></div></div> : null}
      {toast ? <div className="app-toast fixed bottom-4 left-4 right-4 z-[100] rounded-[var(--radius-sm)] border border-line bg-card px-4 py-3 text-[13px] text-ink shadow-panel sm:left-auto sm:right-6 sm:max-w-md">{toast}</div> : null}
    </>
  );
}
