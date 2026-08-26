import { useState } from 'react';
import { Bell, Settings, PanelLeftClose, PanelLeftOpen, Mail, Menu, LogOut, User } from 'lucide-react';
import { Avatar } from './ui';

/** timely_clone_prompt.md §2.2 — дээд topbar. */
export default function Topbar({
  onToggleSidebar,
  onOpenMobile,
  collapsed,
  profile,
  unread,
  onSignOut,
}: {
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  collapsed: boolean;
  profile: { name?: string | null; avatar_url?: string | null; email?: string | null } | null;
  unread: number;
  onSignOut: () => void;
}) {
  const [menu, setMenu] = useState<null | 'user' | 'bell'>(null);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-topbar px-4">
      <button
        className="focus-ring rounded-[var(--radius-sm)] p-2 text-muted hover:bg-hover hover:text-ink lg:hidden"
        onClick={onOpenMobile}
        aria-label="Цэс нээх"
      >
        <Menu size={18} />
      </button>
      <button
        className="focus-ring hidden rounded-[var(--radius-sm)] p-2 text-muted hover:bg-hover hover:text-ink lg:block"
        onClick={onToggleSidebar}
        aria-label="Хажуугийн цэс хумих"
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      <button className="focus-ring hidden items-center gap-2 rounded-[var(--radius-sm)] border border-warning/40 px-3 py-2 text-[13px] font-semibold text-warning hover:bg-warning-soft sm:inline-flex">
        <Mail size={15} />
        Санал хүсэлт илгээх
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative">
          <button
            className="focus-ring relative rounded-[var(--radius-sm)] p-2 text-muted hover:bg-hover hover:text-ink"
            onClick={() => setMenu(menu === 'bell' ? null : 'bell')}
            aria-label="Мэдэгдэл"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
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
        </div>

        <button
          className="focus-ring rounded-[var(--radius-sm)] p-2 text-muted hover:bg-hover hover:text-ink"
          aria-label="Тохиргоо"
        >
          <Settings size={18} />
        </button>

        <div className="relative">
          <button
            className="focus-ring ml-1 flex items-center gap-2 rounded-[var(--radius-sm)] p-1 hover:bg-hover"
            onClick={() => setMenu(menu === 'user' ? null : 'user')}
          >
            <Avatar name={profile?.name} src={profile?.avatar_url} size={30} />
          </button>
          {menu === 'user' && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-[var(--radius)] border border-line bg-card p-1.5 shadow-panel">
              <div className="border-b border-line px-3 py-2">
                <p className="truncate text-[13px] font-semibold text-ink">{profile?.name || '—'}</p>
                <p className="truncate text-[11px] text-subtle">{profile?.email || ''}</p>
              </div>
              <button className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-muted hover:bg-hover hover:text-ink">
                <User size={15} /> Профайл
              </button>
              <button className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-muted hover:bg-hover hover:text-ink">
                <Settings size={15} /> Тохиргоо
              </button>
              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-danger hover:bg-danger-soft"
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
