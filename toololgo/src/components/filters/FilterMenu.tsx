import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import type { FilterKind, StatusFilterKey } from '../../types';

export interface FilterMenuTarget {
  kind: FilterKind;
  rect: DOMRect;
}

const TITLES: Record<FilterKind, string> = {
  serial: 'SERIAL · ТООЛЛОГО',
  devc: 'ТООЛЛОГО (манай тал)',
  serialRef: 'SERIAL · ЦААНААС ИРСЭН',
  devcRef: 'ЦААНААС ИРСЭН',
};

interface Props {
  target: FilterMenuTarget;
  value: Set<StatusFilterKey>;
  counts: { found: number; missing: number; duplicate: number; total: number };
  onChange: (keys: Set<StatusFilterKey>) => void;
  onClose: () => void;
}

const OPTIONS: { key: StatusFilterKey; label: string; className: string }[] = [
  { key: 'found', label: 'БАЙНА', className: 'ec-status-found' },
  { key: 'missing', label: 'БАЙХГҮЙ', className: 'ec-status-missing' },
  { key: 'duplicate', label: 'ДАВХАРДСАН', className: 'ec-status-dup' },
];

export function FilterMenu({ target, value, counts, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const toggle = (key: StatusFilterKey) => {
    const next = new Set(value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const left = Math.min(target.rect.left - 140, window.innerWidth - 226);
  const top = Math.min(target.rect.bottom + 4, window.innerHeight - 200);

  return (
    <div
      ref={ref}
      className="ec-panel ec-fade-in fixed z-40 w-[216px] py-1"
      style={{ left: Math.max(8, left), top }}
    >
      <div
        className="px-3 pb-1.5 pt-1 text-[10px] font-semibold tracking-wide"
        style={{ color: 'var(--text-faint)' }}
      >
        {TITLES[target.kind]}
      </div>
      <Row
        label="Бүгд"
        checked={value.size === 0}
        count={counts.total}
        onClick={() => onChange(new Set())}
      />
      <div className="my-1 h-px" style={{ background: 'var(--grid-line)' }} />
      {OPTIONS.map((o) => (
        <Row
          key={o.key}
          label={o.label}
          badgeClass={o.className}
          checked={value.has(o.key)}
          count={counts[o.key]}
          onClick={() => toggle(o.key)}
        />
      ))}
    </div>
  );
}

function Row({
  label,
  checked,
  count,
  onClick,
  badgeClass,
}: {
  label: string;
  checked: boolean;
  count: number;
  onClick: () => void;
  badgeClass?: string;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
      style={{ color: 'var(--text)' }}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        className="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-sm border"
        style={{
          borderColor: checked ? 'var(--accent)' : 'var(--grid-line-strong)',
          background: checked ? 'var(--accent)' : 'transparent',
          color: '#fff',
        }}
      >
        {checked && <Check size={10} strokeWidth={3} />}
      </span>
      {badgeClass ? (
        <span className={`rounded px-1.5 text-[11px] ${badgeClass}`}>{label}</span>
      ) : (
        <span>{label}</span>
      )}
      <span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
        {count.toLocaleString()}
      </span>
    </button>
  );
}
