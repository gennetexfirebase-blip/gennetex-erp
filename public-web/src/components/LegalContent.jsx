/**
 * Хууль зүйн хуудсуудын (Privacy, Terms) хуваалцсан блокууд.
 *
 * Сайтын одоо байгаа typography, spacing, card загварыг дагана —
 * шинэ өнгө, шинэ фонт нэвтрүүлэхгүй.
 */

/** Нэг бүлэг: дугаар + гарчиг + агуулга. */
export function LegalSection({ index, title, children }) {
  return (
    <section className="border-t border-graphite-800 py-8 first:border-t-0 first:pt-0">
      <h2 className="flex items-baseline gap-3 text-xl font-medium tracking-tight text-graphite-50 md:text-2xl">
        {index != null ? (
          <span className="text-sm font-bold tabular-nums text-graphite-500">
            {String(index).padStart(2, '0')}
          </span>
        ) : null}
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-graphite-400">{children}</div>
    </section>
  );
}

/** Цэгтэй жагсаалт. */
export function LegalList({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-graphite-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Онцлох мэдэгдэл — "нууц үг хадгалдаггүй" гэх мэт. */
export function LegalNote({ children }) {
  return (
    <div className="rounded-lg border border-graphite-800 bg-graphite-900/50 p-4 text-sm text-graphite-300">
      {children}
    </div>
  );
}

/** Хуудасны их бие — тогтмол өргөн, төвлөрсөн. */
export function LegalBody({ updatedAt, children }) {
  return (
    <div className="px-4 py-12 sm:px-6 md:px-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        {updatedAt ? (
          <p className="mb-8 text-xs uppercase tracking-[0.2em] text-graphite-500">
            Сүүлд шинэчилсэн: {updatedAt}
          </p>
        ) : null}
        {children}
        <p className="mt-12 border-t border-graphite-800 pt-6 text-sm text-graphite-500">
          © Gennetex. All rights reserved.
        </p>
      </div>
    </div>
  );
}
