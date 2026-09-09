import { useEffect, useState } from 'react';
import { Clock, Download, RefreshCw, Trash2, User } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { deleteSession, fetchSessionPayload, listSessions, type SessionRow } from '../../lib/history';
import type { RestorePayload } from '../../stores/appStore';
import { num } from '../../lib/format';

/**
 * Хадгалсан тооллогуудын жагсаалт.
 *
 * Мөр дээр дарахад бүрэн өгөгдлийг татаж, харьцуулалтыг дахин тооцоод
 * хүснэгтийг яг тэр байдлаар нь сэргээнэ.
 */
export function HistoryPanel({
  onClose,
  onOpen,
  onError,
}: {
  onClose: () => void;
  onOpen: (payload: RestorePayload) => void;
  onError: (message: string) => void;
}) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const refresh = () => {
    setRows(null);
    listSessions()
      .then(setRows)
      .catch((e: Error) => {
        setRows([]);
        onError(e.message);
      });
  };

  useEffect(refresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (row: SessionRow) => {
    setLoadingId(row.id);
    try {
      const payload = await fetchSessionPayload(row);
      onOpen({
        hasHeaderRow: payload.hasHeaderRow,
        config: payload.config,
        source: payload.source,
        reference: payload.reference,
      });
      onClose();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  };

  const remove = async (row: SessionRow) => {
    if (!confirm(`«${row.title}» тооллогыг устгах уу?`)) return;
    try {
      await deleteSession(row);
      setRows((r) => (r ? r.filter((x) => x.id !== row.id) : r));
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <Modal
      title="Тооллогын түүх"
      onClose={onClose}
      width={760}
      footer={
        <>
          <button className="ec-btn ec-btn-outline" onClick={refresh}>
            <RefreshCw size={14} /> Сэргээх
          </button>
          <button className="ec-btn ec-btn-primary" onClick={onClose}>
            Хаах
          </button>
        </>
      }
    >
      {rows === null ? (
        <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Ачаалж байна…
        </p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Одоогоор хадгалсан тооллого алга. Харьцуулалт хийгээд «Хадгалах» дарна уу.
        </p>
      ) : (
        <div className="ec-scroll max-h-[60vh] overflow-y-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="sticky top-0 z-10 border-b px-2 py-2 text-left" style={headCell}>
                  Тооллого
                </th>
                <th className="sticky top-0 z-10 border-b px-2 py-2 text-left" style={headCell}>
                  Огноо / Хэн
                </th>
                <th className="sticky top-0 z-10 border-b px-2 py-2 text-right" style={headCell}>
                  Мөр
                </th>
                <th className="sticky top-0 z-10 border-b px-2 py-2 text-right" style={headCell}>
                  Байхгүй
                </th>
                <th className="sticky top-0 z-10 border-b px-2 py-2" style={headCell} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const missing =
                  r.summary?.devcRef?.missing ??
                  r.summary?.serialRef?.missing ??
                  r.summary?.devc?.missing ??
                  r.summary?.serial?.missing ??
                  0;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--grid-line)' }}>
                    <td className="px-2 py-2 align-top">
                      <div className="truncate font-medium" style={{ color: 'var(--text)' }}>
                        {r.title}
                      </div>
                      <div className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {r.source_file} · {r.source_sheet} ↔ {r.ref_file || '—'} · {r.ref_sheet}
                      </div>
                      {r.note ? (
                        <div className="mt-0.5 whitespace-pre-line text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {r.note}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 align-top text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(r.created_at).toLocaleString('mn-MN')}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <User size={11} />
                        {r.user_email ?? '—'}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right align-top tabular-nums" style={{ color: 'var(--text)' }}>
                      {num(r.source_rows)}
                    </td>
                    <td
                      className="px-2 py-2 text-right align-top tabular-nums"
                      style={{ color: missing ? 'var(--missing-text)' : 'var(--text-muted)' }}
                    >
                      {num(missing)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                      <button
                        className="ec-btn"
                        onClick={() => void open(r)}
                        disabled={!r.detail_path || loadingId === r.id}
                        title={r.detail_path ? 'Нээх' : 'Бүрэн өгөгдөл хадгалагдаагүй'}
                      >
                        <Download size={13} />
                        {loadingId === r.id ? 'Нээж байна…' : 'Нээх'}
                      </button>
                      <button className="ec-btn ml-1 px-1.5" onClick={() => void remove(r)} title="Устгах">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

const headCell: React.CSSProperties = {
  background: 'var(--bg-chrome)',
  borderColor: 'var(--grid-line)',
  fontWeight: 500,
};
