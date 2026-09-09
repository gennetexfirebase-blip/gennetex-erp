import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, HardDrive, Users2, Pin } from 'lucide-react';
import { NAV, type NavItem } from '../lib/nav';
import { CountDot, Meter } from './ui';

/** timely_clone_prompt.md §2.1 — зүүн sidebar (брэнд толгой + навигаци + flyout). */
export default function Sidebar({
  collapsed,
  counts,
  employeeCount,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  counts: { requests: number; employees: number };
  employeeCount: { used: number; total: number };
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [flyout, setFlyout] = useState<string | null>(null);
  const location = useLocation();

  const isActive = (item: NavItem) =>
    item.to
      ? location.pathname.startsWith(item.to)
      : (item.children || []).some((c) => location.pathname.startsWith(c.to));

  const width = collapsed ? 'w-[72px]' : 'w-[248px]';

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
        className={`${width} fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-sidebar backdrop-blur-xl transition-all duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseLeave={() => setFlyout(null)}
      >
        {/* ── Брэнд толгой ─────────────────────────────── */}
        <div className="p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4d8dfd] to-[#4fe0b8] text-[13px] font-black text-[#05121f]">
              G
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold tracking-tight text-ink">GENNETEX</p>
                <p className="truncate text-[11px] text-subtle">Ops Console</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Навигаци ─────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {NAV.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            const badge = item.badgeKey ? counts[item.badgeKey] : 0;

            const rowClass = `group relative mb-1 flex items-center gap-2.5 rounded-full border border-transparent px-3.5 py-2.5 text-[13px] transition ${
              active ? 'nav-active font-medium' : 'text-muted hover:bg-hover hover:text-ink'
            }`;

            if (item.children) {
              return (
                <div key={item.label} className="relative">
                  <button
                    className={`${rowClass} w-full text-left`}
                    onClick={() => setFlyout(flyout === item.label ? null : item.label)}
                    onMouseEnter={() => setFlyout(item.label)}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && <span className="ml-auto text-subtle">›</span>}
                  </button>

                  {flyout === item.label && (
                    <div className="absolute left-full top-0 z-50 ml-1 w-56 rounded-[var(--radius)] border border-line bg-card p-1.5 shadow-panel">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={() => {
                            setFlyout(null);
                            onCloseMobile();
                          }}
                          className={({ isActive: a }) =>
                            `block rounded-[var(--radius-sm)] px-3 py-2 text-[13px] transition ${
                              a ? 'nav-active font-medium' : 'text-muted hover:bg-hover hover:text-ink'
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
                  <span className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white bg-warning">
                    New
                  </span>
                )}
                {!collapsed && !item.isNew && badge ? (
                  <CountDot n={badge} tone={item.badgeTone} />
                ) : null}
                {!collapsed && active && !item.isNew && !badge ? (
                  <Pin size={13} className="ml-auto text-brand opacity-0 group-hover:opacity-100" />
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Доод виджет — багтаамж ба огноо ─────────── */}
        {!collapsed && (
          <div className="m-3 mt-0">
            <div className="surface p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                <HardDrive size={12} /> Ажилтан
              </div>
              <Meter
                pct={(employeeCount.used / Math.max(1, employeeCount.total)) * 100}
                color="linear-gradient(90deg,#4d8dfd,#4fe0b8)"
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
      </aside>
    </>
  );
}
