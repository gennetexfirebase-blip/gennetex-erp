import { Network, Cable, Camera, ShieldCheck, Server, Wrench } from 'lucide-react';
import { useSiteContent } from '../context/SiteContentContext';

const ICONS = [Network, Cable, Camera, ShieldCheck, Server, Wrench];

export default function ServicesSection({ embedded = false }) {
  const { services } = useSiteContent();

  return (
    <section className={`relative z-20 border-t border-graphite-800 bg-graphite-950 px-4 sm:px-6 md:px-12 ${embedded ? 'py-12 md:py-16' : 'py-20 md:py-28'}`}>
      <div className="mx-auto max-w-6xl">
        {!embedded ? (
          <>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-graphite-500">{services.label}</p>
            <h2 className="mb-12 text-3xl font-normal tracking-tightest md:text-5xl">{services.title}</h2>
          </>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.items.map((s, i) => {
            const Icon = ICONS[i] || Network;
            return (
              <div key={s.title + i} className="section-glass group p-6 transition-all hover:border-graphite-600 hover:bg-graphite-900/60">
                <Icon className="mb-4 h-7 w-7 text-graphite-300 transition-colors group-hover:text-graphite-50" strokeWidth={1.5} />
                <h3 className="mb-2 font-medium">{s.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{s.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
