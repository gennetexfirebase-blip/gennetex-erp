import { useRef } from 'react';
import { Check, FilePlus2, FileSpreadsheet, Settings2, X } from 'lucide-react';
import type { ComparisonConfig, Dataset, LoadedFile } from '../../types';
import { Modal } from '../ui/Modal';
import { columnLetter } from '../../lib/columns';
import { fileSize, num } from '../../lib/format';

interface Props {
  files: LoadedFile[];
  datasets: Record<string, Dataset>;
  config: ComparisonConfig;
  hasHeaderRow: boolean;
  onHeaderRowChange: (v: boolean) => void;
  onConfigChange: (patch: Partial<ComparisonConfig>) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onOpenSettings: () => void;
  onClose: () => void;
  onStart: () => void;
}

export function ImportDialog(props: Props) {
  const { files, datasets, config } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = Object.keys(datasets);

  const source = config.sourceDatasetId ? datasets[config.sourceDatasetId] : null;
  const reference = config.referenceDatasetId ? datasets[config.referenceDatasetId] : null;

  const serialOk = config.sourceSerialCol >= 0 && config.refSerialCol >= 0;
  const devcOk = config.sourceDevcCol >= 0 && config.refDevcCol >= 0;
  const canStart = !!source && !!reference && (serialOk || devcOk);

  return (
    <Modal
      title="Файл оруулах"
      subtitle="Харьцуулах хуудсуудаа сонгоно уу."
      onClose={props.onClose}
      width={660}
      footer={
        <>
          <button className="ec-btn ec-btn-outline" onClick={() => inputRef.current?.click()}>
            <FilePlus2 size={14} /> Өөр файл нэмэх
          </button>
          <button className="ec-btn ec-btn-outline" onClick={props.onOpenSettings}>
            <Settings2 size={14} /> Дэлгэрэнгүй тохиргоо
          </button>
          <div className="flex-1" />
          <button className="ec-btn ec-btn-outline" onClick={props.onClose}>
            Цуцлах
          </button>
          <button className="ec-btn ec-btn-primary" disabled={!canStart} onClick={props.onStart}>
            ХАРЬЦУУЛАХ
          </button>
        </>
      }
    >
      {/* files */}
      <div className="mb-4 space-y-1.5">
        {files.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-2 rounded border px-2.5 py-2"
            style={{ borderColor: 'var(--grid-line)', background: 'var(--bg-chrome)' }}
          >
            <FileSpreadsheet size={15} style={{ color: 'var(--found-text)' }} />
            <span className="truncate text-[13px] font-medium" style={{ color: 'var(--text)' }}>
              {f.name}
            </span>
            <span className="ml-auto whitespace-nowrap text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {f.size > 0 && `${fileSize(f.size)} · `}
              {f.sheetNames.length} хуудас
            </span>
          </div>
        ))}
      </div>

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-[var(--accent)]"
          checked={props.hasHeaderRow}
          onChange={(e) => props.onHeaderRowChange(e.target.checked)}
        />
        <span style={{ color: 'var(--text)' }}>Эхний мөр = баганын нэр (толгой)</span>
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SheetPicker
          title="TOOLLOGO / МАНАЙ ТАЛ"
          hint="Тооллого — манай талын төхөөрөмж"
          accent="var(--found-text)"
          ids={ids}
          datasets={datasets}
          value={config.sourceDatasetId}
          onChange={(id) => props.onConfigChange({ sourceDatasetId: id })}
          dataset={source}
          serialCol={config.sourceSerialCol}
          devcCol={config.sourceDevcCol}
        />
        <SheetPicker
          title="REFERENCE / ЦААНААС ИРСЭН"
          hint="Цаанаас ирсэн DEVC_NO жагсаалт"
          accent="var(--accent)"
          ids={ids}
          datasets={datasets}
          value={config.referenceDatasetId}
          onChange={(id) => props.onConfigChange({ referenceDatasetId: id })}
          dataset={reference}
          serialCol={config.refSerialCol}
          devcCol={config.refDevcCol}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
        <Detected label="SERIAL" ok={serialOk} />
        <Detected label="DEVC_NO" ok={devcOk} />
        {source && reference && (
          <span style={{ color: 'var(--text-muted)' }}>
            {num(source.rowCount)} × {num(reference.rowCount)} мөр
          </span>
        )}
      </div>

      {!serialOk && !devcOk && (
        <p className="mt-2 text-xs" style={{ color: 'var(--missing-text)' }}>
          SERIAL болон DEVC_NO багана автоматаар олдсонгүй. "Дэлгэрэнгүй тохиргоо"-оос гараар
          сонгоно уу.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) props.onAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </Modal>
  );
}

function Detected({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className="flex items-center gap-1"
      style={{ color: ok ? 'var(--found-text)' : 'var(--missing-text)' }}
    >
      {ok ? <Check size={14} /> : <X size={14} />} {label}
    </span>
  );
}

function SheetPicker({
  title,
  hint,
  accent,
  ids,
  datasets,
  value,
  onChange,
  dataset,
  serialCol,
  devcCol,
}: {
  title: string;
  hint: string;
  accent: string;
  ids: string[];
  datasets: Record<string, Dataset>;
  value: string | null;
  onChange: (id: string) => void;
  dataset: Dataset | null;
  serialCol: number;
  devcCol: number;
}) {
  return (
    <div
      className="rounded border p-3"
      style={{ borderColor: 'var(--grid-line)', background: 'var(--bg-chrome)' }}
    >
      <div className="text-[11px] font-semibold tracking-wide" style={{ color: accent }}>
        {title}
      </div>
      <div className="mb-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
        {hint}
      </div>
      <select className="ec-select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {ids.map((id) => (
          <option key={id} value={id}>
            {datasets[id].fileName} · {datasets[id].sheetName}
          </option>
        ))}
      </select>
      {dataset && (
        <div className="mt-2 space-y-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <div>
            {num(dataset.rowCount)} мөр · {dataset.headers.length} багана
          </div>
          <div>
            SERIAL:{' '}
            <b style={{ color: serialCol >= 0 ? 'var(--found-text)' : 'var(--missing-text)' }}>
              {serialCol >= 0
                ? `${columnLetter(serialCol)} · ${dataset.headers[serialCol]}`
                : 'олдсонгүй'}
            </b>
          </div>
          <div>
            DEVC_NO:{' '}
            <b style={{ color: devcCol >= 0 ? 'var(--found-text)' : 'var(--missing-text)' }}>
              {devcCol >= 0 ? `${columnLetter(devcCol)} · ${dataset.headers[devcCol]}` : 'олдсонгүй'}
            </b>
          </div>
        </div>
      )}
    </div>
  );
}
