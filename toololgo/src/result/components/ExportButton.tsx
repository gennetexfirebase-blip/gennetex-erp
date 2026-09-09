import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { Row } from '../lib';

interface Props {
  rows: Row[];
  columns: string[];
  fileName: string;
  label?: string;
}

/** Зөвхөн дамжуулсан мөрүүдийг бүх original багануудтай нь .xlsx болгож татна. */
export function ExportButton({ rows, columns, fileName, label }: Props) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!rows.length) return;
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const aoa = [columns, ...rows.map((row) => columns.map((c) => row[c] ?? ''))];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = columns.map((c) => ({ wch: Math.min(30, Math.max(10, c.length + 3)) }));
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BAIHGUI');
      XLSX.writeFile(wb, fileName);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={busy || !rows.length}
      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      title={`${rows.length} мөр татна`}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {label ?? 'БАЙХГҮЙ мөрүүдийг Excel татах'}
      <span className="rounded bg-white/20 px-1.5 text-xs tabular-nums">{rows.length}</span>
    </button>
  );
}
