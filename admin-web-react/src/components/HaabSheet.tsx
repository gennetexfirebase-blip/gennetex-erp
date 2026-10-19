import { useEffect, useState } from 'react';
import brandMark from '../assets/report-logo.png';
import { boldSigSrc, keyPoints, sigSrc, timeOf, type HaabAck, type HaabSheet as Sheet } from '../lib/haab';

/** Тодруулсан гарын үсэг (зураас зузаан, бараан). */
export function SigImg({ ack, className = '' }: { ack: HaabAck | Pick<HaabAck, 'signature_url' | 'signed_at'>; className?: string }) {
  const [src, setSrc] = useState(() => sigSrc(ack));
  useEffect(() => {
    let live = true;
    void boldSigSrc(ack).then((s) => live && s && setSrc(s));
    return () => {
      live = false;
    };
  }, [ack.signature_url, ack.signed_at]); // eslint-disable-line react-hooks/exhaustive-deps
  return src ? <img src={src} alt="" loading="lazy" className={`sig-img object-contain ${className}`} /> : null;
}

/**
 * ХААБ гарын үсгийн хуудас — дэлгэц, хэвлэх (A4 босоо), нийтийн холбоосонд ижил.
 * Хүснэгт: №, ажилтан (хэлтэс), цаг, заавар (заалтууд — бүх мөрийг хамарсан нэг нүд), гарын үсэг.
 * Дэлгэцэн дээр сонгосон горимыг (шөнө/өдөр) дагана; хэвлэхэд цагаан цаас (index.css).
 */
export default function HaabSheet({ sheet, onZoom }: { sheet: Sheet; onZoom?: (a: HaabAck) => void }) {
  const points = keyPoints(sheet.instruction.body, 12);

  // Хэвлэхэд зөвхөн энэ хуудас гарна (index.css → html.has-print-sheet).
  useEffect(() => {
    document.documentElement.classList.add('has-print-sheet');
    return () => document.documentElement.classList.remove('has-print-sheet');
  }, []);

  return (
    <article className="print-sheet mx-auto w-full max-w-[210mm] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-card text-ink">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-sm)] bg-white p-0.5">
          <img src={brandMark} alt="" width="40" height="40" className="h-full w-full object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">GENNETEX ХХК · Хөдөлмөрийн аюулгүй байдал</p>
          <h2 className="text-[15px] font-bold leading-tight">ХААБ зааврын танилцуулгын гарын үсэг</h2>
        </div>
        <dl className="flex gap-4 text-right text-[11px]">
          <div><dt className="text-subtle">Огноо</dt><dd className="font-semibold tabular-nums">{sheet.date}</dd></div>
          <div><dt className="text-subtle">Зурсан</dt><dd className="font-semibold tabular-nums">{sheet.acks.length} / {sheet.total}</dd></div>
        </dl>
      </header>

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-card2 text-left text-[10px] font-semibold uppercase tracking-[0.04em] text-muted">
            <th className="w-8 px-2 py-2 text-center">№</th>
            <th className="px-2 py-2">Ажилтан</th>
            <th className="w-12 px-2 py-2">Цаг</th>
            <th className="w-[38%] px-2 py-2">Заавар — {sheet.instruction.title}</th>
            <th className="w-32 px-2 py-2 text-center">Гарын үсэг</th>
          </tr>
        </thead>
        <tbody>
          {!sheet.acks.length ? (
            <tr><td colSpan={5} className="px-3 py-10 text-center text-subtle">Энэ өдөр гарын үсэг зурсан ажилтан алга.</td></tr>
          ) : (
            sheet.acks.map((a, i) => {
              const src = sigSrc(a);
              return (
                <tr key={a.id} className="break-inside-avoid border-t border-line align-middle">
                  <td className="px-2 py-1.5 text-center tabular-nums text-subtle">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <span className="block font-semibold leading-tight">{a.name}</span>
                    {a.department ? <span className="block text-[10px] leading-tight text-subtle">{a.department}</span> : null}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{timeOf(a.signed_at)}</td>
                  {i === 0 ? (
                    <td rowSpan={sheet.acks.length} className="border-l border-r border-line px-3 py-2 align-top">
                      {points.length ? (
                        <ol className="space-y-1.5 text-[11px] leading-[1.35]">
                          {points.map((p, n) => (
                            <li key={n} className="flex gap-1.5">
                              <span className="w-4 shrink-0 font-bold tabular-nums text-brand">{n + 1}.</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <span className="text-subtle">Зааврын текст хоосон.</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-2 py-1">
                    {src ? (
                      <button
                        type="button"
                        disabled={!onZoom}
                        onClick={() => onZoom?.(a)}
                        className="mx-auto block h-10 w-28 rounded p-0.5 enabled:hover:bg-hover"
                        aria-label={`${a.name} — гарын үсэг`}
                      >
                        <SigImg ack={a} className="h-full w-full" />
                      </button>
                    ) : (
                      <span className="block text-center text-[11px] text-subtle">—</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </article>
  );
}
