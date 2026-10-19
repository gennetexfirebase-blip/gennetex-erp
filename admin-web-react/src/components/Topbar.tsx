import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Avatar, Kbd } from './ui';
import { NAV } from '../lib/nav';
import { currentSite, siteUrl } from '../lib/sites';

/** Одоогийн хаягийн цэсний нэр (хамгийн урт таарсан угтвар). */
function pageTitle(path: string) {
  let best = { len: 0, label: '' };
  for (const item of NAV) {
    const rows = item.children ? item.children.map((c) => ({ to: c.to, label: c.label })) : item.to ? [{ to: item.to, label: item.label }] : [];
    for (const r of rows) if ((path === r.to || path.startsWith(r.to + '/')) && r.to.length > best.len) best = { len: r.to.length, label: r.label };
  }
  return best.label;
}

/** Дээд мөр — хуудасны нэр, хайлт, мэдэгдэл, хэрэглэгчийн цэс. */
export default function Topbar({
  onToggleSidebar,
  onOpenMobile,
  onOpenSearch,
  collapsed,
  profile,
  unread,
  onSignOut,
  actOnly = false,
  canCreateAct = false,
  canTemplates = false,
  isAdmin = false,
}: {
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  onOpenSearch: () => void;
  collapsed: boolean;
  profile: { name?: string | null; avatar_url?: string | null; email?: string | null; role?: string | null } | null;
  unread: number;
  onSignOut: () => void;
  actOnly?: boolean;
  canCreateAct?: boolean;
  canTemplates?: boolean;
  isAdmin?: boolean;
}) {
  const [menu, setMenu] = useState<null | 'user' | 'bell'>(null);
  const box = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const site = currentSite();

  // Гадна дарах эсвэл Esc — цэс хаагдана.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);
  useEffect(() => setMenu(null), [location.pathname]);

  const actPageTitle = location.pathname.includes('/settings/act-templates')
    ? 'Актын загварууд'
    : location.pathname.endsWith('/new')
      ? 'Шинэ акт'
      : location.pathname.endsWith('/edit')
        ? 'Акт засварлах'
        : location.pathname.endsWith('/preview')
          ? 'Актын дэлгэрэнгүй'
          : 'Актын бүртгэл';
  const title = actOnly ? actPageTitle : pageTitle(location.pathname) || site.title;
  const iconBtn = 'focus-ring relative grid h-10 w-10 place-items-center rounded-full bg-card text-muted shadow-[var(--shadow)] hover:text-ink';
  // Өөр subdomain бол бүтэн хаяг, энэ сайтынх бол router-ийн Link.
  const To = ({ k, to, className, children }: { k: 'irts' | 'admin'; to: string; className: string; children: React.ReactNode }) =>
    site.key === k ? <Link to={to} className={className}>{children}</Link> : <a href={siteUrl(k, to)} className={className}>{children}</a>;

  return (
    <header className="app-topbar sticky top-0 z-20 flex h-16 items-center gap-2 px-3 sm:px-4 lg:px-8">
      <button className={`${iconBtn} lg:hidden`} onClick={onOpenMobile} aria-label="Цэс нээх">
        <Menu size={18} />
      </button>
      <button className={`${iconBtn} hidden lg:grid`} onClick={onToggleSidebar} aria-label={collapsed ? 'Хажуугийн цэс дэлгэх' : 'Хажуугийн цэс хумих'}>
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      <nav aria-label="Байршил" className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <span className="hidden truncate text-subtle sm:inline">{actOnly ? 'Баримт бичиг' : site.title}</span>
        {title !== site.title ? (
          <>
            <span className="hidden text-subtle sm:inline" aria-hidden="true">/</span>
            <span className="truncate font-semibold text-ink">{title}</span>
          </>
        ) : null}
      </nav>

      <div ref={box} className="ml-auto flex items-center gap-1 sm:gap-1.5">
        {!actOnly ? (
          <>
            <button
              onClick={onOpenSearch}
              className="focus-ring hidden h-10 w-64 items-center gap-2 rounded-full bg-card px-4 text-[13px] text-subtle shadow-[var(--shadow)] hover:text-muted md:flex"
            >
              <Search size={15} />
              <span className="flex-1 text-left">Хайх…</span>
              <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
            </button>
            <button onClick={onOpenSearch} className={`${iconBtn} md:hidden`} aria-label="Хайх">
              <Search size={18} />
            </button>
          </>
        ) : null}

        {actOnly && canCreateAct ? (
          <Link to="/admin/documents/acts/new" className="cta-gradient focus-ring hidden h-10 items-center gap-1.5 rounded-full px-4 text-[13px] sm:inline-flex">
            <Plus size={15} /> Акт үүсгэх
          </Link>
        ) : null}

        {!actOnly && isAdmin ? (
          <div className="relative">
            <button className={iconBtn} onClick={() => setMenu(menu === 'bell' ? null : 'bell')} aria-label={unread ? `Мэдэгдэл — ${unread} хүлээгдэж буй` : 'Мэдэгдэл'} aria-expanded={menu === 'bell'}>
              <Bell size={18} />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">{unread > 99 ? '99+' : unread}</span>
              ) : null}
            </button>
            {menu === 'bell' ? (
              <div className="pop-in absolute right-0 top-full z-50 mt-2 w-80 rounded-[var(--radius-lg)] border border-line bg-card shadow-[var(--shadow-pop)]">
                <p className="border-b border-line px-4 py-3 text-[13px] font-semibold text-ink">Мэдэгдэл</p>
                {unread > 0 ? (
                  <To k="irts" to="/request" className="flex items-center gap-3 px-4 py-3 text-[13px] hover:bg-hover">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">{unread}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">Шийдвэрлээгүй цагийн хүсэлт</span>
                      <span className="block text-[12px] text-subtle">Ирц бүртгэл → Цагийн хүсэлт</span>
                    </span>
                  </To>
                ) : (
                  <p className="px-4 py-6 text-center text-[13px] text-subtle">Шинэ мэдэгдэл алга.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {actOnly && canTemplates ? (
          <Link to="/admin/settings/act-templates" className={iconBtn} aria-label="Актын загварууд">
            <Settings size={18} />
          </Link>
        ) : null}

        <div className="relative">
          <button
            className="focus-ring ml-0.5 flex items-center gap-2 rounded-full bg-card p-1 pr-2 shadow-[var(--shadow)]"
            onClick={() => setMenu(menu === 'user' ? null : 'user')}
            aria-label="Хэрэглэгчийн цэс"
            aria-expanded={menu === 'user'}
          >
            <Avatar name={profile?.name || profile?.email} src={profile?.avatar_url} size={30} />
            <span className="hidden max-w-32 truncate text-[13px] font-medium text-ink xl:block">{profile?.name || profile?.email || 'Хэрэглэгч'}</span>
            <ChevronDown size={14} className="hidden text-subtle xl:block" />
          </button>
          {menu === 'user' ? (
            <div className="pop-in absolute right-0 top-full z-50 mt-2 w-64 rounded-[var(--radius-lg)] border border-line bg-card p-1.5 shadow-[var(--shadow-pop)]">
              <div className="flex items-center gap-3 px-2.5 py-2.5">
                <Avatar name={profile?.name || profile?.email} src={profile?.avatar_url} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{profile?.name || '—'}</p>
                  <p className="truncate text-[12px] text-subtle">{profile?.email || ''}</p>
                </div>
              </div>
              <div className="my-1 border-t border-line" />
              {isAdmin && !actOnly ? (
                <To k="admin" to="/more/settings" className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-muted hover:bg-hover hover:text-ink">
                  <Settings size={15} /> Тохиргооны төв
                </To>
              ) : null}
              <button onClick={onSignOut} className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] text-danger hover:bg-danger-soft">
                <LogOut size={15} /> Гарах
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
