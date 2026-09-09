import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  hitCount: number;
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  disabled?: boolean;
  searching?: boolean;
}

export function SearchBar({
  value,
  onChange,
  hitCount,
  activeIndex,
  onNext,
  onPrev,
  disabled,
  searching,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="flex h-7 items-center gap-1 rounded border px-2"
      style={{
        borderColor: 'var(--grid-line-strong)',
        background: 'var(--bg-elevated)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Search size={13} style={{ color: 'var(--text-muted)' }} />
      <input
        ref={inputRef}
        disabled={disabled}
        value={value}
        placeholder="Хайх  (Ctrl+F)"
        className="w-[150px] border-none bg-transparent text-[13px] outline-none lg:w-[220px]"
        style={{ color: 'var(--text)' }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) onPrev();
            else onNext();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onChange('');
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {value && (
        <>
          <span
            className="whitespace-nowrap text-[11px] tabular-nums"
            style={{ color: hitCount ? 'var(--text-muted)' : 'var(--missing-text)' }}
          >
            {searching ? '...' : hitCount ? `${activeIndex + 1}/${hitCount.toLocaleString()}` : '0'}
          </span>
          <button className="ec-btn h-5 px-0.5" onClick={onPrev} disabled={!hitCount} title="Өмнөх (Shift+Enter)">
            <ChevronUp size={13} />
          </button>
          <button className="ec-btn h-5 px-0.5" onClick={onNext} disabled={!hitCount} title="Дараах (Enter)">
            <ChevronDown size={13} />
          </button>
          <button className="ec-btn h-5 px-0.5" onClick={() => onChange('')} title="Цэвэрлэх (Esc)">
            <X size={13} />
          </button>
        </>
      )}
    </div>
  );
}
