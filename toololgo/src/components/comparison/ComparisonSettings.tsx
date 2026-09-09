import { useMemo, useState } from 'react';
import { AlertTriangle, Layers, Sparkles } from 'lucide-react';
import type { ComparisonConfig, Dataset } from '../../types';
import { Modal } from '../ui/Modal';
import { columnLetter, detectColumnPair, detectDevcColumn, detectInventoryColumn, detectSerialColumn } from '../../lib/columns';
import { num } from '../../lib/format';

interface Props {
  config: ComparisonConfig;
  datasets: Record<string, Dataset>;
  onCancel: () => void;
  onApply: (config: ComparisonConfig) => void;
}

export function ComparisonSettings({ config, datasets, onCancel, onApply }: Props) {
  const [draft, setDraft] = useState<ComparisonConfig>({ ...config, normalize: { ...config.normalize } });

  const ids = Object.keys(datasets);
  const source = draft.sourceDatasetId ? datasets[draft.sourceDatasetId] : null;
  const reference = draft.referenceDatasetId ? datasets[draft.referenceDatasetId] : null;
  const sameSheet = !!source && draft.sourceDatasetId === draft.referenceDatasetId;

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!source) list.push('Манай талын хуудас сонгогдоогүй байна.');
    if (!reference) list.push('Цаанаас ирсэн хуудас сонгогдоогүй байна.');
    const hasSerial = draft.sourceSerialCol >= 0 && draft.refSerialCol >= 0;
    const hasDevc = draft.sourceDevcCol >= 0 && draft.refDevcCol >= 0;
    if (!hasSerial && !hasDevc)
      list.push('Дор хаяж нэг хос багана (SERIAL эсвэл DEVC_NO) сонгоно уу.');
    if (
      sameSheet &&
      draft.sourceSerialCol >= 0 &&
      draft.sourceSerialCol === draft.refSerialCol
    )
      list.push('SERIAL: нэг багана өөртэйгөө харьцуулагдаж байна.');
    if (sameSheet && draft.sourceDevcCol >= 0 && draft.sourceDevcCol === draft.refDevcCol)
      list.push('DEVC_NO: нэг багана өөртэйгөө харьцуулагдаж байна.');
    return list;
  }, [draft, source, reference, sameSheet]);

  const autoDetect = () => {
    if (!source || !reference) return;
    if (sameSheet) {
      const s = detectColumnPair(source.headers, 'serial');
      const d = detectColumnPair(source.headers, 'devc');
      setDraft({
        ...draft,
        sourceSerialCol: s.source,
        refSerialCol: s.reference,
        sourceDevcCol: d.source,
        refDevcCol: d.reference,
      });
    } else {
      const sSerial = detectSerialColumn(source.headers);
      const rSerial = detectSerialColumn(reference.headers);
      const rDevc = detectDevcColumn(reference.headers, rSerial >= 0 ? [rSerial] : []);
      const sInventory = detectInventoryColumn(
        source.headers,
        source.rows,
        sSerial >= 0 ? [sSerial] : [],
        rDevc >= 0 ? reference.rows.map((row) => row[rDevc]) : [],
      );
      setDraft({
        ...draft,
        sourceSerialCol: sSerial,
        refSerialCol: rSerial,
        sourceDevcCol: sInventory >= 0 ? sInventory : detectDevcColumn(source.headers, sSerial >= 0 ? [sSerial] : []),
        refDevcCol: rDevc,
      });
    }
  };

  return (
    <Modal
      title="Харьцуулалтын тохиргоо"
      subtitle="Аль багануудыг хооронд нь харьцуулахаа сонгоно уу."
      onClose={onCancel}
      width={680}
      footer={
        <>
          <button className="ec-btn ec-btn-outline" onClick={autoDetect}>
            <Sparkles size={14} /> Автоматаар таних
          </button>
          <div className="flex-1" />
          <button className="ec-btn ec-btn-outline" onClick={onCancel}>
            Цуцлах
          </button>
          <button
            className="ec-btn ec-btn-primary"
            disabled={problems.length > 0}
            onClick={() => onApply(draft)}
          >
            Харьцуулах
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section
          title="TOOLLOGO / МАНАЙ ТАЛ"
          hint="Тооллого — манай талын төхөөрөмж"
          accent="var(--found-text)"
        >
          <Label text="Хуудас">
            <select
              className="ec-select"
              value={draft.sourceDatasetId ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                const ds = datasets[id];
                const devc = sameSheet
                  ? detectColumnPair(ds.headers, 'devc').source
                  : detectDevcColumn(ds.headers);
                setDraft({
                  ...draft,
                  sourceDatasetId: id,
                  sourceSerialCol: detectSerialColumn(ds.headers),
                  sourceDevcCol: devc,
                });
              }}
            >
              {ids.map((id) => (
                <option key={id} value={id}>
                  {datasets[id].fileName} · {datasets[id].sheetName} ({num(datasets[id].rowCount)})
                </option>
              ))}
            </select>
          </Label>
          <Label text="SERIAL">
            <ColumnSelect
              dataset={source}
              value={draft.sourceSerialCol}
              onChange={(v) => setDraft({ ...draft, sourceSerialCol: v })}
            />
          </Label>
          <Label text="DEVC_NO">
            <ColumnSelect
              dataset={source}
              value={draft.sourceDevcCol}
              onChange={(v) => setDraft({ ...draft, sourceDevcCol: v })}
            />
          </Label>
        </Section>

        <Section
          title="REFERENCE / ЦААНААС ИРСЭН"
          hint="Цаанаас ирсэн DEVC_NO жагсаалт"
          accent="var(--accent)"
        >
          <Label text="Хуудас">
            <select
              className="ec-select"
              value={draft.referenceDatasetId ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                const ds = datasets[id];
                const isSame = id === draft.sourceDatasetId;
                const serial = isSame
                  ? detectColumnPair(ds.headers, 'serial').reference
                  : detectSerialColumn(ds.headers);
                const devc = isSame
                  ? detectColumnPair(ds.headers, 'devc').reference
                  : detectDevcColumn(ds.headers);
                setDraft({ ...draft, referenceDatasetId: id, refSerialCol: serial, refDevcCol: devc });
              }}
            >
              {ids.map((id) => (
                <option key={id} value={id}>
                  {datasets[id].fileName} · {datasets[id].sheetName} ({num(datasets[id].rowCount)})
                </option>
              ))}
            </select>
          </Label>
          <Label text="SERIAL">
            <ColumnSelect
              dataset={reference}
              value={draft.refSerialCol}
              onChange={(v) => setDraft({ ...draft, refSerialCol: v })}
            />
          </Label>
          <Label text="DEVC_NO">
            <ColumnSelect
              dataset={reference}
              value={draft.refDevcCol}
              onChange={(v) => setDraft({ ...draft, refDevcCol: v })}
            />
          </Label>
        </Section>
      </div>

      <div
        className="mt-4 flex items-center gap-2 rounded px-2.5 py-1.5 text-xs"
        style={{ background: 'var(--bg-chrome)', color: 'var(--text-muted)' }}
      >
        <Layers size={13} />
        {sameSheet
          ? 'MODE A — нэг хуудасны хоёр багана харьцуулж байна.'
          : 'MODE B — тусдаа хуудас / файл харьцуулж байна.'}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-[11px] font-semibold tracking-wide" style={{ color: 'var(--text-faint)' }}>
          НОРМАЛЧЛАЛ
        </div>
        <Check
          checked={draft.normalize.trim}
          label="Урд/хойд хоосон зайг үл тооцох"
          onChange={(v) => setDraft({ ...draft, normalize: { ...draft.normalize, trim: v } })}
        />
        <Check
          checked={draft.normalize.caseInsensitive}
          label="Том/жижиг үсгийг үл ялгах"
          onChange={(v) =>
            setDraft({ ...draft, normalize: { ...draft.normalize, caseInsensitive: v } })
          }
        />
        <Check
          checked={draft.normalize.ignoreInnerSpaces}
          label="Дотоод хоосон зайг үл тооцох  (AB 001 = AB001)"
          onChange={(v) =>
            setDraft({ ...draft, normalize: { ...draft.normalize, ignoreInnerSpaces: v } })
          }
        />
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
          Тэмдэгтүүд ( - _ / . ) хэвээр хадгалагдана: ABC-001 → ABC-001
        </p>
      </div>

      {problems.length > 0 && (
        <div
          className="mt-3 rounded px-2.5 py-2 text-xs"
          style={{ background: 'var(--missing-bg)', color: 'var(--missing-text)' }}
        >
          {problems.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <AlertTriangle size={12} /> {p}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Section({
  title,
  hint,
  accent,
  children,
}: {
  title: string;
  hint: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded border p-3"
      style={{ borderColor: 'var(--grid-line)', background: 'var(--bg-chrome)' }}
    >
      <div className="text-[11px] font-semibold tracking-wide" style={{ color: accent }}>
        {title}
      </div>
      <div className="mb-2.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
        {hint}
      </div>
      {children}
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {text}
      </div>
      {children}
    </div>
  );
}

function ColumnSelect({
  dataset,
  value,
  onChange,
}: {
  dataset: Dataset | null;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <select
      className="ec-select"
      value={value}
      disabled={!dataset}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value={-1}>— ашиглахгүй —</option>
      {dataset?.headers.map((h, i) => (
        <option key={i} value={i}>
          {columnLetter(i)} · {h}
        </option>
      ))}
    </select>
  );
}

function Check({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-1 flex cursor-pointer items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--accent)]"
      />
      <span style={{ color: 'var(--text)' }}>{label}</span>
    </label>
  );
}
