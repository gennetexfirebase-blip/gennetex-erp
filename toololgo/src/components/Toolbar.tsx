import { useRef } from 'react';
import {
  Columns3,
  Download,
  FileSpreadsheet,
  FilterX,
  Grid2x2Check,
  History,
  LogOut,
  Monitor,
  Moon,
  Redo2,
  RefreshCw,
  Save,
  Settings2,
  Sun,
  Undo2,
  Upload,
  XCircle,
} from 'lucide-react';
import { SearchBar } from './filters/SearchBar';
import type { Theme } from '../types';

interface Props {
  title: string;
  subtitle: string;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onFiles: (files: FileList | File[]) => void;
  onExport: () => void;
  onExportFull: () => void;
  exportCount: number;
  onOpenSettings: () => void;
  onNewFile: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  onlyDuplicates: boolean;
  onToggleDuplicates: () => void;
  refMissingActive: boolean;
  refMissingCount: number;
  onToggleRefMissing: () => void;
  frozenColumns: number;
  onFrozenColumns: (n: number) => void;
  stale: boolean;
  onRecompare: () => void;
  search: string;
  onSearch: (v: string) => void;
  hitCount: number;
  activeIndex: number;
  onNextHit: () => void;
  onPrevHit: () => void;
  searching: boolean;
  searchDisabled: boolean;
  /** Нэвтэрсэн хэрэглэгчийн и-мэйл — толгойд харуулна. */
  userEmail: string;
  onSignOut: () => void;
  onSave: () => void;
  onHistory: () => void;
  canSave: boolean;
}

export function Toolbar(p: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const nextTheme: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
  const ThemeIcon = p.theme === 'light' ? Sun : p.theme === 'dark' ? Moon : Monitor;

  return (
    <div className="flex-none" style={{ background: 'var(--bg-chrome)' }}>
      {/* ---- top bar ---- */}
      <div
        className="flex h-11 items-center gap-2 border-b px-3"
        style={{ borderColor: 'var(--grid-line)' }}
      >
        <div
          className="flex h-6 w-6 flex-none items-center justify-center rounded"
          style={{ background: 'var(--found-bg)', color: 'var(--found-text)' }}
        >
          <FileSpreadsheet size={15} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] leading-tight" style={{ color: 'var(--text)' }}>
            {p.title}
          </div>
          <div className="truncate text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
            {p.subtitle}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SearchBar
            value={p.search}
            onChange={p.onSearch}
            hitCount={p.hitCount}
            activeIndex={p.activeIndex}
            onNext={p.onNextHit}
            onPrev={p.onPrevHit}
            searching={p.searching}
            disabled={p.searchDisabled}
          />
          <span
            className="hidden max-w-[200px] truncate text-[12px] xl:inline"
            style={{ color: 'var(--text-muted)' }}
            title={p.userEmail}
          >
            {p.userEmail}
          </span>
          <button className="ec-btn px-2" onClick={p.onSignOut} title="Гарах">
            <LogOut size={15} />
          </button>
          <button
            className="ec-btn px-2"
            title={`Загвар: ${p.theme}`}
            onClick={() => p.onTheme(nextTheme[p.theme])}
          >
            <ThemeIcon size={15} />
          </button>
          <button className="ec-btn" onClick={p.onOpenSettings} title="Харьцуулалтын тохиргоо">
            <Settings2 size={15} />
            <span className="hidden lg:inline">Тохиргоо</span>
          </button>
        </div>
      </div>

      {/* ---- toolbar ---- */}
      <div
        className="ec-scroll flex h-10 items-center gap-1 overflow-x-auto border-b px-2"
        style={{ borderColor: 'var(--grid-line)' }}
      >
        <button className="ec-btn" onClick={() => inputRef.current?.click()}>
          <Upload size={14} /> Excel оруулах
        </button>
        <button
          className="ec-btn"
          onClick={p.onExport}
          disabled={!p.canExport}
          title="Зөвхөн БАЙХГҮЙ — ЦААНААС ба ТООЛЛОГО тал тусдаа хуудсанд"
        >
          <Download size={14} /> БАЙХГҮЙ татах ({p.exportCount.toLocaleString('mn-MN')})
        </button>
        <button
          className="ec-btn ec-btn-outline"
          onClick={p.onExportFull}
          disabled={!p.canExport}
          title="Эх файлын бүх багана, бүх мөр"
        >
          <Download size={14} /> Бүрэн
        </button>

        <div className="mx-1 h-5 w-px flex-none" style={{ background: 'var(--grid-line)' }} />

        <button
          className="ec-btn"
          onClick={p.onSave}
          disabled={!p.canSave}
          title="Энэ тооллогыг серверт хадгалах"
        >
          <Save size={14} /> Хадгалах
        </button>
        <button className="ec-btn" onClick={p.onHistory} title="Хадгалсан тооллогууд">
          <History size={14} /> Түүх
        </button>

        <div className="ec-divider" />

        <button className="ec-btn px-1.5" onClick={p.onUndo} disabled={!p.canUndo} title="Буцаах (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button className="ec-btn px-1.5" onClick={p.onRedo} disabled={!p.canRedo} title="Дахин хийх (Ctrl+Y)">
          <Redo2 size={15} />
        </button>

        <div className="ec-divider" />

        <button
          className="ec-btn"
          onClick={p.onToggleDuplicates}
          style={
            p.onlyDuplicates
              ? { background: 'var(--dup-bg)', color: 'var(--dup-text)' }
              : undefined
          }
          title="Зөвхөн давхардсан мөрийг харуулах"
        >
          <Grid2x2Check size={14} /> Зөвхөн давхардсан
        </button>
        <button
          className="ec-btn"
          onClick={p.onToggleRefMissing}
          disabled={p.refMissingCount === 0 && !p.refMissingActive}
          style={
            p.refMissingActive
              ? { background: 'var(--missing-bg)', color: 'var(--missing-text)' }
              : undefined
          }
          title="Цаанаас ирсэн ч манай тооллогод БАЙХГҮЙ мөрүүд"
        >
          <XCircle size={14} /> Цаанаас · БАЙХГҮЙ
          <span className="tabular-nums">({p.refMissingCount.toLocaleString('mn-MN')})</span>
        </button>
        <button className="ec-btn" onClick={p.onClearFilters} disabled={!p.hasFilters} title="Шүүлтүүр цэвэрлэх">
          <FilterX size={14} /> Шүүлт цэвэрлэх
        </button>

        <div className="ec-divider" />

        <div className="flex items-center gap-1 px-1" title="Багана хөлдөөх">
          <Columns3 size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            className="h-6 rounded border bg-transparent px-1 text-[12px] outline-none"
            style={{ borderColor: 'var(--grid-line-strong)', color: 'var(--text)' }}
            value={p.frozenColumns}
            onChange={(e) => p.onFrozenColumns(Number(e.target.value))}
          >
            <option value={0}>Хөлдөөхгүй</option>
            <option value={1}>1 багана</option>
            <option value={2}>2 багана</option>
            <option value={3}>3 багана</option>
          </select>
        </div>

        <div className="ec-divider" />

        <div className="flex flex-none items-center gap-2 px-1 text-[11px]">
          <span className="rounded px-1.5 py-0.5 ec-status-found">БАЙНА</span>
          <span className="rounded px-1.5 py-0.5 ec-status-missing">БАЙХГҮЙ</span>
          <span className="rounded px-1.5 py-0.5 ec-status-dup">ДАВХАРДСАН</span>
        </div>

        <div className="ml-auto flex flex-none items-center gap-1 pl-2">
          {p.stale && (
            <button
              className="ec-btn"
              style={{ background: 'var(--dup-bg)', color: 'var(--dup-text)' }}
              onClick={p.onRecompare}
              title="Өгөгдөл өөрчлөгдсөн — дахин харьцуулах"
            >
              <RefreshCw size={14} /> Дахин харьцуулах
            </button>
          )}
          <button className="ec-btn ec-btn-outline" onClick={p.onNewFile}>
            Шинэ файл
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) p.onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
