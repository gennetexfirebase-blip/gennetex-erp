import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { KeyRound, LifeBuoy, ShieldCheck } from 'lucide-react';
import brandMark from '../assets/report-logo.png';
import { SITE_COPY, currentSite, siteTabTitle } from '../lib/sites';

/** Гарч ирэх хөдөлгөөний саатал — `.auth-rise` (index.css). */
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]" style={{ width: size, height: size }}>
      <img src={brandMark} alt="" width={size} height={size} className="h-full w-full scale-[1.2] object-contain" />
    </span>
  );
}

/**
 * Нэвтрэх дэлгэцийн нийтлэг бүрхүүл (Login, AdminGate).
 * Зүүн талд — бараан брэнд самбар (тухайн subdomain юу хийдэг, ажлын урсгал),
 * баруун талд — нэвтрэх хэсэг. Утсан дээр зөвхөн нэвтрэх хэсэг харагдана.
 */
export default function AuthShell({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  const site = currentSite();
  const copy = SITE_COPY[site.key];

  // Табын гарчиг index.html-ийнхээс солигдож анивчихгүй — нэг л утгатай байна.
  useEffect(() => {
    document.title = siteTabTitle(site.key);
  }, [site.key]);

  return (
    <div className="min-h-screen bg-app lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      {/* ── Брэнд самбар ─────────────────────────────────────────── */}
      <aside className="auth-panel relative m-3 hidden overflow-hidden rounded-[32px] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden="true" className="auth-dots pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="auth-float pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--auth-glow)] opacity-20 blur-3xl" />

        <header className="auth-rise relative flex items-center gap-3">
          <BrandMark />
          <p className="text-[15px] font-bold tracking-[0.08em]">GENNETEX</p>
        </header>

        <div className="relative max-w-xl py-12">
          <p className="auth-rise mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-semibold text-white/90 ring-1 ring-inset ring-white/15 backdrop-blur" style={delay(60)}>
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--auth-glow)] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--auth-glow)]" />
            </span>
            {site.title}
          </p>
          <h1 className="auth-rise text-[44px] font-bold leading-[1.06] tracking-[-0.035em] xl:text-[54px]" style={delay(120)}>
            {copy.headline}
          </h1>
          <p className="auth-rise mt-6 max-w-lg text-[16px] leading-7 text-white/70" style={delay(180)}>
            {copy.blurb}
          </p>

          {/* Ажлын урсгал — шугамаар холбогдсон алхмууд */}
          <ol className="auth-rise mt-12 grid gap-0" style={delay(260)} aria-label="Ажлын урсгал">
            {copy.flow.map((s, i) => (
              <li key={s} className="relative flex items-center gap-4 pb-5 last:pb-0">
                {i < copy.flow.length - 1 ? <span aria-hidden="true" className="absolute left-[17px] top-9 h-[calc(100%-28px)] w-px bg-gradient-to-b from-white/30 to-white/5" /> : null}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[13px] font-bold tabular-nums text-[var(--auth-glow)] ring-1 ring-inset ring-white/20">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] font-semibold text-white/90">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <ul className="auth-rise relative flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-white/60" style={delay(340)}>
          <li className="flex items-center gap-2">
            <KeyRound size={14} className="text-[var(--auth-glow)]" aria-hidden="true" /> Байгууллагын Google данс
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--auth-glow)]" aria-hidden="true" /> Нэвтрэлт бүр бүртгэгдэнэ
          </li>
        </ul>
      </aside>

      {/* ── Нэвтрэх хэсэг ─────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center gap-3 lg:hidden">
          <BrandMark size={40} />
          <p className="text-[14px] font-bold tracking-[0.06em] text-ink">GENNETEX</p>
        </header>

        <main className="flex flex-1 items-start justify-center pt-12 sm:pt-20 lg:items-center lg:pt-0">
          <section className="w-full max-w-[400px]">
            <p className="auth-rise inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-semibold text-brand lg:hidden">{site.title}</p>
            <h2 className="auth-rise mt-4 text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink lg:mt-0 lg:text-[34px]" style={delay(80)}>
              {title || 'Тавтай морил'}
            </h2>
            <p className="auth-rise mt-2 text-[15px] leading-6 text-muted" style={delay(140)}>
              {subtitle || 'Үргэлжлүүлэхийн тулд байгууллагын Google хаягаараа нэвтэрнэ үү.'}
            </p>

            <div className="auth-rise mt-8" style={delay(200)}>
              {children}
            </div>

            <div className="auth-rise mt-8 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle" style={delay(260)}>
              <span className="h-px flex-1 bg-line" />
              Аюулгүй байдал
              <span className="h-px flex-1 bg-line" />
            </div>
            <ul className="auth-rise mt-5 space-y-3 text-[13px] leading-5 text-muted" style={delay(300)}>
              <li className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <ShieldCheck size={14} aria-hidden="true" />
                </span>
                <span className="pt-1">Зөвхөн эрх олгогдсон ажилтан нэвтэрнэ. Нэвтрэлт бүр бүртгэгдэнэ.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card2 text-subtle">
                  <LifeBuoy size={14} aria-hidden="true" />
                </span>
                <span className="pt-1">Нэвтэрч чадахгүй байна уу? Системийн админтай холбогдоно уу.</span>
              </li>
            </ul>
          </section>
        </main>

        <footer className="pt-6 text-center text-[12px] text-muted">© {new Date().getFullYear()} GENNETEX ХХК</footer>
      </div>
    </div>
  );
}

/** Google-ээр нэвтрэх товч — Google-ийн брэндийн дүрмийн дагуу цагаан, хүрээтэй. */
export function GoogleButton({ onClick, busy, label = 'Google-ээр нэвтрэх', icon }: { onClick: () => void; busy?: boolean; label?: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="focus-ring group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-card text-[15px] font-semibold text-ink shadow-[var(--shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-[var(--shadow-pop)] active:translate-y-0 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
    >
      {/* Hover үед гэрэл гулсана */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-[var(--brand-soft)] to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100" />
      <span className="relative flex items-center gap-3">
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden="true" /> : icon}
        {busy ? 'Түр хүлээнэ үү…' : label}
      </span>
    </button>
  );
}
