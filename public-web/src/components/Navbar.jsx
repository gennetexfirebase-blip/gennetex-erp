import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useSiteContent } from '../context/SiteContentContext';

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
  const { pathname } = useLocation();
  const { navbar } = useSiteContent();
  const menuButton = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
      aria-label="Үндсэн цэс"
      className="fixed left-0 top-0 z-50 w-full bg-gradient-to-b from-[#f1f1f1]/80 to-transparent py-6 backdrop-blur-[2px] md:py-8"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-12 items-center gap-x-4 px-6 md:px-10 lg:px-16">
        {/* 1–3 · брэнд */}
        <div className="col-span-6 flex items-center gap-2 md:col-span-3">
          <Link to="/" className="flex items-center gap-2">
            <CloverMark className="h-6 w-6 md:h-7 md:w-7" />
            <span className="font-display text-lg font-medium tracking-tight text-ink md:text-xl">
              {navbar.brand}
            </span>
          </Link>
        </div>

        {/* 4–9 · цэс (зөвхөн дэлгэц дээр) */}
        <div className="col-span-6 hidden items-center justify-center gap-7 lg:flex">
          {navbar.links.map((link) => {
            const active = pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={active ? 'page' : undefined}
                className={`text-[13px] transition-colors ${
                  active ? 'text-ink' : 'text-zinc-500 hover:text-ink'
                }`}
              >
                {link.label.toLowerCase()}
              </Link>
            );
          })}
        </div>

        {/* 10–12 · үйлдэл */}
        <div className="col-span-6 flex items-center justify-end gap-3 md:col-span-3">
          <Link
            to="/contact"
            className="hidden text-[13px] text-zinc-500 transition-colors hover:text-ink lg:inline"
          >
            холбоо барих
          </Link>
          <a
            href="https://cv.gennetex.com"
            className="hidden items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-white transition-transform hover:-translate-y-px sm:inline-flex"
          >
            {navbar.ctaCareers} <span aria-hidden="true">→</span>
          </a>

          <button
            ref={menuButton}
            type="button"
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            aria-label={open ? 'Цэс хаах' : 'Цэс нээх'}
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
              {navbar.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-xl px-3 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[0.04]"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="https://cv.gennetex.com"
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white"
              >
                {navbar.ctaCareers} <span aria-hidden="true">→</span>
              </a>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
