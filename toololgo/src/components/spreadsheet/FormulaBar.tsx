import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { GridColumn } from '../../types';
import { columnLetter } from '../../lib/columns';

interface Props {
  column: GridColumn | null;
  dataRow: number | null;
  value: string;
  colIndex: number;
  editable: boolean;
  onCommit: (value: string) => void;
}

export function FormulaBar({ column, dataRow, value, colIndex, editable, onCommit }: Props) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(value);
    setDirty(false);
  }, [value, dataRow, colIndex]);

  const address = dataRow !== null ? `${columnLetter(colIndex)}${dataRow + 1}` : '';
  const canEdit = editable && column?.kind === 'data' && dataRow !== null;

  return (
    <div
      className="flex h-8 flex-none items-center gap-1 border-b px-1"
      style={{ background: 'var(--bg)', borderColor: 'var(--grid-line)' }}
    >
      <div
        className="flex h-6 w-[86px] flex-none items-center justify-center rounded border text-[12px] font-medium tabular-nums"
        style={{
          borderColor: 'var(--grid-line-strong)',
          color: 'var(--text)',
          background: 'var(--bg-elevated)',
        }}
        title="Идэвхтэй нүд"
      >
        {address || '—'}
      </div>
      <div className="ec-divider" />
      {dirty && canEdit && (
        <>
          <button
            className="ec-btn h-6 px-1"
            title="Болих (Esc)"
            onClick={() => {
              setDraft(value);
              setDirty(false);
            }}
          >
            <X size={14} />
          </button>
          <button
            className="ec-btn h-6 px-1"
            style={{ color: 'var(--found-text)' }}
            title="Хадгалах (Enter)"
            onClick={() => {
              onCommit(draft);
              setDirty(false);
            }}
          >
            <Check size={14} />
          </button>
        </>
      )}
      <input
        className="h-6 flex-1 border-none bg-transparent px-1 text-[13px] outline-none"
        style={{ color: 'var(--text)' }}
        readOnly={!canEdit}
        value={draft}
        placeholder={column ? column.label : ''}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canEdit) {
            onCommit(draft);
            setDirty(false);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setDraft(value);
            setDirty(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}
