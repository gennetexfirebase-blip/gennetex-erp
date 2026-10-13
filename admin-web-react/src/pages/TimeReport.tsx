import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';
import {
  MONTH,
  STATUS_LABEL,
  WDAY,
  WDAY_LONG,
  WORK_HOURS,
  attentionList,
  buildModel,
  fetchTimeReport,
  fmtDate,
  h1,
  hm,
  parse,
  rangeFor,
  rangeLabel,
  sendWarnings,
  stepRange,
  toMin,
  todayUB,
  nowMinUB,
  warningMessage,
  type Attention,
  type DayRec,
  type Range,
  type RangeKind,
  type Status,
  type Summary,
  type TrEmployee,
  type TrModel,
} from '../lib/timeReport';
import brandMark from '../assets/logo-mark.png';
import ExportPreview from './TimeReportPreview';
import './time-report.css';

Chart.register(...registerables);
Chart.defaults.font.family = '"IBM Plex Sans", "Segoe UI", Arial, sans-serif';
Chart.defaults.font.size = 12;

/* ───────── Туслах ───────── */
const PAL = ['#24614F', '#3B6A87', '#6A5A8E', '#A6453B', '#94660F', '#2F7D5B', '#5E5A52', '#1D5243', '#7A4E8C', '#B5652B', '#3D7A4C', '#45607A'];
function avaColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PAL[h % PAL.length];
}
const initials = (n: string) => n.replace(/^[^.]*\./, '').slice(0, 2);
const rateVar = (r: number) => (r >= 90 ? 'var(--ok)' : r >= 75 ? 'var(--late)' : 'var(--absent)');
const LONG_DAYS = 62;

function Ava({ e, className = 'ava', style }: { e: TrEmployee; className?: string; style?: CSSProperties }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={className} style={{ background: avaColor(e.id), ...style }} title={e.name}>
      {e.avatar_url && !broken ? <img src={e.avatar_url} alt="" onError={() => setBroken(true)} /> : initials(e.name)}
    </span>
  );
}

const Svg = ({ d, sw = 2 }: { d: ReactNode; sw?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const ICONS = {
  late: <><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="8.5" /></>,
  absent: <><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6m0-6-6 6" /></>,
  over: <><path d="M4 17l5-5 4 4 7-8" /><path d="M15 8h5v5" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
  down: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />,
  prev: <path d="m15 6-6 6 6 6" />,
  next: <path d="m9 6 6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
};

/** Chart.js-ийг React-д: config солигдох бүрт дахин зурна. */
function ChartBox({ config, height, label }: { config: ChartConfiguration | null; height?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current || !config) return;
    const c = new Chart(ref.current, config);
    return () => c.destroy();
  }, [config]);
  return (
    <div className="chart" style={height ? { height } : undefined}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}

type Colors = Record<string, string>;
function readColors(el: HTMLElement | null): Colors {
  const cs = el ? getComputedStyle(el) : null;
  const v = (k: string) => (cs ? cs.getPropertyValue(k).trim() : '') || '#888';
  return Object.fromEntries(['--ink', '--ink-2', '--ink-3', '--paper', '--rule', '--ok', '--late', '--leave', '--absent', '--brand', '--off', '--surface'].map((k) => [k.slice(2), v(k)]));
}
function baseOpts(c: Colors, extra: Record<string, unknown> = {}) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return {
    maintainAspectRatio: false,
    animation: { duration: reduce ? 0 : 500 },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: c.ink, titleColor: c.paper, bodyColor: c.paper, padding: 10, cornerRadius: 10, displayColors: true, boxPadding: 4 },
    },
    ...extra,
  };
}

/* ═══════════════════════════════════════════════════════════════════ */

export type TimeReportProps = {
  variant: 'standalone' | 'embedded';
  accessKey?: string | null;
  canSend?: boolean;
  /** Ирээдүйн өдөр дээр дарахад (Хуваарь руу шилжүүлэх). */
  onPlanDay?: (date: string) => void;
  headerRight?: ReactNode;
  title?: string;
  /** Сонгосон хугацааг гаднаас (Хуваарийн сартай) уях. */
  initialRange?: Range;
};

export default function TimeReport({ variant, accessKey = null, canSend = true, onPlanDay, headerRight, title = 'Цагийн тайлан', initialRange }: TimeReportProps) {
  const root = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>(initialRange || rangeFor('month'));
  const [custom, setCustom] = useState({ from: range.from, to: range.to });
  const [model, setModel] = useState<TrModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dept, setDept] = useState('');
  const [sort, setSort] = useState('rate');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'status' | 'time'>('status');
  const [current, setCurrent] = useState<{ id: string; date?: string } | null>(null);
  const [colors, setColors] = useState<Colors>({});
  const [preview, setPreview] = useState<{ kind: 'xlsx' | 'pdf'; employee?: TrEmployee } | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (r: Range) => {
    if (r.from > r.to) return setError('Эхлэх огноо дуусах огнооноос өмнө байх ёстой.');
    setLoading(true);
    setError('');
    try {
      const raw = await fetchTimeReport(r.from, r.to, accessKey);
      setModel(buildModel(raw, r.from, r.to));
    } catch (e: any) {
      setError(e?.message === 'forbidden' ? 'Энэ тайланг харах эрх алга байна.' : `Өгөгдөл татаж чадсангүй. Сүлжээ болон нэвтрэлтээ шалгаад дахин оролдоно уу. (${e?.message || e})`);
    } finally {
      setLoading(false);
    }
  }, [accessKey]);

  useEffect(() => {
    load(range);
    setCustom({ from: range.from, to: range.to });
  }, [range, load]);

  // Өнгө (light/dark)-ийг CSS хувьсагчаас уншина.
  useEffect(() => {
    const upd = () => setColors(readColors(root.current));
    upd();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', upd);
    return () => mq?.removeEventListener?.('change', upd);
  }, []);

  // Tooltip элемент — body-д (drawer, scroll-оос үл хамааран).
  useEffect(() => {
    const el = document.createElement('div');
    el.className = 'tr-tip';
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);
    tip.current = el;
    const hide = () => el.classList.remove('on');
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('scroll', hide, true);
      el.remove();
    };
  }, []);

  // Хаягаас #emp=<id> (standalone).
  useEffect(() => {
    if (variant !== 'standalone' || !model) return;
    const id = new URLSearchParams(window.location.hash.slice(1)).get('emp');
    if (id && model.sum.has(id)) setCurrent({ id });
  }, [model, variant]);

  const depts = useMemo(() => (model ? [...new Set(model.emps.map((e) => e.department))].sort((a, b) => a.localeCompare(b, 'mn')) : []), [model]);
  const visible = useMemo(() => {
    if (!model) return [];
    const needle = q.trim().toLowerCase();
    const S = (e: TrEmployee) => model.sum.get(e.id)!;
    const by: Record<string, (a: TrEmployee, b: TrEmployee) => number> = {
      rate: (a, b) => S(a).rate - S(b).rate || a.name.localeCompare(b.name, 'mn'),
      late: (a, b) => S(b).late - S(a).late || S(b).lateMin - S(a).lateMin,
      hours: (a, b) => S(b).hours - S(a).hours,
      name: (a, b) => a.name.localeCompare(b.name, 'mn'),
    };
    return model.emps.filter((e) => e.name.toLowerCase().includes(needle) && (!dept || e.department === dept)).sort(by[sort]);
  }, [model, q, dept, sort]);

  const scoped = useMemo(() => (model ? model.emps.filter((e) => !dept || e.department === dept) : []), [model, dept]);
  const attention = useMemo(() => (model ? attentionList(model).filter((a) => scoped.includes(a.emp)) : []), [model, scoped]);

  const openEmp = (id: string, date?: string) => {
    setCurrent({ id, date });
    if (variant === 'standalone') window.history.replaceState(null, '', `#emp=${id}`);
  };
  const closeEmp = () => {
    setCurrent(null);
    if (variant === 'standalone') window.history.replaceState(null, '', window.location.pathname + window.location.search);
  };
  const stepEmp = (dir: number) => {
    const list = visible.length ? visible : model?.emps || [];
    const i = list.findIndex((e) => e.id === current?.id);
    if (list.length) setCurrent({ id: list[(i + dir + list.length) % list.length].id });
  };

  // Гарын товчлол.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const typing = /INPUT|SELECT|TEXTAREA/.test((document.activeElement as HTMLElement)?.tagName || '');
      if (ev.key === '/' && !current && !typing && variant === 'standalone') {
        ev.preventDefault();
        root.current?.querySelector<HTMLInputElement>('#tr-q')?.focus();
      }
      if (!current) return;
      if (ev.key === 'Escape') closeEmp();
      if (ev.altKey && ev.key === 'ArrowLeft') stepEmp(-1);
      if (ev.altKey && ev.key === 'ArrowRight') stepEmp(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (variant !== 'standalone') return;
    document.body.style.overflow = current ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [current, variant]);

  const pick = (kind: Exclude<RangeKind, 'custom'>) => setRange(rangeFor(kind));
  const canNext = range.kind === 'custom' || stepRange(range, 1).from <= todayUB();

  /** Татахаас өмнө вэб дээр урьдчилан харуулна (цонх доторх товчоор татна). */
  const doExport = (kind: 'xlsx' | 'pdf', employee?: TrEmployee) => {
    if (model) setPreview({ kind, employee });
  };

  const showTip = (target: HTMLElement) => {
    const el = tip.current;
    if (!el || !model) return;
    const cell = target.closest<HTMLElement>('[data-e]');
    if (!cell || !cell.dataset.d) return el.classList.remove('on');
    const e = model.emps.find((x) => x.id === cell.dataset.e);
    const s = model.sum.get(cell.dataset.e!);
    if (!e || !s) return;
    let html = '';
    if (cell.dataset.month) {
      const mm = monthStats(s, cell.dataset.d);
      html = `<b>${esc(e.name)}</b><br>${MONTH[parse(cell.dataset.d + '-01').getMonth()]}<br>Ирц ${mm.rate}%, ирсэн ${mm.present}/${mm.work}<br>Хоцорсон ${mm.late}, тасалсан ${mm.absent}<br>${h1(mm.hours)} цаг`;
    } else {
      const x = s.days.find((d) => d.date === cell.dataset.d);
      if (!x) return;
      let body = x.status === 'future' && x.shift ? `Хуваарь ${x.shift}` : STATUS_LABEL[x.status];
      if (x.checkIn) body = `${STATUS_LABEL[x.status]}${x.status === 'late' ? `, ${x.lateMin} мин` : ''}<br>Ирсэн ${x.checkIn}${x.checkOut ? `, явсан ${x.checkOut}` : ''}<br>${h1(x.hours)} цаг ажилласан`;
      if (x.remote) body += '<br>Зайнаас';
      if (x.pending) body += '<br>Зөвшөөрөл хүлээж буй';
      if (x.leaveKind && x.status === 'leave') body += `<br>${leaveLabel(x.leaveKind)}`;
      if (x.shift && x.status !== 'future') body += `<br>Хуваарь ${x.shift}`;
      html = `<b>${esc(e.name)}</b><br>${fmtDate(x.date)}, ${WDAY[parse(x.date).getDay()]}<br>${body}`;
    }
    el.innerHTML = html;
    const r = cell.getBoundingClientRect();
    el.style.left = Math.min(window.innerWidth - 240, Math.max(8, r.left + r.width / 2 - 100)) + 'px';
    el.classList.add('on');
    el.style.top = (r.top > 110 ? r.top - el.offsetHeight - 10 : r.bottom + 10) + 'px';
  };

  const cur = current && model ? model.emps.find((e) => e.id === current.id) : null;

  return (
    <div ref={root} className={`tr ${variant}${loading ? ' loading' : ''}`}>
      <header className="top">
        <div className="top-in">
          {variant === 'standalone' ? (
            <div className="brand">
              <div className="mark" aria-hidden="true">
                <img src={brandMark} alt="" width="36" height="36" />
              </div>
              <div>
                <h1>{title}</h1>
                <small>Gennetex ERP</small>
              </div>
            </div>
          ) : null}
          <div className="seg" role="group" aria-label="Хугацаа">
            {([['week', '7 хоног'], ['month', 'Сар'], ['quarter', 'Улирал'], ['year', 'Жил']] as const).map(([k, l]) => (
              <button key={k} aria-pressed={range.kind === k} onClick={() => pick(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="period">
            <button aria-label="Өмнөх хугацаа" onClick={() => setRange(stepRange(range, -1))}>
              <Svg d={ICONS.prev} />
            </button>
            <b>{rangeLabel(range)}</b>
            <button aria-label="Дараагийн хугацаа" disabled={!canNext} onClick={() => setRange(stepRange(range, 1))}>
              <Svg d={ICONS.next} />
            </button>
          </div>
          <div className="range">
            <label className="sr" htmlFor="tr-from">Эхлэх огноо</label>
            <input type="date" id="tr-from" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <span>–</span>
            <label className="sr" htmlFor="tr-to">Дуусах огноо</label>
            <input type="date" id="tr-to" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            <button className="btn solid" onClick={() => setRange({ kind: 'custom', ...custom })}>
              Харах
            </button>
          </div>
          <button className="btn no-print" onClick={() => doExport('xlsx')} disabled={!model} title="Урьдчилан харах, татах">
            <Svg d={ICONS.down} />
            Excel
          </button>
          <button className="btn no-print" onClick={() => doExport('pdf')} disabled={!model} title="Урьдчилан харах, татах">
            <Svg d={ICONS.down} />
            PDF
          </button>
          {headerRight}
        </div>
      </header>

      <main>
        {error ? <div className="banner" role="alert">{error}</div> : null}
        {!model ? (
          loading ? <div className="panel empty">Ачаалж байна…</div> : null
        ) : (
          <>
            <Strip m={model} emps={scoped} />
            <div className="duo2">
              <TodayPanel m={model} emps={scoped} onOpen={openEmp} />
              <section className="panel">
                <div className="panel-h">
                  <div>
                    <h2>Анхаарах зүйлс</h2>
                    <p>Сонгосон хугацааны онцлох мэдээлэл. Дарж дэлгэрэнгүйг харна.</p>
                  </div>
                </div>
                <Insights m={model} emps={scoped} onOpen={openEmp} />
              </section>
            </div>

            <section className="panel mb">
              <div className="panel-h">
                <div>
                  <h2>Ирцийн зураглал</h2>
                  <p>
                    Мөр бүр нэг ажилтан. Нэр эсвэл {model.list.length > LONG_DAYS ? 'сар' : 'өдөр'} дээр дарж дэлгэрэнгүйг харна.
                    {onPlanDay ? ' Ирээдүйн өдөр дээр дарж хуваарь ононо.' : ''}
                  </p>
                </div>
                <div className="tools">
                  <label className="sr" htmlFor="tr-dept">Хэлтэс</label>
                  <select className="field" id="tr-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
                    <option value="">Бүх хэлтэс</option>
                    {depts.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                  <label className="sr" htmlFor="tr-sort">Эрэмбэ</label>
                  <select className="field" id="tr-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="rate">Ирц багаас нь</option>
                    <option value="late">Хоцролт ихээс нь</option>
                    <option value="hours">Цаг ихээс нь</option>
                    <option value="name">Нэрээр</option>
                  </select>
                  <label className="sr" htmlFor="tr-q">Хайх</label>
                  <input className="field" id="tr-q" type="search" placeholder="Ажилтны нэр  ( / )" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>
              <div className="panel-h" style={{ paddingTop: 12 }}>
                {model.list.length <= LONG_DAYS ? (
                  <div className="seg sm" role="group" aria-label="Харагдац">
                    <button aria-pressed={mode === 'status'} onClick={() => setMode('status')}>Төлөв</button>
                    <button aria-pressed={mode === 'time'} onClick={() => setMode('time')}>Ирсэн цаг</button>
                  </div>
                ) : null}
                <div className="legend">
                  <span><i className="s-ok" />Цагтаа ирсэн</span>
                  <span><i className="s-late" />Хоцорсон</span>
                  <span><i className="s-leave" />Чөлөөтэй</span>
                  <span><i className="s-absent" />Тасалсан</span>
                  <span><i className="s-off" />Амралтын өдөр</span>
                  <span><i className="s-future has-shift" />Хуваарьтай</span>
                </div>
              </div>
              <div className="mx-wrap" onMouseOver={(e) => showTip(e.target as HTMLElement)} onMouseLeave={() => tip.current?.classList.remove('on')}>
                <Matrix
                  m={model}
                  rows={visible}
                  mode={mode}
                  onOpen={openEmp}
                  onPlanDay={onPlanDay}
                />
              </div>
            </section>

            {canSend ? <AttentionPanel m={model} list={attention} accessKey={accessKey} onOpen={openEmp} /> : null}

            <div className="duo">
              <section className="panel">
                <div className="panel-h">
                  <div>
                    <h2>{model.list.length > LONG_DAYS ? 'Сар бүрийн ирц' : 'Өдөр бүрийн ирц'}</h2>
                    <p>{model.list.length > LONG_DAYS ? 'Сард нийт хэдэн хүн-өдөр ямар төлөвтэй байсан' : 'Тухайн өдөр хэдэн ажилтан ямар төлөвтэй байсан'}</p>
                  </div>
                </div>
                <DailyChart m={model} emps={scoped} c={colors} />
              </section>
              <section className="panel">
                <div className="panel-h">
                  <div>
                    <h2>Хэлтсээр</h2>
                    <p>Дундаж ирцийн хувь</p>
                  </div>
                </div>
                <DeptChart m={model} emps={scoped} c={colors} />
              </section>
            </div>
          </>
        )}
      </main>

      <div className={`tr-scrim${cur ? ' on' : ''}`} onClick={closeEmp} />
      <Drawer
        m={model}
        emp={cur || null}
        focusDate={current?.date}
        c={colors}
        canSend={canSend}
        accessKey={accessKey}
        onClose={closeEmp}
        onStep={stepEmp}
        onPreview={(kind, e) => doExport(kind, e)}
      />
      {preview && model ? (
        <ExportPreview m={model} emps={scoped} kind={preview.kind} employee={preview.employee} onKind={(kind) => setPreview((p) => p && { ...p, kind })} onClose={() => setPreview(null)} />
      ) : null}
    </div>
  );
}

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const leaveLabel = (k: string) =>
  ({ business_trip: 'Томилолт', remote_work: 'Зайнаас ажилласан', telecommute: 'Цахимаар ажилласан', vacation: 'Ээлжийн амралт', sick: 'Өвчтэй', overtime: 'Илүү цаг' } as Record<string, string>)[k] || 'Чөлөө';

function monthStats(s: Summary, ym: string) {
  const r = { present: 0, work: 0, leave: 0, late: 0, absent: 0, hours: 0, rate: 0 };
  s.days.forEach((x) => {
    if (!x.date.startsWith(ym) || x.status === 'off' || x.status === 'future' || x.status === 'na') return;
    r.work++;
    if (x.status === 'ok' || x.status === 'late') r.present++;
    if (x.status === 'late') r.late++;
    if (x.status === 'absent') r.absent++;
    if (x.status === 'leave') r.leave++;
    r.hours += x.hours;
  });
  const base = r.work - r.leave;
  r.rate = base > 0 ? Math.round((r.present / base) * 100) : 0;
  return r;
}
const monthsOf = (list: string[]) => [...new Set(list.map((d) => d.slice(0, 7)))];

/* ───────── Нэгтгэл ───────── */
function Strip({ m, emps }: { m: TrModel; emps: TrEmployee[] }) {
  const S = emps.map((e) => m.sum.get(e.id)!);
  const tot = (k: 'present' | 'work' | 'leave' | 'late' | 'absent' | 'hours' | 'over' | 'lateMin') => S.reduce((a, s) => a + s[k], 0);
  const work = m.list.filter((d) => d <= m.today && ![0, 6].includes(parse(d).getDay())).length;
  const base = tot('work') - tot('leave');
  const rate = base ? Math.round((tot('present') / base) * 100) : 0;
  const avgLate = tot('late') ? Math.round(tot('lateMin') / tot('late')) : 0;
  const C = 2 * Math.PI * 34;
  const [off, setOff] = useState(C);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOff(C * (1 - rate / 100))));
    return () => cancelAnimationFrame(id);
  }, [rate, C]);
  return (
    <section className="panel strip" aria-label="Нэгтгэл">
      <div className="stat gauge">
        <svg viewBox="0 0 78 78" aria-hidden="true">
          <circle className="trk" cx="39" cy="39" r="34" />
          <circle className="val" cx="39" cy="39" r="34" strokeDasharray={C} strokeDashoffset={off} style={{ stroke: rateVar(rate) }} />
        </svg>
        <div>
          <div className="k">Нийт ирц</div>
          <div className="v">{rate}<small>%</small></div>
          <div className="n">{fmtDate(m.from)} – {fmtDate(m.to)}</div>
        </div>
      </div>
      <div className="stat"><div className="k">Ажилтан</div><div className="v">{emps.length}</div><div className="n">{work} ажлын өдөр өнгөрсөн</div></div>
      <div className="stat"><div className="k">Хоцролт</div><div className="v">{tot('late')}<small>удаа</small></div><div className="n">Дунджаар {avgLate} минут хоцорсон</div></div>
      <div className="stat"><div className="k">Тасалсан</div><div className="v">{tot('absent')}<small>өдөр</small></div><div className="n">Чөлөөтэй {tot('leave')} өдөр</div></div>
      <div className="stat"><div className="k">Ажилласан цаг</div><div className="v">{h1(tot('hours'))}</div><div className="n">Үүнээс илүү цаг {h1(tot('over'))}</div></div>
    </section>
  );
}

/* ───────── Өнөөдөр ───────── */
function Clock() {
  const [t, setT] = useState(hm(nowMinUB()));
  useEffect(() => {
    const id = setInterval(() => setT(hm(nowMinUB())), 15000);
    return () => clearInterval(id);
  }, []);
  return <span className="clock">{t}</span>;
}

function Chip({ e, extra, onOpen }: { e: TrEmployee; extra?: ReactNode; onOpen: (id: string) => void }) {
  return (
    <button className="chip" onClick={() => onOpen(e.id)}>
      <Ava e={e} />
      {e.name}
      {extra}
    </button>
  );
}

function TodayPanel({ m, emps, onOpen }: { m: TrModel; emps: TrEmployee[]; onOpen: (id: string, d?: string) => void }) {
  const cand = m.list.filter((d) => d <= m.today && ![0, 6].includes(parse(d).getDay()));
  const ref = cand[cand.length - 1];
  if (!ref) {
    return (
      <section className="panel">
        <div className="panel-h"><div><h2>Өдрийн байдал</h2></div></div>
        <div className="who-list"><span className="none">Сонгосон хугацаанд өнгөрсөн ажлын өдөр алга.</span></div>
      </section>
    );
  }
  const isToday = ref === m.today;
  const i = m.list.indexOf(ref);
  const pending = isToday && nowMinUB() < toMin(m.settings.workStart) + m.settings.grace + 1;
  const g: Record<'ok' | 'late' | 'leave' | 'absent', { e: TrEmployee; x: DayRec }[]> = { ok: [], late: [], leave: [], absent: [] };
  emps.forEach((e) => {
    const x = m.sum.get(e.id)!.days[i];
    if (x.status === 'future' && isToday) g.absent.push({ e, x });
    else if (x.status in g) g[x.status as keyof typeof g].push({ e, x });
  });
  const d = parse(ref);
  return (
    <section className="panel" aria-live="polite">
      <div className="panel-h">
        <div>
          <h2>{isToday ? 'Өнөөдөр' : 'Сүүлийн ажлын өдөр'}</h2>
          <p>{fmtDate(ref)}, {WDAY_LONG[d.getDay()]} гараг</p>
        </div>
        <div className="tools" style={{ gap: 14 }}>
          {isToday ? (<><span className="live"><i />Шууд</span><Clock /></>) : null}
        </div>
      </div>
      <div className="now">
        <div style={{ ['--c' as string]: 'var(--ok)' }}><div className="k">Ирсэн</div><div className="v">{g.ok.length + g.late.length}</div></div>
        <div style={{ ['--c' as string]: 'var(--late)' }}><div className="k">Хоцорсон</div><div className="v">{g.late.length}</div></div>
        <div style={{ ['--c' as string]: 'var(--leave)' }}><div className="k">Чөлөөтэй</div><div className="v">{g.leave.length}</div></div>
        <div style={{ ['--c' as string]: 'var(--absent)' }}><div className="k">{isToday ? 'Ирээгүй' : 'Тасалсан'}</div><div className="v">{g.absent.length}</div></div>
      </div>
      <div className="who-list">
        <div>
          <h4>{isToday ? (pending ? 'Одоогоор бүртгүүлээгүй' : 'Ирээгүй') : 'Тасалсан'}</h4>
          <div className="chips">
            {g.absent.length ? g.absent.map((o) => <Chip key={o.e.id} e={o.e} onOpen={onOpen} />) : <span className="none">Бүгд ирсэн байна.</span>}
          </div>
        </div>
        <div>
          <h4>Хоцорсон</h4>
          <div className="chips">
            {g.late.length
              ? [...g.late].sort((a, b) => (b.x.inM || 0) - (a.x.inM || 0)).map((o) => <Chip key={o.e.id} e={o.e} onOpen={(id) => onOpen(id, ref)} extra={<em> {o.x.checkIn}</em>} />)
              : <span className="none">Хоцорсон хүн алга.</span>}
          </div>
        </div>
        {g.leave.length ? (
          <div>
            <h4>Чөлөөтэй</h4>
            <div className="chips">{g.leave.map((o) => <Chip key={o.e.id} e={o.e} onOpen={onOpen} />)}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ───────── Анхаарах зүйлс ───────── */
function Icon({ k, c }: { k: keyof typeof ICONS; c: string }) {
  return (
    <span className="ic" style={{ background: `var(--${c}-soft)`, color: `var(--${c})` }}>
      <Svg d={ICONS[k]} />
    </span>
  );
}

function Insights({ m, emps, onOpen }: { m: TrModel; emps: TrEmployee[]; onOpen: (id: string) => void }) {
  const E = emps.map((e) => ({ e, s: m.sum.get(e.id)! })).filter((o) => o.s.work > 0);
  const rows: { id?: string; ic: ReactNode; t: string; d: string; v: ReactNode }[] = [];
  const late = [...E].sort((a, b) => b.s.late - a.s.late || b.s.lateMin - a.s.lateMin)[0];
  if (late && late.s.late) rows.push({ id: late.e.id, ic: <Icon k="late" c="late" />, t: 'Хамгийн олон хоцорсон', d: `${late.e.name}, нийт ${late.s.lateMin} минут`, v: <>{late.s.late}<small>удаа</small></> });
  const abs = E.filter((o) => o.s.absent).sort((a, b) => b.s.absent - a.s.absent);
  if (abs.length)
    rows.push({
      id: abs[0].e.id,
      ic: <Icon k="absent" c="absent" />,
      t: `${abs.length} ажилтан тасалсан`,
      d: abs.slice(0, 3).map((o) => `${o.e.name} (${o.s.absent})`).join(', ') + (abs.length > 3 ? ` болон ${abs.length - 3} бусад` : ''),
      v: <>{abs.reduce((a, o) => a + o.s.absent, 0)}<small>өдөр</small></>,
    });
  const over = [...E].sort((a, b) => b.s.over - a.s.over)[0];
  if (over && over.s.over > 0.5) rows.push({ id: over.e.id, ic: <Icon k="over" c="brand" />, t: 'Хамгийн их илүү цаг', d: `${over.e.name}, ${h1(over.s.hours)} цаг ажилласан`, v: <>{h1(over.s.over)}<small>цаг</small></> });
  const early = E.filter((o) => o.s.avgIn != null).sort((a, b) => a.s.avgIn! - b.s.avgIn!)[0];
  if (early) rows.push({ id: early.e.id, ic: <Icon k="sun" c="ok" />, t: 'Хамгийн эрт ирдэг', d: `${early.e.name}, дунджаар`, v: hm(early.s.avgIn!) });
  const perfect = E.filter((o) => !o.s.late && !o.s.absent);
  rows.push({
    id: perfect[0]?.e.id,
    ic: <Icon k="star" c="leave" />,
    t: 'Төгс ирцтэй',
    d: perfect.length ? 'Нэг ч удаа хоцроогүй, тасалаагүй' : 'Энэ хугацаанд төгс ирцтэй ажилтан алга',
    v: perfect.length ? (
      <>
        <span className="stack">{perfect.slice(0, 4).map((o) => <Ava key={o.e.id} e={o.e} />)}</span>
        {perfect.length > 4 ? <small>+{perfect.length - 4}</small> : null}
      </>
    ) : '0',
  });
  return (
    <div className="ins-list">
      {rows.map((r, i) => (
        <button key={i} className="ins" disabled={!r.id} onClick={() => r.id && onOpen(r.id)}>
          {r.ic}
          <span className="tx"><b>{r.t}</b><span>{r.d}</span></span>
          <span className="vl">{r.v}</span>
        </button>
      ))}
    </div>
  );
}

/* ───────── Матриц ───────── */
function Matrix({ m, rows, mode, onOpen, onPlanDay }: { m: TrModel; rows: TrEmployee[]; mode: 'status' | 'time'; onOpen: (id: string, d?: string) => void; onPlanDay?: (d: string) => void }) {
  const long = m.list.length > LONG_DAYS;
  const months = long ? monthsOf(m.list) : [];
  const cols = long ? months.length : m.list.length;
  const head = (
    <thead>
      <tr>
        <th className="who">Ажилтан</th>
        {long
          ? months.map((ym) => (
              <th key={ym} className={`day${ym === m.today.slice(0, 7) ? ' today' : ''}`}>
                <b>{Number(ym.slice(5))}-р</b>сар
              </th>
            ))
          : m.list.map((d) => {
              const g = parse(d);
              return (
                <th key={d} className={`day${[0, 6].includes(g.getDay()) ? ' we' : ''}${d === m.today ? ' today' : ''}${g.getDay() === 1 ? ' wk' : ''}`}>
                  <b>{g.getDate()}</b>
                  {WDAY[g.getDay()]}
                </th>
              );
            })}
        <th className="sum first">Ирсэн</th>
        <th className="sum">Хоцорсон</th>
        <th className="sum">Цаг</th>
        <th className="sum last">Ирц</th>
      </tr>
    </thead>
  );
  const click = (ev: ReactMouseEvent) => {
    const t = ev.target as HTMLElement;
    const p = t.closest<HTMLElement>('[data-open]');
    if (p) return onOpen(p.dataset.open!);
    const c = t.closest<HTMLElement>('[data-e]');
    if (!c) return;
    if (c.dataset.month) return onOpen(c.dataset.e!);
    if (/s-future/.test(c.className)) return onPlanDay?.(c.dataset.d!);
    if (!/s-(off|na)/.test(c.className)) onOpen(c.dataset.e!, c.dataset.d);
  };
  return (
    <table className={`mx${mode === 'time' && !long ? ' time' : ''}${long ? ' months' : ''}`} onClick={click}>
      {head}
      <tbody>
        {!rows.length ? (
          <tr>
            <td colSpan={cols + 5} className="empty">Хайлтад тохирох ажилтан алга. Шүүлтүүрээ өөрчилж үзнэ үү.</td>
          </tr>
        ) : (
          rows.map((e) => {
            const s = m.sum.get(e.id)!;
            return (
              <tr key={e.id}>
                <th className="who" scope="row">
                  <button className="person" data-open={e.id}>
                    <Ava e={e} />
                    <span>
                      <span className="nm">{e.name}</span>
                      <span className="ps">{e.position || e.department}</span>
                    </span>
                  </button>
                </th>
                {long
                  ? months.map((ym) => {
                      const mm = monthStats(s, ym);
                      return (
                        <td key={ym} className="c">
                          {mm.work ? (
                            <button className="mcell" data-e={e.id} data-d={ym} data-month="1" style={{ background: rateVar(mm.rate) }} aria-label={`${ym} ирц ${mm.rate}%`}>
                              {mm.rate}%
                            </button>
                          ) : (
                            <span className="mcell none">—</span>
                          )}
                        </td>
                      );
                    })
                  : s.days.map((x) => (
                      <td key={x.date} className={`c${parse(x.date).getDay() === 1 ? ' wk' : ''}`}>
                        <span
                          className={`cell s-${x.status}${x.status === 'future' && x.shift ? ' has-shift' : ''}${x.pending ? ' s-pending' : ''}`}
                          data-e={e.id}
                          data-d={x.date}
                          role={x.status === 'off' || x.status === 'na' ? undefined : 'button'}
                          aria-label={`${x.date} ${STATUS_LABEL[x.status]}`}
                        >
                          {mode === 'time' && x.checkIn ? x.checkIn : ''}
                        </span>
                      </td>
                    ))}
                <td className="sum first"><b>{s.present}</b>/{s.work}</td>
                <td className="sum">{s.late ? <b>{s.late}</b> : '—'}</td>
                <td className="sum"><b>{h1(s.hours)}</b></td>
                <td className="sum last">
                  <div className="rate">
                    <span className="bar"><i style={{ width: `${s.rate}%`, background: rateVar(s.rate) }} /></span>
                    <b>{s.rate}%</b>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

/* ───────── Сануулга ───────── */
function AttentionPanel({ m, list, accessKey, onOpen }: { m: TrModel; list: Attention[]; accessKey: string | null; onOpen: (id: string) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; items?: string[] } | null>(null);
  useEffect(() => {
    setSel(new Set(list.map((a) => a.emp.id)));
    setResult(null);
    setConfirm(false);
  }, [list]);

  const chosen = list.filter((a) => sel.has(a.emp.id));
  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await sendWarnings(
        chosen.map((a) => ({
          employee_id: a.emp.id,
          period_from: m.from,
          period_to: m.to > m.today ? m.today : m.to,
          title: 'Ирцийн сануулга',
          message: warningMessage(a, m.from, m.to > m.today ? m.today : m.to, note),
          stats: { rate: a.s.rate, late: a.s.late, lateMin: a.s.lateMin, absent: a.s.absent, hours: Math.round(a.s.hours * 10) / 10, work: a.s.work, present: a.s.present },
        })),
        accessKey
      );
      const lbl = (v?: string) => (v === 'sent' ? 'илгээгдсэн' : v === 'no_device' ? 'апп-д нэвтрээгүй' : v === 'no_email' ? 'имэйлгүй' : v || '—');
      setResult({ ok: true, text: `${res.length} ажилтанд сануулга илгээлээ.`, items: res.map((r) => `${r.name}: апп — ${lbl(r.push)}, имэйл — ${lbl(r.email)}`) });
      setConfirm(false);
    } catch (e: any) {
      setResult({ ok: false, text: e?.message || 'Илгээж чадсангүй.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel mb no-print">
      <div className="panel-h">
        <div>
          <h2>Анхаарах ажилтнууд</h2>
          <p>Тасалсан, олон удаа хоцорсон эсвэл ирц 90%-иас доош ажилтнууд. Сонгоод апп болон имэйлээр сануулга илгээнэ.</p>
        </div>
      </div>
      {!list.length ? (
        <div className="who-list"><span className="none">Энэ хугацаанд анхаарах ажилтан алга.</span></div>
      ) : (
        <div className="att-grid">
          <div className="att-list">
            {list.map((a) => (
              <div key={a.emp.id} className="att-row">
                <input
                  type="checkbox"
                  aria-label={`${a.emp.name} сонгох`}
                  checked={sel.has(a.emp.id)}
                  onChange={(ev) =>
                    setSel((s) => {
                      const n = new Set(s);
                      if (ev.target.checked) n.add(a.emp.id);
                      else n.delete(a.emp.id);
                      return n;
                    })
                  }
                />
                <Ava e={a.emp} />
                <div className="tx" onClick={() => onOpen(a.emp.id)}>
                  <b>{a.emp.name}</b>
                  <span>{a.reasons.join(' · ')}</span>
                </div>
                <span className="rt" style={{ color: rateVar(a.s.rate) }}>{a.s.rate}%</span>
              </div>
            ))}
          </div>
          <div className="att-send">
            <label htmlFor="tr-note">Нэмэлт үг (заавал биш)</label>
            <textarea id="tr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Жишээ нь: Ажлын цаг 09:00-д эхэлдгийг сануулъя. Тайлбар байвал хүний нөөцөд хандана уу." />
            <div className="hint">
              Ажилтан бүрт өөрийн шалтгаантай сануулга очно: апп-д мэдэгдэл (дарахад ирцийн түүх нээгдэнэ), имэйлд ирцээ харах холбоос.
            </div>
            {confirm ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn warn" onClick={send} disabled={busy}>
                  <Svg d={ICONS.bell} />
                  {busy ? 'Илгээж байна…' : `Тийм, ${chosen.length} хүнд илгээх`}
                </button>
                <button className="btn" onClick={() => setConfirm(false)} disabled={busy}>Болих</button>
              </div>
            ) : (
              <button className="btn solid" style={{ alignSelf: 'flex-start' }} disabled={!chosen.length} onClick={() => setConfirm(true)}>
                <Svg d={ICONS.bell} />
                Сануулга илгээх ({chosen.length})
              </button>
            )}
            {result ? (
              <div className={`res${result.ok ? '' : ' err'}`} role="status">
                {result.text}
                {result.items?.length ? <ul>{result.items.map((t) => <li key={t}>{t}</li>)}</ul> : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────── Графикууд ───────── */
function DailyChart({ m, emps, c }: { m: TrModel; emps: TrEmployee[]; c: Colors }) {
  const config = useMemo<ChartConfiguration | null>(() => {
    if (!c.ink) return null;
    const S = emps.map((e) => m.sum.get(e.id)!);
    const long = m.list.length > LONG_DAYS;
    const work = m.list.map((d, i) => [d, i] as const).filter(([d]) => d <= m.today && ![0, 6].includes(parse(d).getDay()));
    let labels: (string | number)[];
    let count: (st: Status) => number[];
    let titles: string[];
    if (long) {
      const months = monthsOf(work.map(([d]) => d));
      labels = months.map((ym) => MONTH[Number(ym.slice(5)) - 1]);
      titles = labels as string[];
      count = (st) => months.map((ym) => work.filter(([d]) => d.startsWith(ym)).reduce((a, [, i]) => a + S.filter((s) => s.days[i].status === st).length, 0));
    } else {
      labels = work.map(([d]) => parse(d).getDate());
      titles = work.map(([d]) => fmtDate(d));
      count = (st) => work.map(([, i]) => S.filter((s) => s.days[i].status === st).length);
    }
    const ds = ([['ok', 'Цагтаа ирсэн'], ['late', 'Хоцорсон'], ['leave', 'Чөлөөтэй'], ['absent', 'Тасалсан']] as const).map(([k, l]) => ({
      label: l,
      data: count(k),
      backgroundColor: c[k],
      borderRadius: 3,
      borderSkipped: false,
      maxBarThickness: 26,
    }));
    const o = baseOpts(c);
    return {
      type: 'bar',
      data: { labels, datasets: ds },
      options: {
        ...o,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: c['ink-3'] }, border: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: c['ink-3'] }, grid: { color: c.rule }, border: { display: false } },
        },
        plugins: { ...o.plugins, tooltip: { ...o.plugins.tooltip, callbacks: { title: (i: any) => titles[i[0].dataIndex] } } },
      },
    } as ChartConfiguration;
  }, [m, emps, c]);
  return <ChartBox config={config} label="Өдөр бүрийн ирцийн график" />;
}

function DeptChart({ m, emps, c }: { m: TrModel; emps: TrEmployee[]; c: Colors }) {
  const config = useMemo<ChartConfiguration | null>(() => {
    if (!c.ink) return null;
    const g: Record<string, number[]> = {};
    emps.forEach((e) => {
      const s = m.sum.get(e.id)!;
      if (s.work > 0) (g[e.department] ||= []).push(s.rate);
    });
    const rows = Object.entries(g)
      .map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)] as const)
      .sort((a, b) => b[1] - a[1]);
    const o = baseOpts(c);
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r[0]),
        datasets: [{ data: rows.map((r) => r[1]), backgroundColor: rows.map((r) => (r[1] >= 90 ? c.ok : r[1] >= 75 ? c.late : c.absent)), borderRadius: 6, maxBarThickness: 22 }],
      },
      options: {
        ...o,
        indexAxis: 'y',
        scales: {
          x: { min: 0, max: 100, ticks: { callback: (v: any) => v + '%', color: c['ink-3'] }, grid: { color: c.rule }, border: { display: false } },
          y: { grid: { display: false }, ticks: { color: c['ink-2'] }, border: { display: false } },
        },
        plugins: { ...o.plugins, tooltip: { ...o.plugins.tooltip, callbacks: { label: (x: any) => ` ${x.raw}% ирц` } } },
      },
    } as ChartConfiguration;
  }, [m, emps, c]);
  return <ChartBox config={config} label="Хэлтсийн ирцийн график" />;
}

/* ───────── Ажилтны дэлгэрэнгүй ───────── */
function Drawer({
  m,
  emp,
  focusDate,
  c,
  canSend,
  accessKey,
  onClose,
  onStep,
  onPreview,
}: {
  onPreview: (kind: 'pdf' | 'xlsx', e: TrEmployee) => void;
  m: TrModel | null;
  emp: TrEmployee | null;
  focusDate?: string;
  c: Colors;
  canSend: boolean;
  accessKey: string | null;
  onClose: () => void;
  onStep: (d: number) => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');

  useEffect(() => {
    setWarnOpen(false);
    setSent('');
    setNote('');
    if (!emp) return;
    body.current?.scrollTo({ top: 0 });
    setTimeout(() => closeBtn.current?.focus(), 60);
  }, [emp]);

  useEffect(() => {
    if (!emp || !focusDate) return;
    const t = setTimeout(() => {
      const row = body.current?.querySelector<HTMLElement>(`#tr-day-${focusDate}`);
      if (!row) return;
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row.classList.remove('flash');
      void row.offsetWidth;
      row.classList.add('flash');
    }, 340);
    return () => clearTimeout(t);
  }, [emp, focusDate]);

  const s = emp && m ? m.sum.get(emp.id)! : null;
  const long = !!m && m.list.length > LONG_DAYS;

  const arrConfig = useMemo<ChartConfiguration | null>(() => {
    if (!s || !m || !c.ink) return null;
    const wl = s.days.filter((x) => x.inM != null);
    const lim = toMin(m.settings.workStart) + m.settings.grace + 1;
    const ins = wl.map((x) => x.inM!);
    const lo = Math.floor((Math.min(lim - 40, ...ins) - 5) / 30) * 30;
    const hi = Math.ceil((Math.max(lim + 30, ...ins) + 5) / 30) * 30;
    const o = baseOpts(c);
    return {
      type: 'line',
      data: {
        labels: wl.map((x) => (long ? fmtDate(x.date) : parse(x.date).getDate())),
        datasets: [
          { data: ins, borderColor: c['ink-3'], borderWidth: 1.5, tension: 0.3, pointBackgroundColor: wl.map((x) => c[x.status] || c.ok), pointBorderWidth: 0, pointRadius: long ? 3 : 5, pointHoverRadius: 7 },
          { data: wl.map(() => lim), borderColor: c.late, borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0 },
        ],
      },
      options: {
        ...o,
        scales: {
          y: { reverse: true, min: lo, max: hi, ticks: { callback: (v: any) => hm(v), color: c['ink-3'], stepSize: 30 }, grid: { color: c.rule }, border: { display: false } },
          x: { grid: { display: false }, ticks: { color: c['ink-3'], maxTicksLimit: 16 }, border: { display: false } },
        },
        plugins: {
          ...o.plugins,
          tooltip: { ...o.plugins.tooltip, filter: (i: any) => i.datasetIndex === 0, callbacks: { title: (i: any) => fmtDate(wl[i[0].dataIndex].date), label: (x: any) => ' Ирсэн ' + hm(x.raw) } },
        },
      },
    } as ChartConfiguration;
  }, [s, m, c, long]);

  const hoursConfig = useMemo<ChartConfiguration | null>(() => {
    if (!s || !m || !c.ink) return null;
    const o = baseOpts(c);
    if (long) {
      const months = monthsOf(m.list.filter((d) => d <= m.today));
      const data = months.map((ym) => +s.days.filter((x) => x.date.startsWith(ym)).reduce((a, x) => a + x.hours, 0).toFixed(1));
      const norm = months.map((ym) => s.days.filter((x) => x.date.startsWith(ym) && !['off', 'future', 'leave', 'na'].includes(x.status)).length * WORK_HOURS);
      return {
        type: 'bar',
        data: {
          labels: months.map((ym) => MONTH[Number(ym.slice(5)) - 1]),
          datasets: [
            { data, backgroundColor: c.brand, borderRadius: 4, maxBarThickness: 26 },
            { type: 'line', data: norm, borderColor: c['ink-3'], borderDash: [4, 4], borderWidth: 1.2, pointRadius: 0 },
          ],
        },
        options: {
          ...o,
          scales: {
            y: { beginAtZero: true, ticks: { color: c['ink-3'] }, grid: { color: c.rule }, border: { display: false } },
            x: { grid: { display: false }, ticks: { color: c['ink-3'] }, border: { display: false } },
          },
          plugins: { ...o.plugins, tooltip: { ...o.plugins.tooltip, filter: (i: any) => i.datasetIndex === 0, callbacks: { label: (x: any) => ` ${x.raw} цаг (норм ${norm[x.dataIndex]})` } } },
        },
      } as ChartConfiguration;
    }
    const hl = s.days.filter((x) => !['off', 'future', 'na'].includes(x.status));
    return {
      type: 'bar',
      data: {
        labels: hl.map((x) => parse(x.date).getDate()),
        datasets: [
          { data: hl.map((x) => +x.hours.toFixed(1)), backgroundColor: hl.map((x) => c[x.status]), borderRadius: 4, maxBarThickness: 18 },
          { type: 'line', data: hl.map(() => WORK_HOURS), borderColor: c['ink-3'], borderDash: [4, 4], borderWidth: 1.2, pointRadius: 0 },
        ],
      },
      options: {
        ...o,
        scales: {
          y: { beginAtZero: true, ticks: { color: c['ink-3'] }, grid: { color: c.rule }, border: { display: false } },
          x: { grid: { display: false }, ticks: { color: c['ink-3'] }, border: { display: false } },
        },
        plugins: {
          ...o.plugins,
          tooltip: { ...o.plugins.tooltip, filter: (i: any) => i.datasetIndex === 0, callbacks: { title: (i: any) => fmtDate(hl[i[0].dataIndex].date), label: (x: any) => ` ${x.raw} цаг, ${STATUS_LABEL[hl[x.dataIndex].status].toLowerCase()}` } },
        },
      },
    } as ChartConfiguration;
  }, [s, m, c, long]);

  const sendOne = async () => {
    if (!emp || !s || !m) return;
    setSending(true);
    setSent('');
    try {
      const to = m.to > m.today ? m.today : m.to;
      const a = attentionList(m).find((x) => x.emp.id === emp.id) || { emp, s, reasons: [`ирц ${s.rate}%`], score: 0 };
      const res = await sendWarnings(
        [{
          employee_id: emp.id,
          period_from: m.from,
          period_to: to,
          title: 'Ирцийн сануулга',
          message: warningMessage(a, m.from, to, note),
          stats: { rate: s.rate, late: s.late, lateMin: s.lateMin, absent: s.absent, hours: Math.round(s.hours * 10) / 10, work: s.work, present: s.present },
        }],
        accessKey
      );
      const r = res[0];
      setSent(`Илгээлээ — апп: ${r?.push === 'sent' ? 'хүрсэн' : r?.push === 'no_device' ? 'апп-д нэвтрээгүй' : r?.push || '—'}, имэйл: ${r?.email === 'sent' ? 'илгээсэн' : r?.email || '—'}`);
      setWarnOpen(false);
    } catch (e: any) {
      setSent(e?.message || 'Илгээж чадсангүй.');
    } finally {
      setSending(false);
    }
  };

  const exportOne = (kind: 'pdf' | 'xlsx') => {
    if (emp) onPreview(kind, emp);
  };

  if (!m) return null;
  const all = [...m.sum.values()].filter((x) => x.work > 0);
  const avg = (f: (x: Summary) => number) => (all.length ? all.reduce((a, x) => a + f(x), 0) / all.length : 0);
  const cRate = Math.round(avg((x) => x.rate));
  const cHours = avg((x) => x.hours);
  const cLate = avg((x) => x.late);
  const cmp = (mine: number, comp: number, better: boolean, txt: string) => (
    <div className={`n ${Math.abs(mine - comp) < 0.05 ? '' : better ? 'up' : 'down'}`}>{txt}</div>
  );
  const parts = s ? ([['ok', s.ok], ['late', s.late], ['leave', s.leave], ['absent', s.absent]] as const) : [];
  const inTimes = s ? s.ins : [];
  const dayRows = s ? s.days.filter((x) => x.status !== 'future' && x.status !== 'na' && (!long || x.status !== 'off' || x.checkIn)) : [];

  return (
    <aside className={`drawer${emp ? ' on' : ''}`} role="dialog" aria-modal="true" aria-labelledby="tr-dname" aria-hidden={!emp}>
      {emp && s ? (
        <>
          <div className="dh">
            <Ava e={emp} />
            <div>
              <h3 id="tr-dname">{emp.name}</h3>
              <p>{[emp.position, emp.department].filter(Boolean).join(', ')}</p>
            </div>
            <div className="nav">
              <button className="btn no-print" onClick={() => exportOne('pdf')}><Svg d={ICONS.down} />PDF</button>
              <button className="btn no-print" onClick={() => exportOne('xlsx')}><Svg d={ICONS.down} />Excel</button>
              <button className="icon" onClick={() => onStep(-1)} aria-label="Өмнөх ажилтан"><Svg d={ICONS.prev} /></button>
              <button className="icon" onClick={() => onStep(1)} aria-label="Дараагийн ажилтан"><Svg d={ICONS.next} /></button>
              <button className="icon" ref={closeBtn} onClick={onClose} aria-label="Хаах"><Svg d={ICONS.close} /></button>
            </div>
          </div>
          <div className="db" ref={body}>
            <section className="panel">
              <div className="panel-h"><div><h2>Өдөр бүрийн ирц</h2></div></div>
              <table className="days">
                <thead>
                  <tr><th>Огноо</th><th>Ирсэн</th><th>Явсан</th><th>Ажилласан</th><th>Төлөв</th></tr>
                </thead>
                <tbody>
                  {dayRows.map((x) => {
                    const g = parse(x.date);
                    const out = x.checkOut || (x.open ? (x.date === m.today ? 'ажил дээрээ' : 'бүртгээгүй') : '—');
                    return (
                      <tr key={x.date} id={`tr-day-${x.date}`} className={x.status === 'off' ? 'we' : ''}>
                        <td>
                          {long || g.getDate() === 1 ? <span className="mo">{MONTH[g.getMonth()]}</span> : null}
                          <span className="d1">{g.getDate()}</span>
                          <span className="d2">{WDAY[g.getDay()]}</span>
                        </td>
                        <td>{x.checkIn || '—'}{x.remote ? ' · зайнаас' : ''}</td>
                        <td>{out}</td>
                        <td>{x.hours ? `${h1(x.hours)} ц` : '—'}</td>
                        <td>
                          <span className={`tag t-${x.status}`}>
                            {x.status === 'leave' && x.leaveKind ? leaveLabel(x.leaveKind) : STATUS_LABEL[x.status]}
                            {x.status === 'late' ? ` ${x.lateMin} мин` : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
            <div className="side">
              <section className="panel">
                <div className="panel-h" style={{ paddingBottom: 14 }}>
                  <div><h2>Нэгтгэл</h2><p>{fmtDate(m.from)} – {fmtDate(m.to)}, {s.work} ажлын өдөр</p></div>
                </div>
                <div className="facts">
                  <div className="fact"><div className="k">Ирцийн хувь</div><div className="v">{s.rate}<small>%</small></div>{cmp(s.rate, cRate, s.rate >= cRate, `Компанийн дундаж ${cRate}%`)}</div>
                  <div className="fact"><div className="k">Ирсэн өдөр</div><div className="v">{s.present}<small>/ {s.work}</small></div><div className="n">Чөлөөтэй {s.leave}, тасалсан {s.absent}</div></div>
                  <div className="fact"><div className="k">Ажилласан</div><div className="v">{h1(s.hours)}<small>цаг</small></div>{cmp(s.hours, cHours, s.hours >= cHours, `Дундаж ${h1(cHours)} цаг`)}</div>
                  <div className="fact"><div className="k">Илүү цаг</div><div className="v">{h1(s.over)}<small>цаг</small></div><div className="n">Өдрийн норм {WORK_HOURS} цаг</div></div>
                  <div className="fact"><div className="k">Хоцорсон</div><div className="v">{s.late}<small>удаа</small></div>{cmp(s.late, cLate, s.late <= cLate, s.late ? `Дунджаар ${Math.round(s.lateMin / s.late)} мин, компани ${h1(cLate)} удаа` : `Компанийн дундаж ${h1(cLate)} удаа`)}</div>
                  <div className="fact"><div className="k">Дундаж ирэх цаг</div><div className="v">{s.avgIn != null ? hm(s.avgIn) : '—'}</div><div className="n">{inTimes.length ? `Хамгийн эрт ${hm(Math.min(...inTimes))}, орой ${hm(Math.max(...inTimes))}` : 'Бүртгэл алга'}</div></div>
                </div>
                <div className="mix">
                  {parts.filter((p) => p[1]).map(([k, v]) => <i key={k} style={{ flex: v, background: `var(--${k})` }} title={`${STATUS_LABEL[k]}: ${v}`} />)}
                </div>
                <div className="mix-l">
                  {parts.map(([k, v]) => <span key={k}><i style={{ background: `var(--${k})` }} />{STATUS_LABEL[k]}<b>{v}</b></span>)}
                </div>
              </section>
              {canSend ? (
                <section className="panel no-print">
                  <div className="panel-h" style={{ paddingBottom: 16 }}>
                    <div><h2>Сануулга</h2><p>Апп-д мэдэгдэл ба имэйлээр ирцийн сануулга илгээнэ.</p></div>
                    <div className="tools">
                      {!warnOpen ? <button className="btn" onClick={() => setWarnOpen(true)}><Svg d={ICONS.bell} />Сануулга бичих</button> : null}
                    </div>
                  </div>
                  {warnOpen ? (
                    <div className="att-send" style={{ borderLeft: 0, borderTop: '1px solid var(--rule)' }}>
                      <label htmlFor="tr-note1">Нэмэлт үг (заавал биш)</label>
                      <textarea id="tr-note1" value={note} onChange={(e) => setNote(e.target.value)} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn warn" disabled={sending} onClick={sendOne}><Svg d={ICONS.bell} />{sending ? 'Илгээж байна…' : 'Илгээх'}</button>
                        <button className="btn" onClick={() => setWarnOpen(false)}>Болих</button>
                      </div>
                    </div>
                  ) : null}
                  {sent ? <div className="att-send" style={{ borderLeft: 0, paddingTop: 0 }}><div className="res">{sent}</div></div> : null}
                </section>
              ) : null}
              <section className="panel">
                <div className="panel-h"><div><h2>Ирсэн цаг</h2><p>Тасархай шугам бол хоцролтын хязгаар</p></div></div>
                <ChartBox config={arrConfig} height={210} label="Ирсэн цагийн график" />
              </section>
              <section className="panel">
                <div className="panel-h"><div><h2>Ажилласан цаг</h2><p>Тасархай шугам бол {long ? 'сарын' : 'өдрийн'} норм</p></div></div>
                <ChartBox config={hoursConfig} height={200} label="Ажилласан цагийн график" />
              </section>
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
