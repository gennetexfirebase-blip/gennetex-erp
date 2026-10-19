import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePref } from '../lib/theme';

const NEXT: Record<ThemePref, ThemePref> = { light: 'dark', dark: 'light', system: 'dark' };
const LABEL: Record<ThemePref, string> = { light: 'Өдрийн горим', dark: 'Шөнийн горим', system: 'Системийн горим' };

/** Нэг товч — Шөнө ↔ Өдөр (Систем — хэрэглэгчийн цэснээс). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { pref, setPref } = useTheme();
  const Icon = pref === 'dark' ? Moon : pref === 'light' ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={() => setPref(NEXT[pref])}
      className={`focus-ring relative grid h-9 w-9 place-items-center rounded-[var(--radius)] text-muted hover:bg-hover hover:text-ink ${className}`}
      aria-label={`${LABEL[pref]} — дарж солих`}
      title={`${LABEL[pref]} (дарж солих)`}
    >
      <Icon size={18} />
    </button>
  );
}

/** Гурван сонголттой segmented — хэрэглэгчийн цэсэнд. */
export function ThemeSegmented() {
  const { pref, setPref } = useTheme();
  const opts: [ThemePref, typeof Sun, string][] = [['light', Sun, 'Өдөр'], ['dark', Moon, 'Шөнө'], ['system', Monitor, 'Систем']];
  return (
    <div className="grid grid-cols-3 gap-1 rounded-[var(--radius)] bg-card2 p-1" role="radiogroup" aria-label="Дэлгэцийн горим">
      {opts.map(([k, I, l]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={pref === k}
          onClick={() => setPref(k)}
          className={`flex items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] font-semibold ${pref === k ? 'bg-card text-ink shadow-[var(--shadow)]' : 'text-muted hover:text-ink'}`}
        >
          <I size={13} /> {l}
        </button>
      ))}
    </div>
  );
}
