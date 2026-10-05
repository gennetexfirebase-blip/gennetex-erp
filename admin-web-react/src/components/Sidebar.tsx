import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, HardDrive, Users2, ChevronRight, X } from 'lucide-react';
import { NAV, type NavItem } from '../lib/nav';
import { CountDot, Meter } from './ui';
import brandMark from '../assets/report-logo.png';

/** timely_clone_prompt.md §2.1 — зүүн sidebar (брэнд толгой + навигаци + flyout). */
export default function Sidebar({
  collapsed,
  counts,
  employeeCount,
  mobileOpen,
  onCloseMobile,
  actOnly = false,
  canTemplates = false,
}: {
  collapsed: boolean;
  counts: { requests: number; employees: number };
  employeeCount: { used: number; total: number };
  mobileOpen: boolean;
  onCloseMobile: () => void;
  actOnly?: boolean;
  canTemplates?: boolean;
}) {
  const [flyout, setFlyout] = useState<string | null>(null);
  const location = useLocation();

  const isActive = (item: NavItem) =>
    item.to
      ? location.pathname.startsWith(item.to)
      : (item.children || []).some((c) => location.pathname.startsWith(c.to));

  const width = collapsed ? 'w-[84px]' : 'w-[264px]';

  return (
    <>
      {/* Mobile drawer-ийн бүрхүүл */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      ) : null}

      <aside
        className={`app-sidebar ${width} fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col bg-sidebar transition-all duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseLeave={() => setFlyout(null)}
      >
        {/* ── Брэнд толгой ─────────────────────────────── */}
        <div className="flex h-14 items-center border-b border-white/[0.07] px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#f6f3ec] p-0.5">
              <img src={brandMark} alt="" aria-hidden="true" width="36" height="36" className="h-full w-full object-contain" />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold tracking-[0.025em] text-white">GENNETEX</p>
                <p className="truncate text-[11px] text-slate-400">{actOnly ? 'Актын удирдлага' : 'ERP удирдлага'}</p>
              </div>
            )}
          </div>
          {mobileOpen && !collapsed ? <button type="button" onClick={onCloseMobile} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Цэс хаах"><X size={18} /></button> : null}
        </div>

        {/* ── Навигаци ─────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.filter((item) => !actOnly || item.actsOnly).map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            const badge = item.badgeKey ? counts[item.badgeKey] : 0;

            const rowClass = `group relative mb-px flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-[7px] text-[13px] transition-colors ${
              active ? 'nav-active font-medium' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
            }`;

            if (item.children) {
              const children = item.children.filter((child) => !child.adminOnly || canTemplates);
              if (actOnly) {
                return (
                  <div key={item.label} className="mb-5">
                    {!collapsed ? <p className="mb-2 px-3 text-[12px] font-medium text-[#8a958e]">{item.label}</p> : null}
                    <div className="space-y-1">
                      {children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={onCloseMobile}
                          title={collapsed ? child.label : undefined}
                          className={({ isActive: childActive }) => `group relative flex items-center gap-2.5 rounded-md border px-2.5 py-[7px] text-[13px] transition-colors ${childActive ? 'nav-active border-transparent font-medium' : 'border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white'}`}
                        >
                          <Icon size={17} className="shrink-0" />
                          {!collapsed ? <span className="min-w-0 flex-1 truncate">{child.label}</span> : null}
                          {!collapsed ? <ChevronRight size={14} className="shrink-0 opacity-50" /> : null}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.label} className="relative">
                  <button
                    className={`${rowClass} w-full text-left`}
                    onClick={() => setFlyout(flyout === item.label ? null : item.label)}
                    onMouseEnter={() => setFlyout(item.label)}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && <ChevronRight size={14} className="ml-auto text-slate-500" />}
                  </button>

                  {flyout === item.label && (
                    <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-[var(--radius)] border border-line bg-card p-1.5 text-ink shadow-panel">
                      {children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={() => {
                            setFlyout(null);
                            onCloseMobile();
                          }}
                          className={({ isActive: a }) =>
                            `block rounded-[var(--radius-sm)] px-3 py-2 text-[13px] transition ${
                              a ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-hover hover:text-ink'
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to!}
                onClick={onCloseMobile}
                onMouseEnter={() => setFlyout(null)}
                className={rowClass}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.isNew && (
                  <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-[#d9b46a]">
                    шинэ
                  </span>
                )}
                {!collapsed && !item.isNew && badge ? (
                  <CountDot n={badge} tone={item.badgeTone} />
                ) : null}
                
              </NavLink>
            );
          })}
        </nav>

        {/* ── Доод виджет — багтаамж ба огноо ─────────── */}
        {!collapsed && !actOnly && (
          <div className="border-t border-white/[0.07] px-4 py-3">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[12px] text-[#8a958e]">
                <HardDrive size={12} /> Ажилтан
              </div>
              <Meter
                pct={(employeeCount.used / Math.max(1, employeeCount.total)) * 100}
                color="#8cc5b5"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Users2 size={12} className="text-subtle" />
                  {employeeCount.used} / {employeeCount.total}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={12} className="text-subtle" />
                  {new Date().toISOString().slice(0, 10)}
                </span>
              </div>
            </div>
          </div>
        )}
        {!collapsed && actOnly ? (
          <div className="border-t border-white/[0.07] px-4 py-3">
            <p className="text-[11px] font-medium text-slate-400">GENNETEX ХХК</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Актын ажлын орчин</p>
          </div>
        ) : null}
      </aside>
    </>
  );
}
