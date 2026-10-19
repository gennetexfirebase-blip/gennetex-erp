import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { KeyRound, LifeBuoy, ShieldCheck } from 'lucide-react';
import brandMark from '../assets/report-logo.png';
// Зураг: Taylor Vick / Unsplash (Unsplash License).
import loginPhoto from '../assets/login-network.jpg';
import { SITE_COPY, currentSite, siteTabTitle } from '../lib/sites';
import { ThemeToggle } from './ThemeToggle';

/** Гарч ирэх хөдөлгөөний саатал — `.auth-rise` (index.css). */
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]" style={{ width: size, height: size }}>
      <img src={brandMark} alt="" width={size} height={size} className="h-full w-full scale-[1.2] object-contain" />
    </span>
  );
}

/** Улаанбаатарын цаг — минут тутам шинэчлэгдэнэ. */
function useUbTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ulaanbaatar', hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric', weekday: 'short', hour12: false })
      .formatToParts(now)
      .map((x) => [x.type, x.value])
  );
  const wd: Record<string, string> = { Mon: 'Даваа', Tue: 'Мягмар', Wed: 'Лхагва', Thu: 'Пүрэв', Fri: 'Баасан', Sat: 'Бямба', Sun: 'Ням' };
  return { time: `${p.hour}:${p.minute}`, date: `${p.month}-р сарын ${p.day}, ${wd[p.weekday] || ''}` };
}

/**
 * Нэвтрэх дэлгэцийн нийтлэг бүрхүүл (Login, AdminGate).
 * Зүүн талд — бараан брэнд самбар (тухайн subdomain юу хийдэг, ажлын урсгал),
 * баруун талд — нэвтрэх хэсэг. Утсан дээр зөвхөн нэвтрэх хэсэг харагдана.
 */
export default function AuthShell({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  const site = currentSite();
  const copy = SITE_COPY[site.key];
  const ub = useUbTime();

  // Табын гарчиг index.html-ийнхээс солигдож анивчихгүй — нэг л утгатай байна.
  useEffect(() => {
    document.title = siteTabTitle(site.key);
  }, [site.key]);

  return (
    <div className="min-h-screen bg-app lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      {/* ── Брэнд самбар ─────────────────────────────────────────── */}
      <aside className="auth-panel relative m-3 hidden overflow-hidden rounded-[32px] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Сүлжээний шүүгээний зураг — удаан томорно; доор нь бичиг уншигдахаар бараан бүрхүүл */}
        <img src={loginPhoto} alt="" aria-hidden="true" className="auth-photo pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden="true" className="auth-shade pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="auth-scan pointer-events-none absolute inset-0" />

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
              <li key={s} className="auth-step relative flex items-center gap-4 pb-5 last:pb-0" style={{ '--i': i, '--n': copy.flow.length } as CSSProperties}>
                {i < copy.flow.length - 1 ? <span aria-hidden="true" className="absolute left-[17px] top-9 h-[calc(100%-28px)] w-px bg-gradient-to-b from-white/30 to-white/5" /> : null}
                <span className="auth-step-dot grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[13px] font-bold tabular-nums text-[var(--auth-glow)] ring-1 ring-inset ring-white/20">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] font-semibold text-white/90">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="auth-rise relative flex flex-wrap items-end justify-between gap-6" style={delay(340)}>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-white/60">
          <li className="flex items-center gap-2">
            <KeyRound size={14} className="text-[var(--auth-glow)]" aria-hidden="true" /> Байгууллагын дотоод аккаунт
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--auth-glow)]" aria-hidden="true" /> Дата бүр үнэ цэнэтэй
          </li>
        </ul>
        {/* Бодит цаг — тунгалаг карт */}
        <div className="rounded-2xl bg-white/[0.07] px-5 py-3.5 ring-1 ring-inset ring-white/15 backdrop-blur-md">
          <p className="text-[28px] font-bold leading-none tabular-nums tracking-[-0.02em]">{ub.time}</p>
          <p className="mt-1.5 text-[12px] text-white/60">Улаанбаатар · {ub.date}</p>
        </div>
        </div>
      </aside>

      {/* ── Нэвтрэх хэсэг ─────────────────────────────────────────── */}
      <div className="relative flex min-h-screen flex-col overflow-hidden px-5 py-6 sm:px-10">
        {/* Картын ард маш бүдэг брэнд гэрэл — хар дэвсгэр хоосон харагдахгүй */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--auth-glow)] opacity-[0.07] blur-[120px]" />
        <header className="relative flex items-center gap-3">
          <ThemeToggle className="ml-auto" />
        </header>

        <main className="relative flex flex-1 items-start justify-center pt-10 sm:pt-16 lg:items-center lg:pt-0">
          <section className="w-full max-w-[440px]">
            <div className="auth-rise rounded-[24px] border border-line bg-card/90 p-7 shadow-[var(--shadow-pop)] backdrop-blur-xl sm:p-10">
              <div className="flex items-center gap-3">
                <BrandMark size={40} />
                <div className="min-w-0 leading-tight">
                  <p className="text-[14px] font-bold tracking-[0.06em] text-ink">GENNETEX</p>
                  <p className="truncate text-[12px] text-subtle">{site.host}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand">{site.title}</span>
              </div>

              <h2 className="mt-9 text-[32px] font-bold leading-tight tracking-[-0.03em] text-ink" style={delay(80)}>
                {title || 'Тавтай морил'}
              </h2>
              <p className="mt-2 text-[14px] leading-6 text-muted">
                {subtitle || 'Үргэлжлүүлэхийн тулд байгууллагын Google хаягаараа нэвтэрнэ үү.'}
              </p>

              <div className="mt-7">{children}</div>

              <ul className="mt-7 space-y-3 border-t border-line pt-6 text-[13px] leading-5 text-muted">
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
            </div>

            <div className="auth-rise mt-5 flex items-center justify-between gap-3 px-1 text-[12px] text-subtle" style={delay(200)}>
              <span className="inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Систем хэвийн ажиллаж байна
              </span>
              <span className="tabular-nums lg:hidden">{ub.time}</span>
            </div>
          </section>
        </main>

        <footer className="relative pt-6 text-center text-[12px] text-muted">© {new Date().getFullYear()} GENNETEX ХХК</footer>
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
      className="focus-ring flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#dadce0] bg-white text-[15px] font-semibold text-[#1f1f1f] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#f7f8f8] hover:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)] active:translate-y-px disabled:cursor-wait disabled:opacity-70"
    >
      <span className="flex items-center gap-3">
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#dadce0] border-t-[#0d7a55]" aria-hidden="true" /> : icon}
        {busy ? 'Түр хүлээнэ үү…' : label}
      </span>
    </button>
  );
}
