import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CornerDownRight, X } from 'lucide-react';
import type { CellValue, ComparisonResults, ComparisonConfig, Dataset } from '../../types';
import { STATUS_EMPTY, STATUS_FOUND } from '../../types';
import { matchesForRow, MAX_STORED_MATCHES } from '../../lib/compare';
import { cellRaw, statusInfo } from '../../lib/grid';
import { displayValue } from '../../lib/normalize';
import { num } from '../../lib/format';

export interface PopoverTarget {
  dataRow: number;
  kind: 'serial' | 'devc';
  rect: DOMRect;
}

interface Props {
  target: PopoverTarget;
  source: Dataset;
  reference: Dataset | null;
  config: ComparisonConfig;
  results: ComparisonResults;
  sourceOverrides?: Map<string, CellValue>;
  onClose: () => void;
  onGoToReference: (row: number) => void;
}

const W = 300;

export function ResultPopover(props: Props) {
  const { target, source, reference, config, results, sourceOverrides } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [matchIdx, setMatchIdx] = useState(0);

  useEffect(() => setMatchIdx(0), [target.dataRow, target.kind]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [props]);

  const result = target.kind === 'serial' ? results.serial : results.devc;
  const otherResult = target.kind === 'serial' ? results.devc : results.serial;

  const srcCol = target.kind === 'serial' ? config.sourceSerialCol : config.sourceDevcCol;
  const otherSrcCol = target.kind === 'serial' ? config.sourceDevcCol : config.sourceSerialCol;
  const refCol = target.kind === 'serial' ? config.refSerialCol : config.refDevcCol;

  const value = displayValue(cellRaw(source, sourceOverrides, target.dataRow, srcCol));
  const otherValue =
    otherSrcCol >= 0 ? displayValue(cellRaw(source, sourceOverrides, target.dataRow, otherSrcCol)) : '';

  const info = statusInfo(result, target.dataRow);
  const otherInfo = statusInfo(otherResult, target.dataRow);

  const matches = useMemo(
    () => (result ? Array.from(matchesForRow(result, target.dataRow)) : []),
    [result, target.dataRow],
  );

  const occurrences = result?.refOccurrences[target.dataRow] ?? 0;
  const srcOccurrences = result?.srcOccurrences[target.dataRow] ?? 0;
  const capped = occurrences > MAX_STORED_MATCHES;

  const top = Math.min(target.rect.bottom + 6, window.innerHeight - 340);
  const left = Math.min(Math.max(8, target.rect.left), window.innerWidth - W - 12);

  const currentRefRow = matches[matchIdx];
  const refValue =
    reference && currentRefRow !== undefined && refCol >= 0
      ? displayValue(reference.rows[currentRefRow]?.[refCol] ?? null)
      : '';

  const title = target.kind === 'serial' ? 'SERIAL ШАЛГАЛТ' : 'DEVC_NO ШАЛГАЛТ';

  return (
    <div
      ref={ref}
      className="ec-panel ec-fade-in fixed z-40 overflow-hidden"
      style={{ width: W, left, top }}
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--grid-line)', background: 'var(--bg-chrome)' }}
      >
        <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {title}
        </span>
        <span className="ml-auto text-[11px]" style={{ color: 'var(--text-faint)' }}>
          мөр {target.dataRow + 1}
        </span>
        <button className="ec-btn h-5 px-1" onClick={props.onClose} title="Хаах">
          <X size={13} />
        </button>
      </div>

      <div className="px-3 py-2.5">
        <Field label={target.kind === 'serial' ? 'SERIAL' : 'DEVC_NO'}>
          <span className="font-mono text-[13px]">{value || '—'}</span>
        </Field>

        <Field label="СТАТУС">
          {info ? (
            <span className={`inline-flex rounded px-1.5 py-0.5 text-[12px] ${info.className}`}>
              {info.label}
            </span>
          ) : (
            <span style={{ color: 'var(--text-faint)' }}>—</span>
          )}
        </Field>

        {info?.code === STATUS_FOUND ? (
          <>
            <Field label="ЦААНААС ИРСЭН МӨР">
              <div className="flex items-center gap-1">
                <button
                  className="ec-btn h-6 px-1"
                  disabled={matchIdx <= 0}
                  onClick={() => setMatchIdx((i) => Math.max(0, i - 1))}
                  title="Өмнөх"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="font-mono text-[13px] tabular-nums">
                  {currentRefRow !== undefined ? currentRefRow + 1 : '—'}
                </span>
                <button
                  className="ec-btn h-6 px-1"
                  disabled={matchIdx >= matches.length - 1}
                  onClick={() => setMatchIdx((i) => Math.min(matches.length - 1, i + 1))}
                  title="Дараах"
                >
                  <ChevronRight size={13} />
                </button>
                <span className="ml-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Match {matchIdx + 1} of {num(occurrences)}
                  {capped && ' (эхний 200)'}
                </span>
              </div>
            </Field>

            {refValue && (
              <Field label="ЦААНААС ИРСЭН УТГА">
                <span className="font-mono text-[13px]">{refValue}</span>
              </Field>
            )}

            {reference && currentRefRow !== undefined && (
              <button
                className="ec-btn ec-btn-outline mt-1 w-full justify-center"
                onClick={() => props.onGoToReference(currentRefRow)}
              >
                <CornerDownRight size={13} />
                Тухайн мөр рүү очих
              </button>
            )}
          </>
        ) : info?.code === STATUS_EMPTY ? (
          <Field label="ТАЙЛБАР">
            <span style={{ color: 'var(--text-muted)' }}>Хоосон утга — харьцуулаагүй.</span>
          </Field>
        ) : (
          <Field label="ЦААНААС ИРСЭН">
            <span style={{ color: 'var(--missing-text)' }}>Олдсонгүй</span>
          </Field>
        )}

        <div className="my-2 h-px" style={{ background: 'var(--grid-line)' }} />

        <Field label="ДАВТАЛТ (цаанаас)">
          <span className="tabular-nums">{num(occurrences)}</span>
        </Field>
        <Field label="ДАВТАЛТ (манай тал)">
          <span
            className="tabular-nums"
            style={{ color: srcOccurrences > 1 ? 'var(--dup-text)' : undefined }}
          >
            {num(srcOccurrences)}
            {srcOccurrences > 1 && ' — давхардсан'}
          </span>
        </Field>

        {otherSrcCol >= 0 && otherInfo && (
          <>
            <div className="my-2 h-px" style={{ background: 'var(--grid-line)' }} />
            <Field label={target.kind === 'serial' ? 'DEVC_NO' : 'SERIAL'}>
              <span className="font-mono text-[13px]">{otherValue || '—'}</span>
            </Field>
            <Field label="СТАТУС">
              <span className={`inline-flex rounded px-1.5 py-0.5 text-[12px] ${otherInfo.className}`}>
                {otherInfo.label}
              </span>
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text-faint)' }}>
        {label}
      </div>
      <div style={{ color: 'var(--text)' }}>{children}</div>
    </div>
  );
}
