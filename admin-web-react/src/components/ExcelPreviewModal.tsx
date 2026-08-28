import { useMemo } from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from './ui';
import { dailySheets, toPreview, downloadDailyExcel } from '../lib/attendanceExport';
import ExcelIcon from '../components/ExcelIcon';
import type { AttendanceRow } from '../lib/data';

/**
 * Excel тайланг ТАТАХААС ӨМНӨ урьдчилан харуулна.
 *
 * Хүснэгтэд харагдаж буй мөрүүд нь Excel-д бичигдэх мөрүүд ЯГ ӨӨРӨӨ
 * (нэг л `attendanceReportBuilder`-ээс гардаг) тул "харсан" ба "татсан"
 * хоёр зөрөхгүй.
 */
export default function ExcelPreviewModal({
  open,
  date,
  rows,
  onClose,
}: {
  open: boolean;
  date: string;
  rows: AttendanceRow[];
  onClose: () => void;
}) {
  const sheets = useMemo(() => (open ? dailySheets(date, rows) : []), [open, date, rows]);
  const preview = useMemo(() => (sheets.length ? toPreview(sheets) : null), [sheets]);
  const summary = sheets[0];

  if (!open || !preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65" onClick={onClose} aria-hidden />

      <div className="relative flex max-h-[88vh] w-full max-w-5xl flex-col rounded-[var(--radius-lg)] border border-line bg-app shadow-panel">
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-success-soft text-success">
            <ExcelIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-ink">Ирцийн тайлан</p>
            <p className="text-[12px] text-subtle">
              {date} · {preview.body.length} мөр
            </p>
          </div>
          <Button
            variant="success"
            icon={<ExcelIcon size={15} />}
            onClick={() => downloadDailyExcel(date, rows)}
            disabled={!rows.length}
          >
            Excel татах
          </Button>
          <button
            onClick={onClose}
            className="focus-ring rounded-[var(--radius-sm)] p-2 text-muted hover:bg-hover hover:text-ink"
            aria-label="Хаах"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-5">
          {/* Нэгтгэл */}
          <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded-[var(--radius)] border border-line bg-card p-4 sm:grid-cols-3">
            {summary.rows.slice(1).map(([label, value]: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-muted">{label}</span>
                <span className="text-[13px] font-semibold text-ink">{String(value)}</span>
              </div>
            ))}
          </div>

          {/* Хүснэгт */}
          <p className="mb-2 text-[13px] font-semibold text-ink">{preview.sheetName}</p>
          {preview.body.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-subtle">
              Энэ өдөрт ирцийн бүртгэл алга.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-line">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="bg-card2 text-[11px] uppercase text-subtle">
                    {preview.header.map((h: string, i: number) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.body.map((r: any[], ri: number) => (
                    <tr key={ri} className="border-t border-line text-[13px] hover:bg-hover">
                      {r.map((cell, ci) => (
                        <td key={ci} className="whitespace-nowrap px-3 py-2 text-ink">
                          {cell === 0 ? '0' : String(cell ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
