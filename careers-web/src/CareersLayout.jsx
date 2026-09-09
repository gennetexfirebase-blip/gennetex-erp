import { Outlet } from 'react-router-dom';
import { useSiteContent, } from '../../public-web/src/context/SiteContentContext';
import { formatCopyright } from '../../public-web/src/lib/siteContent';

/**
 * Энгийн хүрээ — үндсэн сайтын олон цэст навигацийн оронд зөвхөн
 * буцах холбоос. Зочин анкет бөглөх ажилдаа төвлөрнө.
 */
export default function CareersLayout() {
  const { navbar, footer } = useSiteContent();

  return (
    <div className="min-h-screen bg-bg-base text-zinc-900">
      <a href="#main-content" className="public-skip">
        Үндсэн агуулга руу очих
      </a>

      <nav
        aria-label="Үндсэн цэс"
        className="fixed left-0 top-0 z-50 w-full bg-gradient-to-b from-[#f1f1f1]/80 to-transparent py-6 backdrop-blur-[2px] md:py-8"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 md:px-10 lg:px-16">
          <a href="https://gennetex.com" className="flex items-center gap-2">
            <img src="/logo.png" alt={navbar.brand} className="h-7 w-auto" />
            <span className="font-display text-lg font-medium tracking-tight text-ink md:text-xl">
              {navbar.brand}
            </span>
          </a>
          <a
            href="https://gennetex.com"
            className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[13px] text-ink backdrop-blur transition-colors hover:bg-white"
          >
            ← Үндсэн сайт
          </a>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="border-t border-graphite-800 px-6 py-8 md:px-10 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm text-zinc-500 sm:flex-row">
          <span>{footer.brand}</span>
          <span>{formatCopyright(footer.copyright)}</span>
        </div>
      </footer>
    </div>
  );
}
