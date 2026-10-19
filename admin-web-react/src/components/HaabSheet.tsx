import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import brandMark from '../assets/report-logo.png';
import { boldSigSrc, dayOf, isRange, keyPoints, periodLabel, sigSrc, timeOf, type HaabAck, type HaabSheet as Sheet } from '../lib/haab';

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
  return src ? <img src={src} alt="" className={`sig-img object-contain ${className}`} /> : null;
}

/** A4 босоо, зах 8мм/12мм (index.css @page haab) — хэвлэх талбайн өндөр (px, 96dpi). Өргөн 190мм. */
const PAGE_H = (297 - 8 - 12) * (96 / 25.4);

/**
 * ХААБ гарын үсгийн хуудас — дэлгэц, хэвлэх (A4 босоо), нийтийн холбоосонд ижил.
 * Мөр бүрт: №, ажилтан (хэлтэс), цаг, зааврын заалтууд, гарын үсэг.
 * Хэвлэхэд body-д тусдаа хуулбар (portal) гаргаж, бусдыг display:none болгоно —
 * нуугдсан хэсгүүд зай эзэлж хоосон хуудас нэмэхгүй (index.css).
 */
export default function HaabSheet({ sheet, onZoom, onPages }: { sheet: Sheet; onZoom?: (a: HaabAck) => void; onPages?: (n: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const printRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('has-print-sheet');
    return () => document.documentElement.classList.remove('has-print-sheet');
  }, []);

  // Хэвлэхэд хэдэн хуудас болохыг хэвлэх хуулбарын (дэлгэцээс гадуур, 190мм өргөн) өндрөөр тооцно.
  useLayoutEffect(() => {
    const el = printRef.current;
    if (!onPages || !el) return;
    const measure = () => onPages(Math.max(1, Math.ceil(el.offsetHeight / PAGE_H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onPages, sheet]);

  return (
    <>
      <SheetBody sheet={sheet} onZoom={onZoom} innerRef={ref} />
      {createPortal(
        <div className="print-portal">
          <SheetBody sheet={sheet} innerRef={printRef} />
        </div>,
        document.body
      )}
    </>
  );
}

function SheetBody({ sheet, onZoom, innerRef }: { sheet: Sheet; onZoom?: (a: HaabAck) => void; innerRef?: React.Ref<HTMLElement> }) {
  const points = keyPoints(sheet.instruction.body, 12);
  const multi = isRange(sheet);
  const cell = 'border border-line px-1.5 py-1.5';
  return (
    <article ref={innerRef} className="print-sheet mx-auto w-full max-w-[190mm] rounded-[var(--radius-sm)] border border-line bg-card px-5 pb-6 pt-5 text-ink">
      {/* Албан бичгийн толгой */}
      <div className="flex items-start justify-between gap-4 text-[10px] text-muted">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded bg-white p-0.5">
            <img src={brandMark} alt="" width="32" height="32" className="h-full w-full object-contain" />
          </span>
          <div className="leading-tight">
            <p className="font-bold text-ink">«ЖЕННЕТЕКС» ХХК</p>
            <p>Хөдөлмөрийн аюулгүй байдал, эрүүл ахуй</p>
          </div>
        </div>
        <div className="text-right leading-tight">
          <p>{multi ? 'Хугацаа' : 'Огноо'}: <b className="tabular-nums text-ink">{periodLabel(sheet)}</b></p>
          <p>Улаанбаатар хот</p>
        </div>
      </div>

      <h2 className="mt-4 text-center text-[13px] font-bold uppercase tracking-[0.04em]">ХААБ-ын зааварчилгаатай танилцсан тухай гарын үсгийн хуудас</h2>
      <p className="mt-1 text-center text-[11px] text-muted">
        Заавар: <b className="text-ink">{sheet.instruction.title}</b> · {multi ? <>Гарын үсэг: <b className="tabular-nums text-ink">{sheet.acks.length}</b></> : <>Танилцсан: <b className="tabular-nums text-ink">{sheet.acks.length}</b> / {sheet.total} ажилтан</>}
      </p>

      <table className="mt-3 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-card2 text-center text-[9.5px] font-bold uppercase tracking-[0.02em] text-ink">
            <th className={`${cell} w-7`}>№</th>
            <th className={`${cell} w-[25%]`}>Овог, нэр</th>
            <th className={`${cell} ${multi ? 'w-[4.6rem]' : 'w-11'}`}>{multi ? 'Огноо' : 'Цаг'}</th>
            <th className={cell}>Зааврын гол заалт</th>
            <th className={`${cell} w-28`}>Гарын үсэг</th>
          </tr>
        </thead>
        <tbody>
          {!sheet.acks.length ? (
            <tr><td colSpan={5} className={`${cell} py-10 text-center text-subtle`}>{multi ? 'Энэ хугацаанд' : 'Энэ өдөр'} гарын үсэг зурсан ажилтан алга.</td></tr>
          ) : (
            sheet.acks.map((a, i) => (
              <tr key={a.id} className="break-inside-avoid align-middle">
                <td className={`${cell} text-center tabular-nums`}>{i + 1}</td>
                <td className={cell}>
                  <span className="block font-semibold leading-tight">{a.name}</span>
                  {a.department ? <span className="block text-[9px] leading-tight text-subtle">{a.department}</span> : null}
                </td>
                <td className={`${cell} text-center tabular-nums`}>
                  {multi ? <span className="block leading-tight">{a.ack_date || dayOf(a.signed_at)}</span> : null}
                  <span className={multi ? 'block text-[9px] leading-tight text-subtle' : ''}>{timeOf(a.signed_at)}</span>
                </td>
                <td className={cell}>
                  {points.length ? (
                    <ol className="space-y-0.5 text-[9px] leading-[1.3] text-muted">
                      {points.map((p, n) => (
                        <li key={n} className="flex gap-1">
                          <span className="shrink-0 font-bold tabular-nums">{n + 1}.</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
                <td className={`${cell} !py-0.5`}>
                  {sigSrc(a) ? (
                    <button
                      type="button"
                      disabled={!onZoom}
                      onClick={() => onZoom?.(a)}
                      className="mx-auto block h-11 w-28 rounded p-0.5 enabled:hover:bg-hover"
                      aria-label={`${a.name} — гарын үсэг`}
                    >
                      <SigImg ack={a} className="h-full w-full" />
                    </button>
                  ) : (
                    <span className="block text-center text-subtle">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Хариуцсан хүмүүсийн гарын үсгийн мөр */}
      <div className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
        {['Зааварчилгаа өгсөн', 'Хянасан'].map((r) => (
          <p key={r} className="flex items-end gap-2 whitespace-nowrap">
            <span>{r}:</span>
            <span className="mb-0.5 flex-1 border-b border-dotted border-[var(--text-subtle)]" />
            <span className="text-subtle">/</span>
            <span className="mb-0.5 w-20 border-b border-dotted border-[var(--text-subtle)]" />
            <span className="text-subtle">/</span>
          </p>
        ))}
      </div>
    </article>
  );
}
