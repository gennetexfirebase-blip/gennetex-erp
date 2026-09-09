import type { BusyState } from '../stores/appStore';

export function ProgressOverlay({ busy }: { busy: BusyState }) {
  const pct = Math.max(0, Math.min(1, busy.pct));
  const indeterminate = busy.pct < 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(32,33,36,0.55)' }}
    >
      <div className="ec-panel w-[380px] px-5 py-4">
        <div className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>
          {busy.label}
        </div>
        <div className="mt-1 h-4 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {busy.detail}
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded"
          style={{ background: 'var(--bg-chrome-2)' }}
        >
          <div
            className="h-full rounded transition-[width] duration-150"
            style={{
              width: indeterminate ? '40%' : `${pct * 100}%`,
              background: 'var(--accent)',
            }}
          />
        </div>
        {!indeterminate && (
          <div
            className="mt-1.5 text-right text-[11px] tabular-nums"
            style={{ color: 'var(--text-faint)' }}
          >
            {Math.round(pct * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}
