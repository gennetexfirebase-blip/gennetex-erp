import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, ExternalLink, LayoutGrid, Search, Users2, X } from 'lucide-react';
import { FileText, ShareNetwork, SquaresFour, SquaresFour as AllSites } from '@phosphor-icons/react';
import { NAV, type NavIcon, type NavItem } from '../lib/nav';
import { SITES, currentSite, siteUrl, type SiteKey } from '../lib/sites';
import { CountDot, Kbd, Meter, toneOf, toneStyle } from './ui';
import brandMark from '../assets/report-logo.png';

/** Сайт бүрийн icon — тухайн сайтын эхний цэсний icon (байхгүй бол тусгай). */
const SITE_ICON: Partial<Record<SiteKey, NavIcon>> = { admin: SquaresFour, akt: FileText, share: ShareNetwork };
const siteIcon = (k: SiteKey): NavIcon => SITE_ICON[k] || NAV.find((n) => n.site === k)?.icon || AllSites;

/** Өөр subdomain руу шилжих жагсаалтад харагдах сайтууд. */
const SWITCH_SITES: SiteKey[] = ['admin', 'irts', 'hr', 'sanhuu', 'aguulah', 'bairshil', 'habea', 'haab', 'guitsetgel', 'surgalt', 'meet', 'notif', 'arhiv', 'akt', 'share'];

/** Зүүн sidebar — брэнд толгой, хайлт, навигаци, сайт солих. */
export default function Sidebar({
  collapsed,
  counts,
  employeeCount,
  mobileOpen,
  onCloseMobile,
  onOpenSearch,
  actOnly = false,
  canTemplates = false,
  isSuper = false,
  isAdmin = true,
}: {
  collapsed: boolean;
  counts: { requests: number; employees: number };
  employeeCount: { used: number; total: number };
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSearch: () => void;
  actOnly?: boolean;
  canTemplates?: boolean;
  isSuper?: boolean;
  isAdmin?: boolean;
}) {
  const [flyout, setFlyout] = useState<string | null>(null);
  const [sitesOpen, setSitesOpen] = useState(false);
  const location = useLocation();

  const isActive = (item: NavItem) =>
    item.to
      ? location.pathname.startsWith(item.to)
      : (item.children || []).some((c) => location.pathname.startsWith(c.to));

  const site = currentSite();
  // Одоогийн subdomain-ийн мөрүүд л — бусад сайт руу шилжсэн хэсэг энд харагдахгүй.
  const items = NAV.filter((item) =>
    actOnly ? item.actsOnly : (item.site || 'admin') === site.key && (!item.superOnly || isSuper) && (isAdmin || item.openToAll)
  );

  const width = collapsed ? 'lg:w-[76px]' : 'lg:w-[252px]';
  const Ico = ({ icon: I, label }: { icon: NavItem['icon']; label: string }) => (
    <span className="nav-ico grid h-5 w-5 shrink-0 place-items-center text-subtle">
      <I size={19} />
    </span>
  );
  const rowBase = 'group relative flex items-center gap-2.5 rounded-[var(--radius)] px-2.5 py-[7px] text-[13px] transition-colors';
  const rowIdle = 'text-muted hover:bg-hover hover:text-ink';

  return (
    <>
      {mobileOpen ? <div className="fixed inset-0 z-30 bg-[rgba(20,28,24,0.4)] lg:hidden" onClick={onCloseMobile} aria-hidden /> : null}

      <aside
        className={`app-sidebar w-[264px] ${width} fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col overflow-hidden bg-sidebar transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseLeave={() => setFlyout(null)}
        aria-label="Үндсэн цэс"
      >
        {/* ── Брэнд толгой ─────────────────────────────── */}
        <div className="flex h-16 items-center gap-3 px-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[var(--radius)] border border-line bg-white p-0.5">
            <img src={brandMark} alt="" aria-hidden="true" width="32" height="32" className="h-full w-full object-contain" />
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold tracking-[0.04em] text-ink">GENNETEX</p>
              <p className="truncate text-[11px] text-subtle">{actOnly ? 'Актын удирдлага' : site.title}</p>
            </div>
          ) : null}
          {mobileOpen ? (
            <button type="button" onClick={onCloseMobile} className="focus-ring rounded-[var(--radius-sm)] p-1.5 text-muted hover:bg-hover hover:text-ink lg:hidden" aria-label="Цэс хаах">
              <X size={18} />
            </button>
          ) : null}
        </div>

        {/* ── Хайлт (Ctrl+K) ───────────────────────────── */}
        {!actOnly ? (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={onOpenSearch}
              title={collapsed ? 'Хайх (Ctrl+K)' : undefined}
              className={`focus-ring flex h-9 w-full items-center gap-2 rounded-[var(--radius)] border border-line bg-card px-2.5 text-[13px] text-subtle hover:bg-hover hover:text-muted ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
            >
              <Search size={15} className="shrink-0" />
              {!collapsed ? (
                <>
                  <span className="flex-1 text-left">Хайх, шилжих…</span>
                  <span className="hidden items-center gap-0.5 lg:flex"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
                </>
              ) : null}
            </button>
          </div>
        ) : null}

        {/* ── Навигаци ─────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {!collapsed ? <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">{actOnly ? 'Баримт бичиг' : 'Цэс'}</p> : null}
          <div className="space-y-px">
            {items.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              const badge = item.badgeKey ? counts[item.badgeKey] : 0;
              const rowClass = `${rowBase} ${active ? 'nav-active' : rowIdle} ${collapsed ? 'lg:justify-center' : ''}`;

              if (item.children) {
                const children = item.children.filter((child) => !child.adminOnly || canTemplates);
                if (actOnly) {
                  return children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      onClick={onCloseMobile}
                      title={collapsed ? child.label : undefined}
                      className={({ isActive: a }) => `${rowBase} ${a ? 'nav-active' : rowIdle} ${collapsed ? 'lg:justify-center' : ''}`}
                    >
                      <Ico icon={Icon} label={item.label} />
                      {!collapsed ? <span className="min-w-0 flex-1 truncate">{child.label}</span> : null}
                    </NavLink>
                  ));
                }
                return (
                  <div key={item.label} className="relative">
                    <button
                      className={`${rowClass} w-full text-left`}
                      onClick={() => setFlyout(flyout === item.label ? null : item.label)}
                      onMouseEnter={() => setFlyout(item.label)}
                      aria-expanded={flyout === item.label}
                    >
                      <Ico icon={Icon} label={item.label} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      {!collapsed ? <ChevronRight size={14} className="ml-auto text-subtle" /> : null}
                    </button>
                    {flyout === item.label ? (
                      <div className="pop-in absolute left-full top-0 z-50 ml-2 w-56 rounded-[var(--radius-lg)] border border-line bg-card p-1.5 text-ink shadow-[var(--shadow-pop)]">
                        {children.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            onClick={() => {
                              setFlyout(null);
                              onCloseMobile();
                            }}
                            className={({ isActive: a }) =>
                              `block rounded-[var(--radius-sm)] px-3 py-2 text-[13px] transition ${a ? 'bg-brand-soft font-semibold text-brand' : 'text-muted hover:bg-hover hover:text-ink'}`
                            }
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to!}
                  onClick={onCloseMobile}
                  onMouseEnter={() => setFlyout(null)}
                  title={collapsed ? item.label : undefined}
                  className={rowClass}
                >
                  <Ico icon={Icon} label={item.label} />
                  {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                  {!collapsed && badge ? <CountDot n={badge} tone={item.badgeTone} /> : null}
                  {collapsed && badge ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden="true" /> : null}
                </NavLink>
              );
            })}
          </div>

          {/* ── Бусад хэсэг (subdomain) ───────────────── */}
          {!actOnly && isAdmin ? (
            <div className="mt-5">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => setSitesOpen((v) => !v)}
                  aria-expanded={sitesOpen}
                  className="focus-ring mb-1.5 flex w-full items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle hover:text-ink"
                >
                  <LayoutGrid size={12} /> Бусад хэсэг
                  <ChevronRight size={13} className={`ml-auto transition-transform ${sitesOpen ? 'rotate-90' : ''}`} />
                </button>
              ) : null}
              {sitesOpen && !collapsed ? (
                <div className="space-y-px">
                  {SWITCH_SITES.filter((k) => k !== site.key).map((k) => {
                    const SiteIcon = siteIcon(k);
                    return (
                    <a key={k} href={siteUrl(k)} className={`${rowBase} ${rowIdle}`}>
                      <span className="nav-ico grid h-5 w-5 shrink-0 place-items-center text-subtle" aria-hidden="true"><SiteIcon size={18} /></span>
                      <span className="min-w-0 flex-1 truncate">{SITES[k].title}</span>
                      <ExternalLink size={12} className="shrink-0 opacity-0 transition group-hover:opacity-60" />
                    </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>

        {/* ── Доод хэсэг ───────────────────────────────── */}
        {!collapsed && !actOnly && isAdmin ? (
          <div className="border-t border-line px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 font-medium text-muted"><Users2 size={13} /> Ажилтан</span>
              <span className="tabular-nums text-subtle">{employeeCount.used} / {employeeCount.total}</span>
            </div>
            <Meter pct={(employeeCount.used / Math.max(1, employeeCount.total)) * 100} />
          </div>
        ) : null}
        {!collapsed && actOnly ? (
          <div className="border-t border-line px-4 py-3">
            <p className="text-[11px] font-medium text-muted">GENNETEX ХХК</p>
            <p className="mt-0.5 text-[11px] text-subtle">Актын ажлын орчин</p>
          </div>
        ) : null}
      </aside>
    </>
  );
}
