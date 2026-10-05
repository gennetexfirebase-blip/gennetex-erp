import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/* timely_clone_prompt.md §4 — нийтлэг компонентууд. */

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
        <header className="flex flex-col items-stretch justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? <span className="text-brand" aria-hidden="true">{icon}</span> : null}
            <h2 className="truncate text-[14px] font-semibold text-ink">{title}</h2>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">{actions}</div> : null}
        </header>
      )}
      <div className={`p-4 sm:p-5 ${bodyClassName}`}>{children}</div>
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
    'focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[7px] border px-3.5 py-2 text-[13px] font-semibold leading-none transition-[background-color,border-color,transform] disabled:cursor-not-allowed disabled:opacity-50';
  const styles: Record<BtnVariant, string> = {
    primary: 'border-brand bg-brand text-white hover:border-brand-600 hover:bg-brand-600',
    success: 'border-success bg-success text-white hover:brightness-95',
    danger: 'border-danger bg-danger text-white hover:brightness-95',
    outline: 'border-[var(--border-strong)] bg-card text-ink hover:border-[var(--border-strong)] hover:bg-card2',
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
      className={`focus-ring h-10 w-full rounded-[7px] border border-[var(--border-strong)] bg-card px-3 text-[13px] text-ink placeholder:text-subtle disabled:cursor-not-allowed disabled:bg-card2 disabled:text-muted ${className}`}
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
      className={`focus-ring h-10 rounded-[7px] border border-[var(--border-strong)] bg-card px-3 text-[13px] text-ink disabled:cursor-not-allowed disabled:bg-card2 disabled:text-muted ${className}`}
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
      className={`focus-ring w-full rounded-[7px] border border-[var(--border-strong)] bg-card p-3 text-[13px] leading-5 text-ink placeholder:text-subtle disabled:cursor-not-allowed disabled:bg-card2 disabled:text-muted ${className}`}
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
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]} ${className}`}
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
    <div className="py-8 text-center">
      <p className="text-[13px] leading-5 text-subtle">{text}</p>
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
    <div className="mb-6 flex flex-col justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="mb-1 text-[13px] text-subtle">{crumb || 'Тойм'}</p>
        <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-[24px]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
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
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-card2 font-semibold text-muted"
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
export function StatCard({
  label,
  value,
  delta,
  deltaTone = 'up',
  note,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: 'up' | 'down';
  note?: string;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-muted">{label}</span>
        {delta ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              deltaTone === 'up'
                ? 'bg-success-soft text-success'
                : 'bg-danger-soft text-danger'
            }`}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">{value}</p>
      {note ? <p className="mt-2 text-[12px] text-subtle">{note}</p> : null}
    </div>
  );
}

/** Хувь хэмжээний нарийн зураас — эх сурвалж, багтаамж зэрэгт. */
export function Meter({ pct, color = 'var(--brand)' }: { pct: number; color?: string }) {
  return (
    <div className="meter">
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}
