import { AlertTriangle, ArrowLeftRight, CheckCircle2, Copy, XCircle } from 'lucide-react';
import type { ComparisonResults, FilterKind } from '../../types';
import { num } from '../../lib/format';

interface Props {
  results: ComparisonResults | null;
  sourceLabel: string;
  referenceLabel: string;
  onFilter: (kind: FilterKind, key: 'found' | 'missing' | 'duplicate') => void;
  onShowDuplicates: () => void;
}

function Stat({
  label,
  value,
  tone,
  icon,
  onClick,
  title,
}: {
  label: string;
  value: string;
  tone?: 'found' | 'missing' | 'dup' | 'plain';
  icon?: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const color =
    tone === 'found'
      ? 'var(--found-text)'
      : tone === 'missing'
        ? 'var(--missing-text)'
        : tone === 'dup'
          ? 'var(--dup-text)'
          : 'var(--text)';
  return (
    <button
      className="flex items-center gap-1.5 rounded px-2 py-1 text-left disabled:cursor-default"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      disabled={!onClick}
      title={title ?? label}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.background = 'var(--hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon && <span style={{ color }}>{icon}</span>}
      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
    </button>
  );
}

export function SummaryBar({
  results,
  sourceLabel,
  referenceLabel,
  onFilter,
  onShowDuplicates,
}: Props) {
  if (!results) return null;
  const { serial, devc, devcRef } = results;
  const diff = results.sourceTotal - results.referenceTotal;

  return (
    <div
      className="ec-scroll flex flex-none items-center gap-1 overflow-x-auto border-b px-2 py-1"
      style={{ background: 'var(--bg-chrome)', borderColor: 'var(--grid-line)' }}
    >
      <div className="flex flex-none items-center gap-1 pr-1">
        <Stat label="Манай тал" value={num(results.sourceTotal)} title={sourceLabel} />
        <Stat label="Цаанаас" value={num(results.referenceTotal)} title={referenceLabel} />
        <Stat
          label="Зөрүү"
          value={(diff > 0 ? '+' : '') + num(diff)}
          tone={diff === 0 ? 'plain' : diff > 0 ? 'missing' : 'dup'}
          icon={<ArrowLeftRight size={13} />}
          title="Манай тал − Цаанаас ирсэн"
        />
      </div>

      {serial && (
        <>
          <div className="ec-divider" />
          <span
            className="flex-none px-1 text-[11px] font-semibold uppercase"
            style={{ color: 'var(--text-faint)' }}
          >
            Serial
          </span>
          <Stat
            label="Байна"
            value={num(serial.found)}
            tone="found"
            icon={<CheckCircle2 size={13} />}
            onClick={() => onFilter('serial', 'found')}
            title="SERIAL БАЙНА — товшиж шүүнэ"
          />
          <Stat
            label="Байхгүй"
            value={num(serial.missing)}
            tone="missing"
            icon={<XCircle size={13} />}
            onClick={() => onFilter('serial', 'missing')}
            title="Зөвхөн манай тооллогод байгаа SERIAL — товшиж шүүнэ"
          />
          <Stat
            label="Давхардсан"
            value={num(serial.sourceDuplicateValues)}
            tone="dup"
            icon={<Copy size={13} />}
            onClick={onShowDuplicates}
            title="Давхардсан SERIAL утга"
          />
          {serial.empty > 0 && (
            <Stat
              label="Хоосон"
              value={num(serial.empty)}
              title="Хоосон SERIAL нүд (Байхгүй тоонд багтсан)"
            />
          )}
        </>
      )}

      {devc && (
        <>
          <div className="ec-divider" />
          <span
            className="flex-none px-1 text-[11px] font-semibold uppercase"
            style={{ color: 'var(--text-faint)' }}
          >
            Тооллого ↔ Цаанаас ирсэн
          </span>
          <Stat
            label="Байна"
            value={num(devc.found)}
            tone="found"
            icon={<CheckCircle2 size={13} />}
            onClick={() => onFilter('devc', 'found')}
          />
          <Stat
            label="Байхгүй"
            value={num(devc.missing)}
            tone="missing"
            icon={<XCircle size={13} />}
            onClick={() => onFilter('devc', 'missing')}
            title="Зөвхөн манай тооллогод байгаа — товшиж шүүнэ"
          />
          <Stat
            label="Давхардсан"
            value={num(devc.sourceDuplicateValues)}
            tone="dup"
            icon={<Copy size={13} />}
            onClick={onShowDuplicates}
          />
          {devc.empty > 0 && (
            <Stat
              label="Хоосон"
              value={num(devc.empty)}
              title="Хоосон нүд (Байхгүй тоонд багтсан)"
            />
          )}
        </>
      )}

      {devcRef && (
        <>
          <div className="ec-divider" />
          <span
            className="flex-none px-1 text-[11px] font-semibold uppercase"
            style={{ color: 'var(--text-faint)' }}
          >
            Цаанаас ирсэн
          </span>
          <Stat
            label="Байна"
            value={num(devcRef.found)}
            tone="found"
            icon={<CheckCircle2 size={13} />}
            onClick={() => onFilter('devcRef', 'found')}
            title="Цаанаас ирсэн бөгөөд манай тооллогод байгаа — товшиж шүүнэ"
          />
          <Stat
            label="Байхгүй"
            value={num(devcRef.missing)}
            tone="missing"
            icon={<XCircle size={13} />}
            onClick={() => onFilter('devcRef', 'missing')}
            title="Зөвхөн цаанаас ирсэн, манай тооллогод байхгүй — товшиж шүүнэ"
          />
        </>
      )}

      {!serial && !devc && (
        <span className="flex items-center gap-1.5 px-2 text-xs" style={{ color: 'var(--dup-text)' }}>
          <AlertTriangle size={13} /> Харьцуулах багана сонгогдоогүй байна.
        </span>
      )}
    </div>
  );
}
