import { useEffect } from 'react';
import brandMark from '../assets/report-logo.png';
import { dayOf, keyPoints, sigSrc, timeOf, versionLabel, type HaabAck, type HaabSheet as Sheet } from '../lib/haab';

/**
 * ХААБ гарын үсгийн хуудас — дэлгэц, хэвлэх (A4 хэвтээ), нийтийн холбоосонд ижил.
 * Зүүн талд гарын үсгийн хүснэгт, баруун талд зааврын гол заалтууд.
 * Үргэлж цагаан «цаас» (шөнийн горимоос үл хамаарна) — `.print-sheet` (index.css).
 */
export default function HaabSheet({ sheet, onZoom }: { sheet: Sheet; onZoom?: (a: HaabAck) => void }) {
  const points = keyPoints(sheet.instruction.body);
  // Хэвлэхэд зөвхөн энэ хуудас гарна (index.css → html.has-print-sheet).
  useEffect(() => {
    document.documentElement.classList.add('has-print-sheet');
    return () => document.documentElement.classList.remove('has-print-sheet');
  }, []);
  const pct = sheet.total ? Math.round((Math.min(sheet.acks.length, sheet.total) / sheet.total) * 100) : 0;

  return (
    <article className="print-sheet overflow-hidden rounded-[var(--radius-lg)] border border-[#d9e1dd] bg-white text-[#16201c]">
      <header className="flex flex-wrap items-center gap-4 border-b border-[#e3e9e6] px-6 py-5">
        <img src={brandMark} alt="" width="40" height="40" className="h-10 w-10 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6d67]">GENNETEX ХХК · Хөдөлмөрийн аюулгүй байдал</p>
          <h2 className="text-[18px] font-bold leading-tight !text-[#16201c]">ХААБ зааврын танилцуулгын гарын үсгийн хуудас</h2>
        </div>
        <dl className="grid grid-cols-3 gap-5 text-right text-[12px]">
          <div><dt className="text-[#5f6d67]">Огноо</dt><dd className="font-semibold tabular-nums">{sheet.date}</dd></div>
          <div><dt className="text-[#5f6d67]">Зурсан</dt><dd className="font-semibold tabular-nums">{sheet.acks.length} / {sheet.total}</dd></div>
          <div><dt className="text-[#5f6d67]">Хамрагдалт</dt><dd className="font-semibold tabular-nums">{pct}%</dd></div>
        </dl>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] print:grid-cols-[minmax(0,1fr)_230px]">
        {/* ── Гарын үсгийн хүснэгт ─────────────────────── */}
        <div className="min-w-0 overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[640px] border-collapse text-[13px] print:min-w-0 print:text-[11px]">
            <thead>
              <tr className="bg-[#eef3f0] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#45534d]">
                <th className="w-10 px-3 py-2 text-center">№</th>
                <th className="px-3 py-2">Ажилтан</th>
                <th className="px-3 py-2">Хэлтэс</th>
                <th className="px-3 py-2">Цаг</th>
                <th className="px-3 py-2">Заавар</th>
                <th className="px-3 py-2 text-center">Гарын үсэг</th>
              </tr>
            </thead>
            <tbody>
              {!sheet.acks.length ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-[#5f6d67]">Энэ өдөр гарын үсэг зурсан ажилтан алга.</td></tr>
              ) : (
                sheet.acks.map((a, i) => {
                  const src = sigSrc(a);
                  const version = versionLabel(a, sheet.instruction);
                  return (
                    <tr key={a.id} className="break-inside-avoid border-t border-[#e3e9e6] align-middle">
                      <td className="px-3 py-2 text-center tabular-nums text-[#5f6d67]">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold">{a.name}</td>
                      <td className="px-3 py-2 text-[#45534d]">{a.department || '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{timeOf(a.signed_at)}</td>
                      <td className="px-3 py-2">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${version === 'Одоогийн' ? 'bg-[#e0f5ea] text-[#0f8150]' : 'bg-[#fff1d6] text-[#9a5800]'}`}>{version}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        {src ? (
                          <button
                            type="button"
                            disabled={!onZoom}
                            onClick={() => onZoom?.(a)}
                            className="mx-auto block h-12 w-36 rounded border border-[#e3e9e6] bg-white p-1 enabled:hover:border-[#0c8a62] print:h-10 print:w-32 print:border-0"
                            aria-label={`${a.name} — гарын үсэг`}
                          >
                            <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
                          </button>
                        ) : (
                          <span className="block text-center text-[12px] text-[#888]">Зураг алга</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Зааврын гол заалтууд ─────────────────────── */}
        <aside className="border-t border-[#e3e9e6] bg-[#f7faf8] px-5 py-5 lg:border-l lg:border-t-0 print:border-l print:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6d67]">Гарын үсэг зурсан заавар</p>
          <h3 className="mt-1 text-[15px] font-bold leading-snug !text-[#16201c]">{sheet.instruction.title}</h3>
          {sheet.instruction.updated_at ? <p className="mt-0.5 text-[11px] text-[#5f6d67]">Хувилбар: {dayOf(sheet.instruction.updated_at)}</p> : null}
          <p className="mt-4 text-[12px] font-semibold text-[#45534d]">Гол заалтууд</p>
          {points.length ? (
            <ol className="mt-2 space-y-2 text-[13px] leading-5 print:text-[10.5px] print:leading-[1.35]">
              {points.map((p, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0c8a62] text-[10px] font-bold text-white">{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[12px] text-[#888]">Зааврын текст хоосон байна.</p>
          )}
          <p className="mt-5 border-t border-[#e3e9e6] pt-3 text-[11px] leading-4 text-[#5f6d67]">
            Дээрх ажилтнууд энэхүү зааврыг Gennetex апп дээр бүрэн уншиж танилцаад утсан дээрээ гарын үсгээр баталгаажуулсан.
          </p>
        </aside>
      </div>
    </article>
  );
}
