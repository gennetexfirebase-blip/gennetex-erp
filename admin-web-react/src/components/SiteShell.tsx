import type { ReactNode } from 'react';
import { ToneIcon, toneOf } from './ui';
import { ThemeToggle } from './ThemeToggle';
import brandMark from '../assets/report-logo.png';

/**
 * Layout-гүй тусдаа сайтуудын (link, share, data) бүрхүүл —
 * Хянах самбартай ижил: хөвөгч бөөрөнхий толгой, hero гарчиг, карт.
 */
export default function SiteShell({
  title,
  subtitle,
  icon,
  actions,
  nav,
  width = 'max-w-6xl',
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  nav?: ReactNode;
  width?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-app">
      <div className={`mx-auto ${width} px-3 pb-10 sm:px-5`}>
        <header className="sticky top-0 z-20 -mx-3 flex flex-wrap items-center gap-3 border-b border-line bg-[var(--bg-topbar)] px-3 py-2.5 backdrop-blur sm:-mx-5 sm:px-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[var(--radius)] border border-line bg-white p-0.5">
            <img src={brandMark} alt="" width="40" height="40" className="h-full w-full object-contain" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold tracking-[0.04em] text-ink">GENNETEX</p>
            <p className="truncate text-[11px] text-subtle">{window.location.hostname}</p>
          </div>
          {nav ? <div className="order-last w-full sm:order-none sm:w-auto">{nav}</div> : null}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {actions}
          </div>
        </header>

        <section className="mt-6 flex items-start gap-3 border-b border-line pb-5">
          {icon ? (
            <ToneIcon tone={toneOf(title)} size={36} className="hidden sm:grid">
              {icon}
            </ToneIcon>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink">{title}</h1>
            {subtitle ? <p className="mt-1 text-[13px] text-muted">{subtitle}</p> : null}
          </div>
        </section>

        <main className="mt-5">{children}</main>
        <footer className="mt-10 text-center text-[11px] text-subtle">© {new Date().getFullYear()} GENNETEX ХХК</footer>
      </div>
    </div>
  );
}
