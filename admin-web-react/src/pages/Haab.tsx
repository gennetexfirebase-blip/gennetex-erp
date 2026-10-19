import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, PenLine, RefreshCw, Search, Users, XCircle } from 'lucide-react';
import { PageHeader, Card, Button, Input, Avatar, Loading, ErrorState, EmptyState, StatCard, KpiRow, Modal } from '../components/ui';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';
import { supabase } from '../lib/supabase';
import { downloadSheets } from '../lib/attendanceExport';

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

type Ack = { id: string; user_id: string; user_name: string | null; ack_date: string; signature_url: string | null; signed_at: string | null };

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

async function fetchAcks(date: string) {
  const { data, error } = await supabase.from('ohaab_daily_ack').select('id, user_id, user_name, ack_date, signature_url, signed_at').eq('ack_date', date).order('signed_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Ack[];
}

/** Гарын үсэг — шөнийн горимд ч харагдахаар үргэлж цагаан «цаасан» дээр. */
function Signature({ ack, onOpen, large = false }: { ack: Ack; onOpen?: () => void; large?: boolean }) {
  const src = sigSrc(ack);
  if (!src) return <span className="text-[12px] text-subtle">Зураг алга</span>;
  const box = large ? 'h-56 w-full' : 'h-14 w-40';
  const img = <img src={src} alt={`${ack.user_name || 'Ажилтан'} — гарын үсэг`} loading="lazy" className="h-full w-full object-contain" />;
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`focus-ring ${box} shrink-0 rounded-[var(--radius-sm)] border border-line bg-white p-1.5 hover:border-brand`} aria-label="Гарын үсгийг томоор харах">
      {img}
    </button>
  ) : (
    <div className={`${box} rounded-[var(--radius)] border border-line bg-white p-3`}>{img}</div>
  );
}

export default function HaabPage() {
  const [date, setDate] = useState(ubToday());
  const [tab, setTab] = useState<'signed' | 'missing'>('signed');
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState<Ack | null>(null);
  const emps = useAsync<Employee[]>(fetchEmployees, [], []);
  const acks = useAsync<Ack[]>(() => fetchAcks(date), [date], []);

  // Өнөөдрийг харж байхад 30 секунд тутам шинэчилнэ — апп-аас шинэ гарын үсэг орж ирнэ.
  useEffect(() => {
    if (date !== ubToday()) return;
    const id = window.setInterval(acks.reload, 30_000);
    return () => window.clearInterval(id);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isToday = date === ubToday();
  const exportExcel = () => {
    const rows: (string | number)[][] = [['Огноо', 'Ажилтан', 'Хэлтэс', 'Төлөв', 'Цаг', 'Гарын үсэг (холбоос)']];
    acks.data.forEach((a) => {
      const e = byUser.get(a.user_id);
      rows.push([date, fullName(e) || a.user_name || '', e?.department_name || '', 'Зурсан', timeOf(a.signed_at), a.signature_url && /^https?:/.test(a.signature_url) ? a.signature_url : '']);
    });
    missing.forEach((e) => rows.push([date, fullName(e), e.department_name || '', 'Зураагүй', '', '']));
    void downloadSheets(`haab_garyn_useg_${date}.xlsx`, [{ name: 'ХААБ', rows }]);
  };

  const loading = emps.loading || acks.loading;
  const error = emps.error || acks.error;

  return (
    <>
      <PageHeader
        title="ХААБ гарын үсэг"
        crumb="Хөдөлмөрийн аюулгүй байдал"
        description="Ажилтнууд өдөр бүр апп-аас ХААБ зааврыг уншаад утсан дээрээ гарын үсэг зурна. Энд тухайн өдөр хэн зурсан, хэн зураагүйг гарын үсгийн хамт харна."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="outline" className="!px-2.5" aria-label="Өмнөх өдөр" onClick={() => setDate((d) => shift(d, -1))}><ChevronLeft size={16} /></Button>
              <Input type="date" value={date} max={ubToday()} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-[150px]" aria-label="Огноо" />
              <Button variant="outline" className="!px-2.5" aria-label="Дараагийн өдөр" disabled={isToday} onClick={() => setDate((d) => shift(d, 1))}><ChevronRight size={16} /></Button>
            </div>
            {!isToday ? <Button variant="ghost" onClick={() => setDate(ubToday())}>Өнөөдөр</Button> : null}
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={() => { emps.reload(); acks.reload(); }}>Шинэчлэх</Button>
            <Button icon={<Download size={15} />} disabled={loading || !!error} onClick={exportExcel}>Excel</Button>
          </>
        }
      />

      {loading && !acks.data.length && !emps.data.length ? (
        <Loading />
      ) : error ? (
        <ErrorState text={error} onRetry={() => { emps.reload(); acks.reload(); }} />
      ) : (
        <>
          <KpiRow>
            <StatCard tone="blue" icon={<Users size={19} />} value={total} label="Нийт ажилтан" note="Апп-д бүртгэлтэй" />
            <StatCard tone="green" icon={<CheckCircle2 size={19} />} value={signed} label="Гарын үсэг зурсан" note={isToday ? 'Өнөөдөр' : date} />
            <StatCard tone="rose" icon={<XCircle size={19} />} value={missing.length} label="Зураагүй" />
            <StatCard tone="teal" icon={<PenLine size={19} />} value={`${pct}%`} label="Хамрагдалт" />
          </KpiRow>

          <Card
            title={tab === 'signed' ? `Гарын үсэг зурсан (${signed})` : `Зураагүй (${missing.length})`}
            icon={<PenLine size={17} />}
            bodyClassName="p-0"
            actions={
              <>
                <div className="inline-flex rounded-[var(--radius)] bg-card2 p-1" role="tablist">
                  {([['signed', `Зурсан ${signed}`], ['missing', `Зураагүй ${missing.length}`]] as const).map(([k, l]) => (
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
            {tab === 'signed' ? (
              !signedList.length ? (
                <EmptyState text={q ? `«${q}» олдсонгүй.` : isToday ? 'Өнөөдөр хараахан хэн ч гарын үсэг зураагүй байна.' : 'Энэ өдөр гарын үсэг зурсан ажилтан алга.'} />
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
                            <Clock size={12} /> {timeOf(a.signed_at)}
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

      {zoom ? (
        <Modal title={`${fullName(byUser.get(zoom.user_id)) || zoom.user_name || 'Ажилтан'} — гарын үсэг`} onClose={() => setZoom(null)}>
          <Signature ack={zoom} large />
          <p className="mt-3 text-[13px] text-muted">{zoom.ack_date} · {timeOf(zoom.signed_at)}-д зурсан</p>
        </Modal>
      ) : null}
    </>
  );
}
