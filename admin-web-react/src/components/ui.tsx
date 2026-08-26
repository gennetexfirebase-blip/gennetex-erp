import type { ReactNode } from 'react';
import { Info, Loader2 } from 'lucide-react';

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
      className={`rounded-[var(--radius)] border border-line bg-card shadow-panel ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? <span className="text-brand">{icon}</span> : null}
            <h2 className="truncate text-[15px] font-semibold text-ink">{title}</h2>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
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
    'focus-ring inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-2.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-brand text-white hover:bg-brand-600',
    success: 'bg-success text-white hover:brightness-110',
    danger: 'bg-danger text-white hover:brightness-110',
    outline: 'border border-line bg-transparent text-ink hover:bg-hover',
    ghost: 'bg-transparent text-muted hover:bg-hover hover:text-ink',
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function Input({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-line bg-card2 px-3 text-[13px] text-ink placeholder:text-subtle ${className}`}
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
      className={`focus-ring h-10 rounded-[var(--radius-sm)] border border-line bg-card2 px-3 text-[13px] text-ink ${className}`}
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
      className={`focus-ring w-full rounded-[var(--radius-sm)] border border-line bg-card2 p-3 text-[13px] text-ink placeholder:text-subtle ${className}`}
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
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    purple: 'bg-[rgba(124,92,252,.16)] text-[var(--purple)]',
    neutral: 'bg-card2 text-muted',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]} ${className}`}
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
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card2 text-subtle">
        <Info size={18} />
      </span>
      <p className="max-w-xs text-[13px] text-subtle">{text}</p>
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
  actions,
}: {
  title: string;
  crumb?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1 text-[12px] text-subtle">Нүүр › {crumb || title}</p>
        <h1 className="text-[26px] font-bold leading-tight text-ink">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
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
