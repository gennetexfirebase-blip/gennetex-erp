import { useEffect, useMemo, useState } from 'react';
import { fmtDate, type TrEmployee, type TrModel } from '../lib/timeReport';

type ExportMod = typeof import('../lib/timeReportExport');

const DownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/**
 * PDF / Excel-ийг татахаас өмнө вэб дээр урьдчилан харуулна.
 * Харагдаж буй баримт, мөрүүд нь татах файлтай ЯГ ИЖИЛ эх сурвалжаас
 * (`buildPdf`, `excelSheets`) гардаг тул зөрөхгүй.
 */
export default function ExportPreview({
  m,
  emps,
  kind,
  employee,
  onKind,
  onClose,
}: {
  m: TrModel;
  emps: TrEmployee[];
  kind: 'pdf' | 'xlsx';
  employee?: TrEmployee;
  onKind: (k: 'pdf' | 'xlsx') => void;
  onClose: () => void;
}) {
  const [mod, setMod] = useState<ExportMod | null>(null);
  const [pdf, setPdf] = useState<{ url: string; filename: string } | null>(null);
  const [sheet, setSheet] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => (employee ? [employee] : emps), [employee, emps]);

  useEffect(() => {
    let alive = true;
    import('../lib/timeReportExport')
      .then((x) => alive && setMod(x))
      .catch((e) => alive && setError(`Модуль ачаалж чадсангүй: ${e?.message || e}. Хуудсаа шинэчилнэ үү.`));
    return () => {
      alive = false;
    };
  }, []);

  // PDF-ийг blob болгож iframe-д харуулна.
  useEffect(() => {
    if (!mod || kind !== 'pdf') return;
    let alive = true;
    let url = '';
    setPdf(null);
    const { doc, filename } = mod.buildPdf(m, list, employee);
    mod
      .pdfBlob(doc)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setPdf({ url, filename });
      })
      .catch((e) => alive && setError(`PDF үүсгэж чадсангүй: ${e?.message || e}`));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mod, kind, m, list, employee]);

  const sheets = useMemo(() => (mod && kind === 'xlsx' ? mod.excelSheets(m, list) : []), [mod, kind, m, list]);
  const cur = sheets[Math.min(sheet, sheets.length - 1)];
  const LIMIT = 300;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const download = async () => {
    if (!mod) return;
    setBusy(true);
    try {
      if (kind === 'pdf' && pdf) {
        const a = document.createElement('a');
        a.href = pdf.url;
        a.download = pdf.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (kind === 'xlsx') {
        await mod.downloadSheets(sheets, mod.excelFilename(m, list));
      }
    } catch (e: any) {
      setError(`Татаж чадсангүй: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tr-modal" role="dialog" aria-modal="true" aria-label="Урьдчилан харах">
      <div className="tr-modal-bg" onClick={onClose} />
      <div className="tr-modal-box">
        <div className="tr-modal-h">
          <div className="seg sm" role="group" aria-label="Төрөл">
            <button aria-pressed={kind === 'pdf'} onClick={() => onKind('pdf')}>PDF</button>
            <button aria-pressed={kind === 'xlsx'} onClick={() => onKind('xlsx')}>Excel</button>
          </div>
          <div className="tt">
            <b>{employee ? `${employee.name} — ирцийн тайлан` : 'Цагийн тайлан'}</b>
            <span>
              {fmtDate(m.from)} – {fmtDate(m.to)}
              {employee ? '' : `, ${list.length} ажилтан`}
            </span>
          </div>
          <div className="acts">
            {kind === 'pdf' && pdf ? (
              <a className="btn" href={pdf.url} target="_blank" rel="noreferrer">Томоор нээх</a>
            ) : null}
            <button className="btn solid" onClick={download} disabled={busy || !mod || (kind === 'pdf' && !pdf)}>
              <DownIcon />
              {busy ? 'Татаж байна…' : kind === 'pdf' ? 'PDF татах' : 'Excel татах'}
            </button>
            <button className="icon" onClick={onClose} aria-label="Хаах"><CloseIcon /></button>
          </div>
        </div>
        <div className="tr-modal-b">
          {error ? (
            <div className="banner">{error}</div>
          ) : !mod || (kind === 'pdf' && !pdf) ? (
            <div className="empty">Бэлтгэж байна…</div>
          ) : kind === 'pdf' ? (
            <>
              <iframe title="PDF урьдчилан харах" src={`${pdf!.url}#view=FitH`} className="tr-pdf" />
              <p className="tr-pdf-hint">Утсан дээр харагдахгүй бол «Томоор нээх» дарна уу.</p>
            </>
          ) : (
            <>
              <div className="seg sm sheets" role="tablist">
                {sheets.map((s, i) => (
                  <button key={s.name} aria-pressed={i === sheet} onClick={() => setSheet(i)}>
                    {s.name} <small>{s.rows.length - 1}</small>
                  </button>
                ))}
              </div>
              {cur ? (
                <div className="xl-wrap">
                  <table className="xl">
                    <thead>
                      <tr>
                        <th className="rn" />
                        {cur.rows[0].map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cur.rows.slice(1, LIMIT + 1).map((r, ri) => (
                        <tr key={ri}>
                          <td className="rn">{ri + 2}</td>
                          {r.map((v, ci) => (
                            <td key={ci} className={typeof v === 'number' ? 'num' : ''}>
                              {String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {cur.rows.length - 1 > LIMIT ? (
                    <div className="empty">Эхний {LIMIT} мөрийг харуулав. Нийт {cur.rows.length - 1} мөр Excel файлд бүрэн орно.</div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
