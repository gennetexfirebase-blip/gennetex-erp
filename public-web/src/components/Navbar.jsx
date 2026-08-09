import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Search, User } from 'lucide-react';
import { useSiteContent } from '../context/SiteContentContext';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { navbar } = useSiteContent();
  const isHome = pathname === '/';
  const close = () => setOpen(false);

  return (
    <>
      <nav
        className={`relative z-50 flex items-center justify-between px-4 py-4 sm:px-6 md:px-12 md:py-6 ${
          isHome ? '' : 'border-b border-graphite-800 bg-graphite-950/90 backdrop-blur-md'
        }`}
      >
        <Link to="/" className="animate-blur-fade-up flex items-center gap-2" style={{ animationDelay: '0ms' }}>
          <img src="/logo.png" alt={navbar.brand} className="h-8 w-auto md:h-10" />
          <span className="text-lg font-semibold tracking-tight md:text-xl">{navbar.brand}</span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {navbar.links.map((link, i) => (
            <Link
              key={link.to}
              to={link.to}
              className={`animate-blur-fade-up text-sm transition-colors ${
                pathname === link.to ? 'font-medium text-graphite-50' : 'text-graphite-300 hover:text-graphite-100'
              }`}
              style={{ animationDelay: `${100 + i * 50}ms` }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/careers"
            className="animate-blur-fade-up liquid-glass hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-medium sm:flex md:px-6"
            style={{ animationDelay: '350ms' }}
          >
            <Search size={18} />
            <span>{navbar.ctaCareers}</span>
          </Link>

          <Link
            to="/contact"
            className="animate-blur-fade-up liquid-glass hidden h-10 w-10 items-center justify-center rounded-full sm:flex"
            style={{ animationDelay: '400ms' }}
          >
            <User size={18} />
          </Link>

          <button
            type="button"
            className="animate-blur-fade-up liquid-glass flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
            style={{ animationDelay: '350ms' }}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Цэс хаах' : 'Цэс нээх'}
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <Menu
                size={20}
                className={`absolute transition-all duration-500 ease-out ${
                  open ? 'rotate-180 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
                }`}
              />
              <X
                size={20}
                className={`absolute transition-all duration-500 ease-out ${
                  open ? 'rotate-0 scale-100 opacity-100' : '-rotate-180 scale-50 opacity-0'
                }`}
              />
            </span>
          </button>
        </div>
      </nav>

      <div
        className={`absolute left-0 right-0 top-[72px] z-40 border-b border-t border-graphite-800 bg-graphite-900/95 shadow-2xl backdrop-blur-lg transition-all duration-500 ease-out lg:hidden ${
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-4 opacity-0'
        }`}
      >
        <div className="flex flex-col px-4 py-4">
          {navbar.links.map((link, i) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={close}
              className="rounded-lg px-3 py-3 text-sm text-graphite-200 transition-all hover:bg-graphite-800/60"
              style={{
                transitionDelay: open ? `${i * 50}ms` : '0ms',
                transform: open ? 'translateX(0)' : 'translateX(-12px)',
                opacity: open ? 1 : 0,
              }}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 flex gap-3 border-t border-graphite-800 pt-4 sm:hidden">
            <Link
              to="/careers"
              className="liquid-glass flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm"
              onClick={close}
            >
              <Search size={18} />
              {navbar.ctaCareers}
            </Link>
            <Link
              to="/contact"
              className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full"
              onClick={close}
            >
              <User size={18} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
