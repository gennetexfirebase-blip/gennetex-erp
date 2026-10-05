import { useState } from 'react';
import { Bell, Settings, PanelLeftClose, PanelLeftOpen, Menu, LogOut, Plus, Search, User, ChevronDown } from 'lucide-react';
import { Avatar } from './ui';
import { Link, useLocation } from 'react-router-dom';

/** timely_clone_prompt.md §2.2 — дээд topbar. */
export default function Topbar({
  onToggleSidebar,
  onOpenMobile,
  collapsed,
  profile,
  unread,
  onSignOut,
  actOnly = false,
  canCreateAct = false,
  canTemplates = false,
}: {
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  collapsed: boolean;
  profile: { name?: string | null; avatar_url?: string | null; email?: string | null } | null;
  unread: number;
  onSignOut: () => void;
  actOnly?: boolean;
  canCreateAct?: boolean;
  canTemplates?: boolean;
}) {
  const [menu, setMenu] = useState<null | 'user' | 'bell'>(null);
  const location = useLocation();
  const actPageTitle = location.pathname.includes('/settings/act-templates')
    ? 'Актын загварууд'
    : location.pathname.endsWith('/new')
      ? 'Шинэ акт'
      : location.pathname.endsWith('/edit')
        ? 'Акт засварлах'
        : location.pathname.endsWith('/preview')
          ? 'Актын дэлгэрэнгүй'
          : 'Актын бүртгэл';

  return (
    <header className="app-topbar sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line px-4 lg:px-6 xl:px-8">
      <button
        className="focus-ring rounded-[7px] p-2 text-muted hover:bg-hover hover:text-ink lg:hidden"
        onClick={onOpenMobile}
        aria-label="Цэс нээх"
      >
        <Menu size={18} />
      </button>
      <button
        className="focus-ring hidden rounded-[7px] p-2 text-muted hover:bg-hover hover:text-ink lg:block"
        onClick={onToggleSidebar}
        aria-label="Хажуугийн цэс хумих"
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-[13px] font-medium text-ink">{actOnly ? actPageTitle : 'Удирдлагын самбар'}</p>
        <p className="mt-0.5 text-[11px] text-subtle">{actOnly ? 'Баримт бичгийн удирдлага' : 'GENNETEX ERP'}</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Ажлын талбарын хайлт — «/» товчлолтой */}
        {!actOnly ? <label className="hidden items-center gap-2 rounded-[7px] border border-[var(--border-strong)] bg-card px-3 py-1.5 text-[13px] text-muted md:flex">
          <Search size={15} className="text-subtle" />
          <input
            className="w-40 bg-transparent text-ink outline-none placeholder:text-subtle lg:w-56"
            placeholder="Хайх…"
            aria-label="Хайх"
          />
        </label> : null}

        {actOnly && canCreateAct ? (
          <Link to="/admin/documents/acts/new" className="cta-gradient focus-ring hidden h-9 items-center gap-1.5 rounded-[7px] px-3.5 text-[13px] sm:inline-flex">
            <Plus size={15} /> Акт үүсгэх
          </Link>
        ) : !actOnly ? (
          <button className="cta-gradient focus-ring hidden h-9 items-center gap-1.5 rounded-[7px] px-3.5 text-[13px] sm:inline-flex">
            <Plus size={15} /> Шинэ тайлан
          </button>
        ) : null}

        {!actOnly ? <div className="relative">
          <button
            className="focus-ring relative rounded-[7px] p-2 text-muted hover:bg-hover hover:text-ink"
            onClick={() => setMenu(menu === 'bell' ? null : 'bell')}
            aria-label="Мэдэгдэл"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-[7px] bg-danger" />
            )}
          </button>
          {menu === 'bell' && (
            <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-[var(--radius)] border border-line bg-card p-3 shadow-panel">
              <p className="mb-2 text-[13px] font-semibold text-ink">Мэдэгдэл</p>
              <p className="text-[12px] text-subtle">
                {unread > 0 ? `${unread} уншаагүй мэдэгдэл байна.` : 'Шинэ мэдэгдэл алга.'}
              </p>
            </div>
          )}
        </div> : null}

        {actOnly ? (canTemplates ? <Link to="/admin/settings/act-templates" className="focus-ring rounded-[7px] p-2 text-muted hover:bg-hover hover:text-ink" aria-label="Тохиргоо"><Settings size={18} /></Link> : null) : <button className="focus-ring rounded-[7px] p-2 text-muted hover:bg-hover hover:text-ink" aria-label="Тохиргоо"><Settings size={18} /></button>}

        <div className="relative">
          <button
            className="focus-ring ml-1 flex items-center gap-2 rounded-[7px] border border-transparent p-1 hover:border-line hover:bg-hover"
            onClick={() => setMenu(menu === 'user' ? null : 'user')}
          >
            <Avatar name={profile?.name} src={profile?.avatar_url} size={30} />
            <span className="hidden max-w-28 truncate text-[12px] font-medium text-ink xl:block">{profile?.name || profile?.email || 'Хэрэглэгч'}</span>
            <ChevronDown size={14} className="hidden text-subtle xl:block" />
          </button>
          {menu === 'user' && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-[var(--radius)] border border-line bg-card p-1.5 shadow-panel">
              <div className="border-b border-line px-3 py-2">
                <p className="truncate text-[13px] font-semibold text-ink">{profile?.name || '—'}</p>
                <p className="truncate text-[11px] text-subtle">{profile?.email || ''}</p>
              </div>
              <button className="flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-[13px] text-muted hover:bg-hover hover:text-ink">
                <User size={15} /> Профайл
              </button>
              <button className="flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-[13px] text-muted hover:bg-hover hover:text-ink">
                <Settings size={15} /> Тохиргоо
              </button>
              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-[13px] text-danger hover:bg-danger-soft"
              >
                <LogOut size={15} /> Гарах
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
