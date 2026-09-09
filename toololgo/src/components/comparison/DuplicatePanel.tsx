import { useState } from 'react';
import { Copy, Search } from 'lucide-react';
import type { ColumnResult, ComparisonResults, DuplicateEntry } from '../../types';
import { num } from '../../lib/format';

interface Props {
  results: ComparisonResults | null;
  onSearchValue: (value: string) => void;
}

type Side = 'source' | 'reference';

export function DuplicatePanel({ results, onSearchValue }: Props) {
  const [side, setSide] = useState<Side>('source');
  const [query, setQuery] = useState('');

  if (!results) return null;

  const sections: { title: string; result: ColumnResult | null }[] = [
    { title: 'SERIAL', result: results.serial },
    { title: 'DEVC_NO', result: results.devc },
  ];

  const q = query.trim().toUpperCase();

  return (
    <div className="ec-scroll flex-1 overflow-auto p-4" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[900px]">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>
            Давхардсан утгууд
          </h2>
          <div
            className="flex overflow-hidden rounded border"
            style={{ borderColor: 'var(--grid-line-strong)' }}
          >
            {(['source', 'reference'] as Side[]).map((s) => (
              <button
                key={s}
                className="px-2.5 py-1 text-[12px]"
                style={{
                  background: side === s ? 'var(--accent-chip)' : 'transparent',
                  color: side === s ? 'var(--accent)' : 'var(--text-muted)',
                }}
                onClick={() => setSide(s)}
              >
                {s === 'source' ? 'Манай тал' : 'Цаанаас ирсэн'}
              </button>
            ))}
          </div>
          <input
            className="ec-input ml-auto w-[200px]"
            placeholder="Утгаар шүүх..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sections.map(({ title, result }) => {
            const list: DuplicateEntry[] = result
              ? side === 'source'
                ? result.topSourceDuplicates
                : result.topReferenceDuplicates
              : [];
            const filtered = q ? list.filter((d) => d.value.includes(q)) : list;
            const totalValues = result
              ? side === 'source'
                ? result.sourceDuplicateValues
                : result.referenceDuplicateValues
              : 0;

            return (
              <div
                key={title}
                className="rounded border"
                style={{ borderColor: 'var(--grid-line)', background: 'var(--bg-chrome)' }}
              >
                <div
                  className="flex items-center gap-2 border-b px-3 py-2"
                  style={{ borderColor: 'var(--grid-line)' }}
                >
                  <Copy size={13} style={{ color: 'var(--dup-text)' }} />
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                    {title}
                  </span>
                  <span className="ml-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {num(totalValues)} давхардсан утга
                  </span>
                </div>

                {!result && (
                  <div className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--text-faint)' }}>
                    Харьцуулаагүй байна.
                  </div>
                )}
                {result && filtered.length === 0 && (
                  <div className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--text-faint)' }}>
                    Давхардал олдсонгүй.
                  </div>
                )}

                <div className="ec-scroll max-h-[420px] overflow-auto">
                  {filtered.map((d) => (
                    <button
                      key={d.value}
                      className="flex w-full items-center gap-2 border-b px-3 py-1.5 text-left"
                      style={{ borderColor: 'var(--grid-line)' }}
                      onClick={() => onSearchValue(d.value)}
                      title="Хүснэгтэд хайх"
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="truncate font-mono text-[12px]" style={{ color: 'var(--text)' }}>
                        {d.value}
                      </span>
                      <span
                        className="ml-auto flex-none rounded px-1.5 text-[11px] ec-status-dup"
                        title={`${d.count} удаа`}
                      >
                        {d.count} удаа
                      </span>
                      <Search size={12} style={{ color: 'var(--text-faint)' }} />
                    </button>
                  ))}
                </div>

                {result && list.length >= 300 && (
                  <div className="px-3 py-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                    Эхний 300 утгыг харууллаа.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
