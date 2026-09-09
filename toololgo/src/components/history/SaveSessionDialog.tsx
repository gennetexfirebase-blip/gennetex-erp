import { useState } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { saveSession } from '../../lib/history';
import type { ComparisonConfig, ComparisonResults, Dataset } from '../../types';

/** Одоогийн харьцуулалтыг нэр өгөөд Supabase рүү хадгална. */
export function SaveSessionDialog({
  source,
  reference,
  config,
  results,
  hasHeaderRow,
  onClose,
  onSaved,
  onError,
}: {
  source: Dataset;
  reference: Dataset | null;
  config: ComparisonConfig;
  results: ComparisonResults;
  hasHeaderRow: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const defaultTitle = `${source.fileName.replace(/\.(xlsx?|csv)$/i, '')} — ${new Date().toLocaleDateString('mn-MN')}`;
  const [title, setTitle] = useState(defaultTitle);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const submit = async () => {
    const name = title.trim();
    if (!name) {
      onError('Нэр оруулна уу.');
      return;
    }
    setBusy('Хадгалж байна…');
    try {
      await saveSession({
        title: name,
        note: note.trim() || undefined,
        hasHeaderRow,
        config,
        source,
        reference,
        results,
        onProgress: (_pct, label) => setBusy(label),
      });
      onSaved(`«${name}» хадгалагдлаа.`);
      onClose();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title="Тооллого хадгалах"
      subtitle="Дараа нь «Түүх» цэснээс нээж, яг энэ байдлаар нь харна."
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="ec-btn ec-btn-outline" onClick={onClose} disabled={!!busy}>
            Цуцлах
          </button>
          <button className="ec-btn ec-btn-primary" onClick={() => void submit()} disabled={!!busy}>
            <Save size={14} /> {busy ?? 'Хадгалах'}
          </button>
        </>
      }
    >
      <label className="block text-[12px]" style={{ color: 'var(--text-muted)' }}>
        Нэр
      </label>
      <input
        className="ec-input mt-1 h-9 w-full px-2 text-[13px]"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        disabled={!!busy}
      />

      <label className="mt-4 block text-[12px]" style={{ color: 'var(--text-muted)' }}>
        Тэмдэглэл (сонголтоор)
      </label>
      <textarea
        className="ec-input mt-1 w-full px-2 py-1.5 text-[13px]"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={!!busy}
      />

      <p className="mt-4 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Хоёр хуудасны бүх мөр шахагдан хадгалагдана. Дүн (байна / байхгүй / давхардал)
        жагсаалтад шууд харагдана.
      </p>
    </Modal>
  );
}
