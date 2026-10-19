import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, ExternalLink, Search } from 'lucide-react';
import { NAV } from '../lib/nav';
import { SITES, currentSite, siteUrl, type SiteKey } from '../lib/sites';
import { Kbd } from './ui';

type Entry = { key: string; label: string; site: SiteKey; to: string; icon: (typeof NAV)[number]['icon'] };

/** Ctrl+K — бүх subdomain-ийн хуудсыг нэг дороос хайж шилжинэ. */
export default function CommandPalette({ open, onClose, isAdmin, isSuper }: { open: boolean; onClose: () => void; isAdmin: boolean; isSuper: boolean }) {
  const navigate = useNavigate();
  const here = currentSite().key;
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const item of NAV) {
      if (item.actsOnly || (item.superOnly && !isSuper) || (!isAdmin && !item.openToAll)) continue;
      const site = item.site || 'admin';
      const rows = item.children ? item.children.map((c) => ({ label: c.label, to: c.to })) : [{ label: item.label, to: item.to! }];
      for (const r of rows) out.push({ key: `${site}${r.to}`, label: r.label, site, to: r.to, icon: item.icon });
    }
    // Одоогийн сайтынх эхэнд.
    return out.sort((a, b) => Number(b.site === here) - Number(a.site === here));
  }, [isAdmin, isSuper, here]);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? entries.filter((e) => `${e.label} ${SITES[e.site].title} ${SITES[e.site].host}`.toLowerCase().includes(needle))
    : entries;

  useEffect(() => {
    if (!open) return;
    setQ('');
    setAt(0);
    const t = window.setTimeout(() => input.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => setAt(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${at}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  if (!open) return null;

  const go = (e: Entry | undefined) => {
    if (!e) return;
    onClose();
    if (e.site === here) navigate(e.to);
    else window.location.href = siteUrl(e.site, e.to);
  };
  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setAt((i) => Math.min(shown.length - 1, i + 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setAt((i) => Math.max(0, i - 1));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      go(shown[at]);
    } else if (ev.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center bg-[rgba(20,28,24,0.42)] p-4 pt-[12vh] backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Хайх"
        className="pop-in w-full max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-line bg-card shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <label className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-subtle" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Хуудас, хэсэг хайх… (жишээ нь «цалин», «ирц»)"
            aria-label="Хайх"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={shown[at] ? `cmdk-${at}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle"
          />
          <Kbd>Esc</Kbd>
        </label>
        <div ref={list} id="cmdk-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {!shown.length ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted">«{q}» олдсонгүй.</p>
          ) : (
            shown.map((e, i) => {
              const Icon = e.icon;
              const other = e.site !== here;
              return (
                <button
                  key={e.key}
                  id={`cmdk-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === at}
                  onMouseMove={() => setAt(i)}
                  onClick={() => go(e)}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-left text-[13px] ${i === at ? 'bg-brand-soft text-brand-700' : 'text-ink'}`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)] ${i === at ? 'bg-card text-brand' : 'bg-card2 text-muted'}`}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{e.label}</span>
                  <span className="hidden shrink-0 text-[12px] text-subtle sm:inline">{SITES[e.site].title}</span>
                  {other ? <ExternalLink size={13} className="shrink-0 text-subtle" aria-label="Өөр хэсэг" /> : null}
                  {i === at ? <CornerDownLeft size={13} className="shrink-0 text-brand" aria-hidden="true" /> : null}
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line bg-card2 px-4 py-2 text-[11px] text-subtle">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> сонгох</span>
          <span className="flex items-center gap-1"><Kbd>Enter</Kbd> нээх</span>
          <span className="ml-auto">{shown.length} хуудас</span>
        </div>
      </div>
    </div>
  );
}
