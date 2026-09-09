import { useEffect, useRef } from 'react';
import { Copy, Filter, Pencil, Search, Target } from 'lucide-react';
import type { GridColumn } from '../../types';

export interface ContextMenuState {
  x: number;
  y: number;
  rowIndex: number;
  colIndex: number;
  dataRow: number;
}

interface Props {
  state: ContextMenuState;
  column: GridColumn | undefined;
  valueText: string;
  editable: boolean;
  hasSelection: boolean;
  hasSerial: boolean;
  hasDevc: boolean;
  onClose: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onSearchValue: (value: string) => void;
  onFilterSerial: () => void;
  onFilterDevc: () => void;
  onShowDetail: (kind: 'serial' | 'devc') => void;
}

export function ContextMenu(props: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [props]);

  const item = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    disabled = false,
    hint?: string,
  ) => (
    <button
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] disabled:opacity-40"
      style={{ color: 'var(--text)' }}
      disabled={disabled}
      onClick={() => {
        onClick();
        props.onClose();
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span className="flex w-4 justify-center" style={{ color: 'var(--text-muted)' }}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
          {hint}
        </span>
      )}
    </button>
  );

  const isStatusColumn =
    props.column?.kind === 'serialStatus' || props.column?.kind === 'devcStatus';

  const maxX = window.innerWidth - 230;
  const maxY = window.innerHeight - 260;

  return (
    <div
      ref={ref}
      className="ec-panel ec-fade-in fixed z-50 w-[220px] py-1"
      style={{ left: Math.min(props.state.x, maxX), top: Math.min(props.state.y, maxY) }}
    >
      {item(<Copy size={13} />, 'Хуулах', props.onCopy, false, 'Ctrl+C')}
      {item(
        <Pencil size={13} />,
        'Засах',
        props.onEdit,
        !props.editable || props.column?.kind !== 'data',
        'F2',
      )}
      <div className="my-1 h-px" style={{ background: 'var(--grid-line)' }} />
      {item(
        <Search size={13} />,
        'Энэ утгаар хайх',
        () => props.onSearchValue(props.valueText),
        !props.valueText,
      )}
      {item(
        <Filter size={13} />,
        'SERIAL-аар шүүх',
        props.onFilterSerial,
        !props.hasSerial,
      )}
      {item(<Filter size={13} />, 'DEVC_NO-оор шүүх', props.onFilterDevc, !props.hasDevc)}
      <div className="my-1 h-px" style={{ background: 'var(--grid-line)' }} />
      {item(
        <Target size={13} />,
        'Тохирох SERIAL олох',
        () => props.onShowDetail('serial'),
        !props.hasSerial,
      )}
      {item(
        <Target size={13} />,
        'Тохирох DEVC_NO олох',
        () => props.onShowDetail('devc'),
        !props.hasDevc,
      )}
      {isStatusColumn && (
        <div className="px-3 pb-1 pt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
          {props.valueText}
        </div>
      )}
    </div>
  );
}
