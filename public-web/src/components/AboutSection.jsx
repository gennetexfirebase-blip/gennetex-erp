import { Target, Users, Shield } from 'lucide-react';
import { useSiteContent } from '../context/SiteContentContext';

const ICONS = [Target, Users, Shield];

export default function AboutSection({ embedded = false }) {
  const { about } = useSiteContent();

  return (
    <section className={`relative z-20 bg-graphite-950 px-4 sm:px-6 md:px-12 ${embedded ? 'py-12 md:py-16' : 'py-20 md:py-28'}`}>
      <div className="mx-auto max-w-6xl">
        {!embedded ? (
          <>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-graphite-500">{about.label}</p>
            <h2 className="mb-4 max-w-2xl text-3xl font-normal tracking-tightest md:text-5xl">{about.title}</h2>
            <p className="mb-12 max-w-2xl text-lg text-gray-400">{about.intro}</p>
          </>
        ) : null}
        <div className="grid gap-5 md:grid-cols-3">
          {about.items.map((item, i) => {
            const Icon = ICONS[i] || Target;
            return (
              <div key={item.title + i} className="section-glass p-6 transition-transform hover:-translate-y-1">
                <Icon className="mb-4 h-8 w-8 text-white/80" strokeWidth={1.5} />
                <h3 className="mb-2 text-lg font-medium">{item.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
