import { useMemo, useState } from 'react';
import { Download, History, RefreshCw, Search, Table2 } from 'lucide-react';
import { PageHeader, Card, Input, Select, Button, Loading, ErrorState, EmptyState } from '../components/ui';
import { useAsync } from '../lib/data';
import { supabase } from '../lib/supabase';
import { downloadSheets } from '../lib/attendanceExport';

/**
 * arhiv.gennetex.com — Нийт лог ба Excel архив.
 *
 * Хуучин панелийн (iframe) модулиудыг орлоно. Логийг сар сараар нь серверээс
 * татна — хуучин хувилбар шиг сүүлийн 2000 мөрөөр хязгаарлагдахгүй.
 */

const MONTHS = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];
const pad = (n: number) => String(n).padStart(2, '0');
const fmtTime = (ts: string) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const thisYear = new Date().getFullYear();
const years = Array.from({ length: 4 }, (_, i) => thisYear - i);

function MonthGrid({ counts, month, onPick, unit }: { counts: number[]; month: number; onPick: (m: number) => void; unit: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-12">
      {MONTHS.map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => onPick(i + 1)}
          aria-pressed={month === i + 1}
          className={`focus-ring rounded-[var(--radius-sm)] border px-2 py-2 text-left transition ${month === i + 1 ? 'border-brand bg-brand-soft' : 'border-line bg-card2 hover:border-brand'}`}
        >
          <span className="block text-[12px] text-muted">{l}</span>
          <span className="block text-[17px] font-semibold text-ink">{counts[i] ?? 0}</span>
          <span className="block text-[11px] text-subtle">{unit}</span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════ Нийт лог ═══════════════════════ */
type LogRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  action: string | null;
  screen: string | null;
  detail: string | null;
  latitude: number | null;
  longitude: number | null;
};
const ACTION_LABEL: Record<string, string> = {
  login: 'Нэвтрэлт', leave_request: 'Чөлөө хүсэлт', screen: 'Дэлгэц нээсэн', tap: 'Даралт', location: 'Байршил',
  face_enroll: 'Царай бүртгэл', attendance: 'Ирц', inventory: 'Бараа/багаж', visit: 'Айлд очсон',
  site_work: 'Ажлын байр', service_call: 'Дуудлага', other: 'Бусад',
};
const actionLabel = (a: string | null) => (a ? ACTION_LABEL[a] || a : '—');

async function fetchMonthCounts(table: string, column: string, year: number) {
  // Сар бүрийн тоо — head:true count, мөр татахгүй.
  return Promise.all(
    MONTHS.map(async (_, i) => {
      const from = new Date(year, i, 1).toISOString();
      const to = new Date(year, i + 1, 1).toISOString();
      const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).gte(column, from).lt(column, to);
      return count || 0;
    })
  );
}

export function ActivityLogsPage() {
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(0);
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [exporting, setExporting] = useState(false);

  const counts = useAsync<number[]>(() => fetchMonthCounts('activity_logs', 'created_at', year), [year], []);
  const logs = useAsync<LogRow[]>(
    async () => {
      const from = new Date(year, month - 1, day || 1).toISOString();
      const to = day ? new Date(year, month - 1, day + 1).toISOString() : new Date(year, month, 1).toISOString();
      const out: LogRow[] = [];
      // Supabase нэг удаад 1000 мөр — хуудаслаж бүгдийг авна.
      for (let page = 0; page < 50; page++) {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('id, created_at, user_id, user_name, action, screen, detail, latitude, longitude')
          .gte('created_at', from)
          .lt('created_at', to)
          .order('created_at', { ascending: false })
          .range(page * 1000, page * 1000 + 999);
        if (error) throw error;
        out.push(...((data || []) as LogRow[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    [year, month, day],
    []
  );

  const users = useMemo(() => [...new Map(logs.data.filter((x) => x.user_id).map((x) => [x.user_id!, x.user_name || x.user_id!])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'mn')), [logs.data]);
  const actions = useMemo(() => [...new Set(logs.data.map((x) => x.action).filter(Boolean))] as string[], [logs.data]);
  const needle = q.trim().toLowerCase();
  const list = logs.data.filter(
    (x) =>
      (!user || x.user_id === user) &&
      (!action || x.action === action) &&
      (!needle || `${x.user_name} ${x.screen} ${x.detail}`.toLowerCase().includes(needle))
  );
  const days = new Date(year, month, 0).getDate();

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows: (string | number)[][] = [['Он', 'Сар', 'Өдөр', 'Цаг', 'Ажилтан', 'Үйлдэл', 'Дэлгэц', 'Дэлгэрэнгүй', 'Өргөрөг', 'Уртраг']];
      list.forEach((x) => {
        const d = new Date(x.created_at);
        rows.push([d.getFullYear(), d.getMonth() + 1, d.getDate(), `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, x.user_name || '', actionLabel(x.action), x.screen || '', x.detail || '', x.latitude ?? '', x.longitude ?? '']);
      });
      await downloadSheets(`gennetex_niit_log_${year}${pad(month)}${day ? pad(day) : ''}.xlsx`, [{ name: 'Нийт лог', rows }]);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Нийт лог"
        crumb="Архив"
        description="Апп-аас ирсэн бүх үйлдлийн бүртгэл. Сар, өдөр, ажилтнаар шүүж Excel-ээр татна."
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={() => { counts.reload(); logs.reload(); }}>Шинэчлэх</Button>
            <Button icon={<Download size={15} />} disabled={!list.length || exporting} onClick={exportExcel}>{exporting ? 'Бэлтгэж байна…' : 'Excel татах'}</Button>
          </>
        }
      />
      <Card title={`${year} он — сар бүрийн лог`} icon={<History size={17} />} className="mb-5" actions={
        <Select value={year} onChange={(e) => { setYear(Number(e.target.value)); setDay(0); }} aria-label="Он">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
      }>
        <MonthGrid counts={counts.data} month={month} onPick={(m) => { setMonth(m); setDay(0); }} unit="лог" />
      </Card>

      <Card
        title={`${MONTHS[month - 1]}${day ? ` ${day}` : ''} — ${list.length} лог`}
        bodyClassName="p-0"
        actions={
          <>
            <Select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Өдөр">
              <option value={0}>Бүх өдөр</option>
              {Array.from({ length: days }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </Select>
            <Select value={user} onChange={(e) => setUser(e.target.value)} aria-label="Ажилтан">
              <option value="">Бүх ажилтан</option>
              {users.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </Select>
            <Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Үйлдэл">
              <option value="">Бүх үйлдэл</option>
              {actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
            </Select>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
              <Input placeholder="Хайх" value={q} onChange={(e) => setQ(e.target.value)} className="w-40 pl-8" />
            </div>
          </>
        }
      >
        {logs.loading ? (
          <Loading />
        ) : logs.error ? (
          <div className="p-4"><ErrorState text={logs.error} onRetry={logs.reload} /></div>
        ) : !list.length ? (
          <EmptyState text="Энэ хугацаанд лог алга." />
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead className="sticky top-0 bg-card2 text-left text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Огноо</th>
                  <th className="px-4 py-2 font-medium">Ажилтан</th>
                  <th className="px-4 py-2 font-medium">Үйлдэл</th>
                  <th className="px-4 py-2 font-medium">Дэлгэц</th>
                  <th className="px-4 py-2 font-medium">Дэлгэрэнгүй</th>
                  <th className="px-4 py-2 font-medium">Байршил</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.slice(0, 3000).map((x) => (
                  <tr key={x.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-muted">{fmtTime(x.created_at)}</td>
                    <td className="px-4 py-2 font-medium text-ink">{x.user_name || '—'}</td>
                    <td className="px-4 py-2"><span className="rounded-full bg-brand-soft px-2 py-0.5 text-[12px] text-brand">{actionLabel(x.action)}</span></td>
                    <td className="px-4 py-2 text-ink">{x.screen || '—'}</td>
                    <td className="max-w-[420px] break-words px-4 py-2 text-muted">{x.detail || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted">
                      {x.latitude != null && x.longitude != null ? (
                        <a className="underline" href={`https://www.google.com/maps?q=${x.latitude},${x.longitude}`} target="_blank" rel="noreferrer">
                          {Number(x.latitude).toFixed(4)}, {Number(x.longitude).toFixed(4)}
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > 3000 ? <p className="p-3 text-center text-[12px] text-muted">Эхний 3000 мөрийг харууллаа — бүгдийг Excel-ээр татна уу.</p> : null}
          </div>
        )}
      </Card>
    </>
  );
}

/* ═══════════════════════ Excel архив ═══════════════════════ */
type ExcelRow = {
  id: string;
  created_at: string;
  export_year: number;
  export_month: number;
  export_day: number;
  category: string | null;
  title: string | null;
  filename: string | null;
  file_url: string | null;
  sheet_names: string[] | null;
  sheet_counts: Record<string, number> | null;
  row_count: number | null;
  created_by_name: string | null;
};
const CAT_LABEL: Record<string, string> = {
  irts: 'Ирц', ocson_log: 'Очсон лог', ajlyn_bair: 'Ажлын байр', ayalal: 'Аялал', baraa_hereglee: 'Барааны хэрэглээ',
  hamt_yvaa_bag: 'Хамт яваа баг', negtgesen: 'Нэгтгэсэн', niit_log: 'Нийт лог', ajilchdyn_guitsetgel: 'Ажилчдын гүйцэтгэл',
};

export function ExcelArchivePage() {
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(0);
  const [category, setCategory] = useState('');
  const { data, loading, error, reload } = useAsync<ExcelRow[]>(
    async () => {
      const { data, error } = await supabase.from('excel_archives').select('*').eq('export_year', year).order('created_at', { ascending: false }).limit(5000);
      if (error) throw error;
      return (data || []) as ExcelRow[];
    },
    [year],
    []
  );
  const counts = MONTHS.map((_, i) => data.filter((x) => x.export_month === i + 1).length);
  const cats = [...new Set(data.map((x) => x.category).filter(Boolean))] as string[];
  const list = data.filter((x) => (!month || x.export_month === month) && (!category || x.category === category));

  return (
    <>
      <PageHeader
        title="Excel архив"
        crumb="Архив"
        description="Апп болон панелаас татсан бүх Excel файл Supabase дээр хадгалагдана."
        actions={<Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload}>Шинэчлэх</Button>}
      />
      <Card title={`${year} он — сар бүрийн Excel`} icon={<Table2 size={17} />} className="mb-5" actions={
        <>
          <Select value={year} onChange={(e) => { setYear(Number(e.target.value)); setMonth(0); }} aria-label="Он">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          {month ? <Button variant="ghost" onClick={() => setMonth(0)}>Бүх сар</Button> : null}
        </>
      }>
        <MonthGrid counts={counts} month={month} onPick={(m) => setMonth(m === month ? 0 : m)} unit="Excel" />
      </Card>
      <Card
        title={`Файлууд (${list.length})`}
        bodyClassName="p-0"
        actions={
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Төрөл">
            <option value="">Бүх төрөл</option>
            {cats.map((c) => <option key={c} value={c}>{CAT_LABEL[c] || c}</option>)}
          </Select>
        }
      >
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-4"><ErrorState text={error} onRetry={reload} /></div>
        ) : !list.length ? (
          <EmptyState text="Шүүлтүүрт тохирох Excel алга." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead className="bg-card2 text-left text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Огноо</th>
                  <th className="px-4 py-2 font-medium">Төрөл</th>
                  <th className="px-4 py-2 font-medium">Файл</th>
                  <th className="px-4 py-2 font-medium">Sheet</th>
                  <th className="px-4 py-2 font-medium">Мөр</th>
                  <th className="px-4 py-2 font-medium">Үүсгэсэн</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((x) => (
                  <tr key={x.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-muted">{x.export_year}-{pad(x.export_month)}-{pad(x.export_day)}</td>
                    <td className="px-4 py-2 text-ink">{(x.category && CAT_LABEL[x.category]) || x.title || x.category || '—'}</td>
                    <td className="break-all px-4 py-2 text-ink">{x.filename || '—'}</td>
                    <td className="px-4 py-2 text-muted">{(x.sheet_names || []).map((n) => `${n}${x.sheet_counts?.[n] != null ? ` (${x.sheet_counts[n]})` : ''}`).join(', ') || '—'}</td>
                    <td className="px-4 py-2 text-ink">{x.row_count || 0}</td>
                    <td className="px-4 py-2 text-muted">{x.created_by_name || '—'}<br />{fmtTime(x.created_at)}</td>
                    <td className="px-4 py-2 text-right">
                      {x.file_url ? (
                        <a href={x.file_url} target="_blank" rel="noreferrer" className="focus-ring inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] bg-brand px-3 text-[12px] font-semibold text-white">
                          <Download size={13} /> Татах
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
