import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ title, subtitle, onClose, children, footer, width = 620 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-6 md:p-10"
      style={{ background: 'rgba(32,33,36,0.5)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ec-panel ec-fade-in my-auto w-full" style={{ maxWidth: width }}>
        <div
          className="flex items-start gap-3 border-b px-5 py-3.5"
          style={{ borderColor: 'var(--grid-line)' }}
        >
          <div className="flex-1">
            <h2 className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button className="ec-btn -mr-2 px-2" onClick={onClose} title="Хаах (Esc)">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 border-t px-5 py-3"
            style={{ borderColor: 'var(--grid-line)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
