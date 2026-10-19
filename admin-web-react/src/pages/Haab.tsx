import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, Download, FileDown, Link2, PenLine, Printer, RefreshCw, Search, Share2, Users, XCircle } from 'lucide-react';
import { PageHeader, Card, Button, Input, Avatar, Loading, ErrorState, EmptyState, StatCard, KpiRow, Modal } from '../components/ui';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';
import { supabase } from '../lib/supabase';
import { downloadSheets } from '../lib/attendanceExport';
import HaabSheet, { SigImg } from '../components/HaabSheet';
import { downloadPdf, fetchInstruction, revokeShare, shareLink, type HaabAck, type HaabSheet as Sheet } from '../lib/haab';

/**
 * haab.gennetex.com — ХААБ (хөдөлмөрийн аюулгүй байдал) зааврын өдөр бүрийн гарын үсэг.
 *
 * Апп (OhaabScreen) өөрчлөгдөөгүй: ажилтан зааврыг уншаад утсан дээрээ гарын үсэг
 * зурахад `ohaab_daily_ack`-д (user_id, ack_date, signature_url, signed_at) бичигдэнэ.
 * Энд тухайн өдрийн зурсан / зураагүй ажилтныг гарын үсгийн хамт харуулна.
 * Админ RLS-ээр бүх мөрийг уншина (ohaab_daily_ack_read).
 *
 * ⚠️ Апп гарын үсгийг `<user>/signature.svg` руу дарж хадгалдаг тул өмнөх өдрүүдэд
 * тухайн ажилтны хамгийн сүүлд зурсан гарын үсэг харагдана.
 */

type Ack = { id: string; user_id: string; user_name: string | null; ack_date: string; signature_url: string | null; signed_at: string | null; instruction_updated_at: string | null };

const ubToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
const shift = (d: string, days: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
};
const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Ulaanbaatar', hour: '2-digit', minute: '2-digit' }) : '—';
const fullName = (e?: Employee | null) => [e?.last_name, e?.name].filter(Boolean).join(' ').trim();
/** Нийтийн URL ижил хэвээр дарагддаг тул кэшээс хуучин зураг гарахгүйн тулд цагийг нэмнэ. */
const sigSrc = (a: Ack) => (a.signature_url && /^https?:/.test(a.signature_url) ? `${a.signature_url}?v=${encodeURIComponent(a.signed_at || a.ack_date)}` : a.signature_url || '');

type Mode = 'day' | 'month' | 'year' | 'all';
const MODES: [Mode, string][] = [['day', 'Өдөр'], ['month', 'Сар'], ['year', 'Он'], ['all', 'Бүгд']];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Сонгосон горимоос хугацааны хүрээ. */
function rangeOf(mode: Mode, d: string): [string, string] {
  const [y, m] = d.split('-').map(Number);
  if (mode === 'month') return [`${y}-${String(m).padStart(2, '0')}-01`, `${y}-${String(m).padStart(2, '0')}-${lastDay(y, m)}`];
  if (mode === 'year') return [`${y}-01-01`, `${y}-12-31`];
  if (mode === 'all') return ['2020-01-01', ubToday()];
  return [d, d];
}
/** Горимын нэгжээр урагш/хойш. */
function step(mode: Mode, d: string, dir: 1 | -1) {
  if (mode === 'day') return shift(d, dir);
  const [y, m] = d.split('-').map(Number);
  if (mode === 'month') {
    const x = new Date(Date.UTC(y, m - 1 + dir, 1));
    return x.toISOString().slice(0, 10);
  }
  if (mode === 'year') return `${y + dir}-01-01`;
  return d;
}

async function fetchAcks(from: string, to: string) {
  const { data, error } = await supabase
    .from('ohaab_daily_ack')
    .select('id, user_id, user_name, ack_date, signature_url, signed_at, instruction_updated_at')
    .gte('ack_date', from)
    .lte('ack_date', to)
    .order('ack_date', { ascending: true })
    .order('signed_at', { ascending: true })
    .limit(10000);
  if (error) throw new Error(error.message);
  return (data || []) as Ack[];
}

/** Гарын үсэг — шөнийн горимд ч харагдахаар үргэлж цагаан «цаасан» дээр. */
function Signature({ ack, onOpen, large = false }: { ack: Ack; onOpen?: () => void; large?: boolean }) {
  const src = sigSrc(ack);
  if (!src) return <span className="text-[12px] text-subtle">Зураг алга</span>;
  const box = large ? 'h-56 w-full' : 'h-14 w-40';
  const img = <SigImg ack={ack} className="h-full w-full" />;
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`focus-ring ${box} shrink-0 rounded-[var(--radius-sm)] border border-line bg-card2 p-1.5 hover:border-brand`} aria-label="Гарын үсгийг томоор харах">
      {img}
    </button>
  ) : (
    <div className={`${box} rounded-[var(--radius)] border border-line bg-card2 p-3`}>{img}</div>
  );
}

export default function HaabPage() {
  const [date, setDate] = useState(ubToday());
  const [mode, setMode] = useState<Mode>('day');
  const [from, to] = rangeOf(mode, date);
  const multi = from !== to;
  const [tab, setTab] = useState<'sheet' | 'signed' | 'missing'>('sheet');
  const [share, setShare] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState<Ack | null>(null);
  const emps = useAsync<Employee[]>(fetchEmployees, [], []);
  const acks = useAsync<Ack[]>(() => fetchAcks(from, to), [from, to], []);
  const instr = useAsync(fetchInstruction, [], { title: 'ХААБ заавар', body: '', updated_at: null as string | null });

  // Өнөөдрийг харж байхад 30 секунд тутам шинэчилнэ — апп-аас шинэ гарын үсэг орж ирнэ.
  useEffect(() => {
    if (to < ubToday() || mode === 'all') return;
    const id = window.setInterval(acks.reload, 30_000);
    return () => window.clearInterval(id);
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  // «Зураагүй» — зөвхөн нэг өдрийн хувьд утгатай.
  useEffect(() => {
    if (multi && tab === 'missing') setTab('sheet');
  }, [multi, tab]);

  const byUser = useMemo(() => new Map(emps.data.filter((e) => e.user_id).map((e) => [e.user_id!, e])), [emps.data]);
  const signedIds = useMemo(() => new Set(acks.data.map((a) => a.user_id)), [acks.data]);
  // Нийт — апп-д бүртгэлтэй (нэвтэрсэн) ажилтан; зөвхөн тэд гарын үсэг зурж чадна.
  const staff = useMemo(() => emps.data.filter((e) => e.user_id && e.role !== 'superadmin'), [emps.data]);
  const missing = staff.filter((e) => !signedIds.has(e.user_id!));
  const total = staff.length;
  const signed = acks.data.length;
  const pct = total ? Math.round((Math.min(signed, total) / total) * 100) : 0;

  const needle = q.trim().toLowerCase();
  const signedList = acks.data.filter((a) => !needle || `${a.user_name || ''} ${fullName(byUser.get(a.user_id))} ${byUser.get(a.user_id)?.department_name || ''}`.toLowerCase().includes(needle));
  const missingList = missing.filter((e) => !needle || `${fullName(e)} ${e.department_name || ''}`.toLowerCase().includes(needle));

  const isToday = !multi && date === ubToday();
  const people = new Set(acks.data.map((a) => a.user_id)).size;
  const days = new Set(acks.data.map((a) => a.ack_date)).size;
  const label = multi ? (mode === 'all' ? 'Бүх хугацаа' : `${from} — ${to}`) : date;
  // Хэвлэх / PDF / хуваалцах хуудасны өгөгдөл.
  const sheet: Sheet = {
    date: from,
    date_to: to,
    instruction: instr.data,
    total,
    acks: acks.data.map((a) => {
      const e = byUser.get(a.user_id);
      return { id: a.id, ack_date: a.ack_date, user_id: a.user_id, name: fullName(e) || a.user_name || 'Ажилтан', department: e?.department_name || e?.position || null, avatar_url: e?.avatar_url, signed_at: a.signed_at, signature_url: a.signature_url, instruction_updated_at: a.instruction_updated_at };
    }),
  };
  const zoomSheet = (h: HaabAck) => setZoom(acks.data.find((a) => a.id === h.id) || null);
  const pdf = async () => {
    setPdfBusy(true);
    try {
      await downloadPdf(sheet);
    } catch (e) {
      window.alert((e as Error).message || 'PDF үүсгэж чадсангүй.');
    } finally {
      setPdfBusy(false);
    }
  };
  const exportExcel = () => {
    const rows: (string | number)[][] = [['Огноо', 'Ажилтан', 'Хэлтэс', 'Төлөв', 'Цаг', 'Гарын үсэг (холбоос)']];
    acks.data.forEach((a) => {
      const e = byUser.get(a.user_id);
      rows.push([a.ack_date, fullName(e) || a.user_name || '', e?.department_name || '', 'Зурсан', timeOf(a.signed_at), a.signature_url && /^https?:/.test(a.signature_url) ? a.signature_url : '']);
    });
    if (!multi) missing.forEach((e) => rows.push([date, fullName(e), e.department_name || '', 'Зураагүй', '', '']));
    void downloadSheets(`haab_garyn_useg_${multi ? `${from}_${to}` : date}.xlsx`, [{ name: 'ХААБ', rows }]);
  };

  const loading = emps.loading || acks.loading;
  const error = emps.error || acks.error;

  return (
    <>
      <PageHeader
        title="ХААБ гарын үсэг"
        crumb="Хөдөлмөрийн аюулгүй байдал"
        description="Ажилтнууд өдөр бүр апп-аас ХААБ зааврыг уншаад утсан дээрээ гарын үсэг зурна. Өдөр, сар, он эсвэл бүх хугацаагаар шүүж харна."
        actions={
          <>
            <div className="inline-flex rounded-[var(--radius)] bg-card2 p-1" role="tablist" aria-label="Хугацаа">
              {MODES.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-[var(--radius-sm)] px-3 py-1 text-[12px] font-semibold ${mode === k ? 'bg-card text-ink shadow-[var(--shadow)]' : 'text-muted hover:text-ink'}`}>{l}</button>
              ))}
            </div>
            {mode !== 'all' ? (
              <div className="flex items-center gap-1">
                <Button variant="outline" className="!px-2.5" aria-label="Өмнөх" onClick={() => setDate((d) => step(mode, d, -1))}><ChevronLeft size={16} /></Button>
                {mode === 'day' ? (
                  <Input type="date" value={date} max={ubToday()} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-[150px]" aria-label="Огноо" />
                ) : mode === 'month' ? (
                  <Input type="month" value={date.slice(0, 7)} max={ubToday().slice(0, 7)} onChange={(e) => e.target.value && setDate(`${e.target.value}-01`)} className="w-[150px]" aria-label="Сар" />
                ) : (
                  <Input type="number" value={date.slice(0, 4)} min={2020} max={Number(ubToday().slice(0, 4))} onChange={(e) => /^\d{4}$/.test(e.target.value) && setDate(`${e.target.value}-01-01`)} className="w-[96px]" aria-label="Он" />
                )}
                <Button variant="outline" className="!px-2.5" aria-label="Дараагийн" disabled={to >= ubToday()} onClick={() => setDate((d) => step(mode, d, 1))}><ChevronRight size={16} /></Button>
              </div>
            ) : null}
            {mode === 'day' && !isToday ? <Button variant="ghost" onClick={() => setDate(ubToday())}>Өнөөдөр</Button> : null}
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={() => { emps.reload(); acks.reload(); instr.reload(); }}>Шинэчлэх</Button>
            <Button variant="outline" icon={<Printer size={15} />} disabled={loading || !!error} onClick={() => { setTab('sheet'); setTimeout(() => window.print(), 300); }}>Хэвлэх{tab === 'sheet' ? ` · ${pages} хуудас` : ''}</Button>
            <Button variant="outline" icon={<FileDown size={15} />} disabled={loading || !!error || pdfBusy} onClick={pdf}>{pdfBusy ? 'PDF…' : 'PDF'}</Button>
            <Button variant="outline" icon={<Download size={15} />} disabled={loading || !!error} onClick={exportExcel}>Excel</Button>
            <Button icon={<Share2 size={15} />} disabled={loading || !!error} onClick={() => setShare(true)}>Хуваалцах</Button>
          </>
        }
      />

      {loading && !acks.data.length && !emps.data.length ? (
        <Loading />
      ) : error ? (
        <ErrorState text={error} onRetry={() => { emps.reload(); acks.reload(); }} />
      ) : (
        <>
          {multi ? (
          <KpiRow>
            <StatCard tone="green" icon={<PenLine size={19} />} value={signed} label="Нийт гарын үсэг" note={label} />
            <StatCard tone="blue" icon={<Users size={19} />} value={people} label="Зурсан ажилтан" note={`${total} ажилтнаас`} />
            <StatCard tone="violet" icon={<Clock size={19} />} value={days} label="Өдөр" note="Гарын үсэгтэй өдөр" />
            <StatCard tone="teal" icon={<CheckCircle2 size={19} />} value={days ? (signed / days).toFixed(1) : '0'} label="Өдөрт дунджаар" />
          </KpiRow>
          ) : (
          <KpiRow>
            <StatCard tone="blue" icon={<Users size={19} />} value={total} label="Нийт ажилтан" note="Апп-д бүртгэлтэй" />
            <StatCard tone="green" icon={<CheckCircle2 size={19} />} value={signed} label="Гарын үсэг зурсан" note={isToday ? 'Өнөөдөр' : date} />
            <StatCard tone="rose" icon={<XCircle size={19} />} value={missing.length} label="Зураагүй" />
            <StatCard tone="teal" icon={<PenLine size={19} />} value={`${pct}%`} label="Хамрагдалт" />
          </KpiRow>
          )}

          <Card
            title={tab === 'sheet' ? 'Гарын үсгийн хуудас' : tab === 'signed' ? `Гарын үсэг зурсан (${signed})` : `Зураагүй (${missing.length})`}
            icon={<PenLine size={17} />}
            bodyClassName={tab === 'sheet' ? 'p-3 sm:p-4' : 'p-0'}
            actions={
              <>
                <div className="inline-flex rounded-[var(--radius)] bg-card2 p-1" role="tablist">
                  {([['sheet', 'Хуудас'], ['signed', `Зурсан ${signed}`], ...(multi ? [] : [['missing', `Зураагүй ${missing.length}`]])] as ['sheet' | 'signed' | 'missing', string][]).map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-[var(--radius-sm)] px-3 py-1 text-[12px] font-semibold ${tab === k ? 'bg-card text-ink shadow-[var(--shadow)]' : 'text-muted hover:text-ink'}`}>{l}</button>
                  ))}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
                  <Input placeholder="Нэр, хэлтэс" value={q} onChange={(e) => setQ(e.target.value)} className="w-44 pl-8" />
                </div>
              </>
            }
          >
            {tab === 'sheet' ? (
              <HaabSheet sheet={sheet} onZoom={zoomSheet} onPages={setPages} />
            ) : tab === 'signed' ? (
              !signedList.length ? (
                <EmptyState text={q ? `«${q}» олдсонгүй.` : isToday ? 'Өнөөдөр хараахан хэн ч гарын үсэг зураагүй байна.' : multi ? 'Энэ хугацаанд гарын үсэг зурсан ажилтан алга.' : 'Энэ өдөр гарын үсэг зурсан ажилтан алга.'} />
              ) : (
                <ul className="divide-y divide-line">
                  {signedList.map((a, i) => {
                    const e = byUser.get(a.user_id);
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
                        <span className="w-6 shrink-0 text-right text-[12px] tabular-nums text-subtle">{i + 1}</span>
                        <Avatar name={fullName(e) || a.user_name} src={e?.avatar_url} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-ink">{fullName(e) || a.user_name || 'Ажилтан'}</p>
                          <p className="flex items-center gap-1.5 truncate text-[12px] text-muted">
                            {e?.department_name || e?.position || 'Хэлтэсгүй'}
                            <span aria-hidden="true">·</span>
                            <Clock size={12} /> {multi ? `${a.ack_date} ` : ''}{timeOf(a.signed_at)}
                          </p>
                        </div>
                        <Signature ack={a} onOpen={() => setZoom(a)} />
                      </li>
                    );
                  })}
                </ul>
              )
            ) : !missingList.length ? (
              <EmptyState text={q ? `«${q}» олдсонгүй.` : 'Бүх ажилтан гарын үсэг зурсан байна.'} />
            ) : (
              <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
                {missingList.map((e) => (
                  <li key={e.record_id} className="flex items-center gap-3 bg-card px-4 py-3 sm:px-6">
                    <Avatar name={fullName(e) || e.email} src={e.avatar_url} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{fullName(e) || e.email || 'Ажилтан'}</p>
                      <p className="truncate text-[12px] text-muted">{e.department_name || e.position || 'Хэлтэсгүй'}</p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">Зураагүй</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {share ? <ShareDialog from={from} to={to} label={label} onClose={() => setShare(false)} /> : null}

      {zoom ? (
        <Modal title={`${fullName(byUser.get(zoom.user_id)) || zoom.user_name || 'Ажилтан'} — гарын үсэг`} onClose={() => setZoom(null)}>
          <Signature ack={zoom} large />
          <p className="mt-3 text-[13px] text-muted">{zoom.ack_date} · {timeOf(zoom.signed_at)}-д зурсан</p>
        </Modal>
      ) : null}
    </>
  );
}

/** Нийтийн холбоос — нэвтрэлтгүйгээр тухайн өдрийн хуудсыг харна. */
function ShareDialog({ from, to, label, onClose }: { from: string; to: string; label: string; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    shareLink(from, to).then(setUrl).catch((e) => setErr((e as Error).message)).finally(() => setBusy(false));
  }, [from, to]);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const revoke = async () => {
    if (!window.confirm('Холбоосыг хүчингүй болгох уу? Өмнө илгээсэн холбоос ажиллахаа больно.')) return;
    setBusy(true);
    try {
      await revokeShare(from, to);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal title={`Нийтэд хуваалцах — ${label}`} onClose={onClose}>
      <p className="text-[13px] leading-5 text-muted">Энэ холбоостой хэн ч нэвтрэлгүйгээр сонгосон хугацааны зааврын гол заалт, гарын үсэг зурсан ажилтнууд болон гарын үсгийг харж, хэвлэж, PDF татаж чадна.</p>
      {busy && !url ? <Loading text="Холбоос үүсгэж байна…" /> : null}
      {url ? (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.target.select()} className="font-mono text-[12px]" />
            <Button icon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={copy}>{copied ? 'Хуулсан' : 'Хуулах'}</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-line px-3.5 text-[13px] font-medium text-ink hover:bg-hover"><Link2 size={15} /> Нээж харах</a>
            <Button variant="ghost" className="hover:!text-danger" disabled={busy} onClick={revoke}>Холбоосыг хүчингүй болгох</Button>
          </div>
        </div>
      ) : null}
      {err ? <p className="mt-3 text-[13px] text-danger" role="alert">{err}</p> : null}
    </Modal>
  );
}
