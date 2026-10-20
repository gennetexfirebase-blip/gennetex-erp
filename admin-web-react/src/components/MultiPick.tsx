import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';

/** Checkbox-той сонголтын жагсаалт (хүснэгтийн нүдэнд, popover нь fixed байрлалтай). */
export function MultiPick({ value, options, onChange, placeholder, allowCustom, exclude = [], className = '', single = false, sub = {} }: { value: string[]; options: string[]; onChange: (v: string[]) => void; placeholder: string; allowCustom?: boolean; exclude?: string[]; className?: string; single?: boolean; sub?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 260 });
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const width = Math.max(260, r.width);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom > 320;
    setPos({ left, top: below ? r.bottom + 4 : Math.max(8, r.top - 324), width });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (pop.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const all = [...new Set([...options, ...value])].filter((o) => !exclude.includes(o));
  const shown = all.filter((o) => `${o} ${sub[o] || ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (o: string) => {
    if (single) {
      onChange([o]);
      setOpen(false);
      setQ('');
      return;
    }
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  };
  const custom = allowCustom && q.trim() && !all.some((o) => o.toLowerCase() === q.trim().toLowerCase()) ? q.trim() : '';

  return (
    <>
      <button ref={btn} type="button" onClick={() => setOpen((o) => !o)} className={`flex min-h-9 w-full items-center gap-1 px-2 py-1 text-left text-[12.5px] hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`} aria-haspopup="listbox" aria-expanded={open}>
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {value.length ? value.map((v) => (single ? <span key={v} className="text-[13px] text-ink">{v}</span> : <span key={v} className="rounded bg-brand-soft px-1.5 py-0.5 text-[11.5px] font-medium text-brand">{v}</span>)) : <span className="text-subtle">{placeholder}</span>}
        </span>
        <ChevronDown size={13} className="shrink-0 text-subtle" />
      </button>
      {open
        ? createPortal(
            <div ref={pop} role="listbox" aria-multiselectable="true" className="fixed z-[120] overflow-hidden rounded-[var(--radius)] border border-line bg-card shadow-[var(--shadow-lg)]" style={{ left: pos.left, top: pos.top, width: pos.width }}>
              <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
                <Search size={14} className="text-subtle" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Хайх…" className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-subtle"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && custom) {
                      onChange(single ? [custom] : [...value, custom]);
                      setQ('');
                    }
                  }} />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {shown.map((o) => {
                  const on = value.includes(o);
                  return (
                    <button key={o} type="button" role="option" aria-selected={on} onClick={() => toggle(o)} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-ink hover:bg-hover">
                      <span className={`grid h-4 w-4 shrink-0 place-items-center border ${single ? 'rounded-full' : 'rounded'} ${on ? 'border-brand bg-brand text-white' : 'border-[var(--border-strong)]'}`}>{on ? <Check size={12} strokeWidth={3} /> : null}</span>
                      <span className="min-w-0 flex-1">{o}</span>
                      {sub[o] ? <span className="shrink-0 text-[11px] text-subtle">{sub[o]}</span> : null}
                    </button>
                  );
                })}
                {custom ? (
                  <button type="button" onClick={() => { onChange(single ? [custom] : [...value, custom]); setQ(''); if (single) setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] font-semibold text-brand hover:bg-hover"><Plus size={14} /> «{custom}» нэмэх</button>
                ) : null}
                {!shown.length && !custom ? <p className="px-3 py-2 text-[12px] text-subtle">Олдсонгүй</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
