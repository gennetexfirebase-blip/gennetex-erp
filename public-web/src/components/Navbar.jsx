import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useSiteContent } from '../context/SiteContentContext';
import { COMPANY_COPY } from '../data/companyProfile';

/**
 * Тогтмол (fixed) шилэн навигаци.
 *
 * 12 баганын сүлжээ: 1–3 брэнд · 4–9 цэс · 10–12 үйлдэл.
 * Дээрээс доош бүдгэрэх градиент + backdrop-blur нь хуудасны #EDEEF5
 * суурьтай уусан, гүйлгэх үед агуулга доогуур нь зөөлөн өнгөрнө.
 */

/** Геометр цэцэг — брэндийн тэмдэг. */
function CloverMark({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#1a1a1a" aria-hidden="true">
      <path d="M12 2c1.9 0 3.4 1.5 3.4 3.4 0 .9-.3 1.6-.9 2.2.6-.6 1.4-.9 2.2-.9C18.5 6.7 20 8.2 20 10.1s-1.5 3.4-3.4 3.4c-.8 0-1.6-.3-2.2-.9.6.6.9 1.4.9 2.2 0 1.9-1.5 3.4-3.4 3.4s-3.4-1.5-3.4-3.4c0-.8.3-1.6.9-2.2-.6.6-1.4.9-2.2.9C5.5 13.5 4 12 4 10.1s1.5-3.4 3.4-3.4c.8 0 1.6.3 2.2.9-.6-.6-.9-1.3-.9-2.2C8.6 3.5 10.1 2 12 2Z" />
      <circle cx="12" cy="21" r="1.6" />
    </svg>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname, hash } = useLocation();
  const { navbar, language, setLanguage } = useSiteContent();
  const isEn = language === 'en';
  const sectionIds = ['introduction', 'values', 'activities', 'experience', 'partners', 'projects', 'contact'];
  const links = COMPANY_COPY[language].nav.map((label, index) => ({ label, to: `/#${sectionIds[index]}` }));
  const menuButton = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <nav
      aria-label={isEn ? 'Main navigation' : 'Үндсэн цэс'}
      className="fixed left-0 top-0 z-50 w-full border-b border-black/5 bg-[#f5f6f8]/95 py-4 backdrop-blur-xl"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-12 items-center gap-x-2 gap-y-4 px-4 md:px-10 lg:px-16">
        {/* 1–3 · брэнд */}
        <div className="col-span-6 flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <CloverMark className="h-6 w-6 md:h-7 md:w-7" />
            <span className="font-display text-lg font-medium tracking-tight text-ink md:text-xl">
              {navbar.brand}
            </span>
          </Link>
        </div>

        {/* 4–9 · цэс (зөвхөн дэлгэц дээр) */}
        <div className="order-3 col-span-12 hidden items-center justify-between gap-4 lg:flex">
          {links.map((link) => {
            const active = `${pathname}${hash}` === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={active ? 'page' : undefined}
                className={`text-[13px] transition-colors ${
                  active ? 'text-ink' : 'text-zinc-500 hover:text-ink'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* 10–12 · үйлдэл */}
        <div className="col-span-6 flex items-center justify-end gap-2">
          <div className="flex rounded-full border border-black/10 bg-white/80 p-1" role="group" aria-label="Language">
            {['mn', 'en'].map(value => <button key={value} type="button" aria-pressed={language === value} onClick={() => setLanguage(value)} className={`rounded-full px-2.5 py-2 text-xs font-semibold ${language === value ? 'bg-ink text-white' : 'text-zinc-600 hover:bg-black/5'}`}>{value.toUpperCase()}</button>)}
          </div>

          <button
            ref={menuButton}
            type="button"
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            aria-label={isEn ? (open ? 'Close menu' : 'Open menu') : (open ? 'Цэс хаах' : 'Цэс нээх')}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 backdrop-blur lg:hidden"
          >
            <span className="relative flex h-3 w-4 flex-col justify-between">
              <span
                className={`h-[1.5px] w-full origin-center bg-ink transition-transform duration-300 ${
                  open ? 'translate-y-[5.25px] rotate-45' : ''
                }`}
              />
              <span
                className={`h-[1.5px] w-full bg-ink transition-opacity duration-200 ${
                  open ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`h-[1.5px] w-full origin-center bg-ink transition-transform duration-300 ${
                  open ? '-translate-y-[5.25px] -rotate-45' : ''
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="public-mobile-nav"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mx-6 mt-4 rounded-2xl border border-black/10 bg-white/90 p-3 shadow-lg backdrop-blur-xl lg:hidden"
          >
            <div className="flex flex-col">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-xl px-3 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[0.04]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
