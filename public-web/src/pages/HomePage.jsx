import { Link } from 'react-router-dom';
import HeroBackground from '../components/HeroBackground';
import HeroSection from '../components/HeroSection';
import { useSiteContent } from '../context/SiteContentContext';
import { ArrowRight, Briefcase, Layers, Mail, Users } from 'lucide-react';

const ICONS = {
  '/about': Users,
  '/services': Layers,
  '/projects': Briefcase,
  '/careers': Briefcase,
  '/contact': Mail,
};

export default function HomePage() {
  const { home } = useSiteContent();

  return (
    <>
      <header className="relative min-h-screen overflow-hidden">
        <HeroBackground />
        <div className="pointer-events-none fixed inset-0 z-[1] backdrop-blur-xl bottom-blur-mask" aria-hidden />
        <div className="relative z-10 flex min-h-screen flex-col">
          <HeroSection />
        </div>
      </header>

      <section className="relative z-20 border-t border-graphite-800 bg-graphite-950 px-4 py-16 sm:px-6 md:px-12 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-graphite-500">
            {home.label}
          </p>
          <h2 className="mb-10 text-center text-2xl font-normal tracking-tightest text-graphite-50 md:text-4xl">
            {home.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {home.links.map((item) => {
              const Icon = ICONS[item.to] || Briefcase;
              const highlight = item.to === '/careers';
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group rounded-2xl border p-6 transition-all hover:-translate-y-1 ${
                    highlight
                      ? 'border-accent/40 bg-accent-soft hover:border-accent/60'
                      : 'border-graphite-800 bg-graphite-900/50 hover:border-graphite-600 hover:bg-graphite-900'
                  }`}
                >
                  <Icon className={`mb-4 h-8 w-8 ${highlight ? 'text-accent' : 'text-graphite-300'}`} />
                  <h3 className="mb-2 text-lg font-medium text-graphite-50">{item.title}</h3>
                  <p className="text-sm text-graphite-400">{item.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-graphite-200 group-hover:gap-2">
                    {home.linkOpen} <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
