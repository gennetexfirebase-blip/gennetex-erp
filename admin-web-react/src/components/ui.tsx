import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { iconOfPath } from '../lib/nav';

/* Нийтлэг компонентууд — «Soft Color» хэв маяг (index.css). */

export const TONES = ['green', 'blue', 'amber', 'violet', 'rose', 'teal'] as const;
export type ToneName = (typeof TONES)[number];
/** Текстээс тогтвортой пастел өнгө — нэг нэр үргэлж нэг өнгөтэй. */
export function toneOf(key: string): ToneName {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
export const toneStyle = (t: ToneName) => ({ background: `var(--tone-${t}-bg)`, color: `var(--tone-${t}-fg)` });

/** Пастел дугуй icon. */
export function ToneIcon({ tone, children, size = 32, className = '' }: { tone: ToneName; children: ReactNode; size?: number; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-[var(--radius)] ${className}`} style={{ width: size, height: size, ...toneStyle(tone) }} aria-hidden="true">
      {children}
    </span>
  );
}

export function Card({
  title,
  icon,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`surface ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-col items-stretch justify-between gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? <span className="shrink-0 text-subtle" aria-hidden="true">{icon}</span> : null}
            <h2 className="truncate text-[14px] font-semibold text-ink">{title}</h2>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">{actions}</div> : null}
        </header>
      )}
      <div className={`p-4 sm:p-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

type BtnVariant = 'primary' | 'success' | 'outline' | 'ghost' | 'danger';

export function Button({
  children,
  variant = 'primary',
  icon,
  className = '',
  ...rest
}: {
  children?: ReactNode;
  variant?: BtnVariant;
  icon?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'focus-ring inline-flex min-h-9 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] border px-3.5 py-2 text-[13px] font-medium leading-none transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50';
  const styles: Record<BtnVariant, string> = {
    primary: 'border-brand bg-brand text-white hover:border-brand-600 hover:bg-brand-600',
    success: 'border-success bg-success text-white hover:brightness-95',
    danger: 'border-danger bg-danger text-white hover:brightness-95',
    outline: 'border-line bg-card text-ink shadow-[var(--shadow)] hover:border-[var(--border-strong)] hover:bg-card2',
    ghost: 'border-transparent bg-transparent text-muted shadow-none hover:bg-hover hover:text-ink',
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}

export function Input({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`focus-ring h-10 w-full rounded-[var(--radius)] border border-line bg-card px-3 text-[13px] text-ink placeholder:text-subtle disabled:cursor-not-allowed disabled:bg-card2 disabled:text-muted ${className}`}
      {...rest}
    />
  );
}

export function Select({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`focus-ring h-10 rounded-[var(--radius)] border border-line bg-card px-3 text-[13px] text-ink disabled:cursor-not-allowed disabled:bg-card2 disabled:text-muted ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`focus-ring w-full rounded-[var(--radius)] border border-line bg-card p-3 text-[13px] leading-5 text-ink placeholder:text-subtle disabled:cursor-not-allowed disabled:bg-card2 disabled:text-muted ${className}`}
      {...rest}
    />
  );
}

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral';

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    brand: 'border-brand/20 bg-brand-soft text-brand',
    success: 'border-success/20 bg-success-soft text-success',
    warning: 'border-warning/20 bg-warning-soft text-warning',
    danger: 'border-danger/20 bg-danger-soft text-danger',
    purple: 'border-purple/20 bg-[var(--purple-soft)] text-[var(--purple)]',
    neutral: 'border-line bg-card2 text-muted',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-[18px] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Тоон дугуй badge — sidebar цэсний тоо (§2.1). */
export function CountDot({ n, tone = 'brand' }: { n: number; tone?: 'brand' | 'warning' }) {
  if (!n) return null;
  return (
    <span
      className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white ${
        tone === 'warning' ? 'bg-warning' : 'bg-brand'
      }`}
    >
      {n}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: 'var(--bg-card-2)', color: 'var(--text-subtle)' }} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
      </span>
      <p className="max-w-sm text-[13px] leading-5 text-muted">{text}</p>
    </div>
  );
}

export function Loading({ text = 'Түр хүлээнэ үү...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <Loader2 className="animate-spin text-brand" size={22} />
      <p className="text-[13px] text-muted">{text}</p>
    </div>
  );
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-sm)] border-l-2 border-danger bg-danger-soft px-4 py-5 text-center">
      <p className="text-[13px] text-ink">{text}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Дахин оролдох
        </Button>
      ) : null}
    </div>
  );
}

/** Хүснэгтийн skeleton мөрүүд (§4 Loading). */
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-line">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-3 w-full animate-pulse rounded bg-card2" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function PageHeader({
  title,
  crumb,
  description,
  actions,
}: {
  title: string;
  crumb?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumb && crumb !== title ? <p className="mb-1 text-[12px] text-subtle">{crumb}</p> : null}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function todayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}-р сарын ${d.getDate()}, ${['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'][d.getDay()]} гараг`;
}

/** Дугуй avatar — зурагтай эсвэл эхний үсгээр. */
export function Avatar({
  name,
  src,
  size = 32,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
}) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

/**
 * Үзүүлэлтийн карт — «Command Center»-ийн дээд эгнээ.
 *
 * `delta` эерэг бол ногоон, сөрөг бол улаан бөглөмөл шошго болно; тэмдгийг
 * дуудагч талаас нь оруулна (жишээ нь "+12.4%" эсвэл "-0.3%").
 */
/**
 * Тоог 0-ээс өсгөж харуулна (KPI). «12 500₮», «48 ц» зэрэг тэмдэгттэй утгыг
 * ч дэмжинэ — тоон хэсгийг нь хөдөлгөж, бусдыг нь хэвээр үлдээнэ.
 */
export function CountUp({ value, duration = 700 }: { value: ReactNode; duration?: number }) {
  const parsed = (() => {
    if (typeof value === 'number') return { n: value, prefix: '', suffix: '', grouped: false, dec: 0 };
    if (typeof value !== 'string') return null;
    const mm = value.match(/^(\D*?)(-?[\d\s\u00a0\u202f,]*\d(?:\.\d+)?)(.*)$/);
    if (!mm) return null;
    const raw = mm[2].replace(/[\s\u00a0\u202f,]/g, '');
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return { n, prefix: mm[1], suffix: mm[3], grouped: /[\s\u00a0\u202f,]/.test(mm[2]), dec: (raw.split('.')[1] || '').length };
  })();
  const [shown, setShown] = useState(parsed ? 0 : null);
  const from = useRef(0);
  const target = parsed?.n;
  useEffect(() => {
    if (target === undefined) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return setShown(target);
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      const v = a + (target - a) * e;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  if (!parsed || shown === null) return <>{value}</>;
  const num = parsed.dec ? shown.toFixed(parsed.dec) : String(Math.round(shown));
  const text = parsed.grouped || Math.abs(parsed.n) >= 10000 ? new Intl.NumberFormat('mn-MN', { maximumFractionDigits: parsed.dec }).format(Number(num)) : num;
  return <>{parsed.prefix}{text}{parsed.suffix}</>;
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone = 'up',
  note,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: 'up' | 'down';
  note?: ReactNode;
  icon?: ReactNode;
  tone?: ToneName;
}) {
  return (
    <div className="surface flex items-center gap-4 p-5">
      {icon ? <ToneIcon tone={tone || toneOf(label)} size={36}>{icon}</ToneIcon> : null}
      <div className="min-w-0 flex-1">
        <p className="kpi-value truncate text-[22px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-ink"><CountUp value={value} /></p>
        <p className="mt-1.5 truncate text-[12px] font-medium text-muted">{label}</p>
        {note ? <p className="truncate text-[11px] text-subtle">{note}</p> : null}
      </div>
      {delta ? (
        <span className={`self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${deltaTone === 'up' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
          {delta}
        </span>
      ) : null}
    </div>
  );
}

/** KPI эгнээ — Хянах самбарын загвар (1 → 2 → 4 багана). */
export function KpiRow({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  const lg = cols === 3 ? 'xl:grid-cols-3' : cols === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4';
  return <div className={`mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 ${lg}`}>{children}</div>;
}

/** Эрэмбэлсэн жагсаалт + нарийн зураас. */
export function RankList({ items, format = (n) => String(n), color = 'var(--brand)' }: {
  items: { name: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
}) {
  if (items.length === 0) return <EmptyState text="Мэдээлэл алга." />;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3.5">
      {items.map((i) => (
        <li key={i.name}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{i.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{format(i.value)}</span>
          </div>
          <Meter pct={(i.value / max) * 100} color={color} />
        </li>
      ))}
    </ul>
  );
}

/** Хувь хэмжээний нарийн зураас — эх сурвалж, багтаамж зэрэгт. */
export function Meter({ pct, color = 'var(--brand)' }: { pct: number; color?: string }) {
  return (
    <div className="meter" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

/** Төвд гарах цонх — Esc эсвэл гадна дарахад хаагдана. */
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  wide?: boolean;
}) {
  // Esc — фокус хаана ч байсан хаана.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(20,28,24,0.42)] p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`pop-in max-h-[90vh] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} overflow-y-auto rounded-[var(--radius-lg)] border border-line bg-card shadow-[var(--shadow-pop)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="focus-ring rounded-[var(--radius-sm)] p-1.5 text-muted hover:bg-hover hover:text-ink" aria-label="Хаах">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Шошготой талбар. */
export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-[13px] text-ink">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

/** Товчлуурын тэмдэг — жишээ нь <Kbd>Ctrl</Kbd><Kbd>K</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** Google-ийн албан ёсны «G» тэмдэг. */
export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
