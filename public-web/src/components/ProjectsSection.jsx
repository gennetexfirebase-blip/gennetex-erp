import { useSiteContent } from '../context/SiteContentContext';

export default function ProjectsSection({ embedded = false }) {
  const { projects } = useSiteContent();

  return (
    <section className={`relative z-20 border-t border-graphite-800 bg-graphite-950 px-4 sm:px-6 md:px-12 ${embedded ? 'py-12 md:py-16' : 'py-20 md:py-28'}`}>
      <div className="mx-auto max-w-6xl">
        {!embedded ? (
          <>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-graphite-500">{projects.label}</p>
            <h2 className="mb-12 text-3xl font-normal tracking-tightest md:text-5xl">{projects.title}</h2>
          </>
        ) : null}

        <div className="mb-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {projects.stats.map((s) => (
            <div key={s.label} className="section-glass p-6 text-center">
              <div className="text-3xl font-semibold tracking-tight md:text-4xl">{s.value}</div>
              <div className="mt-2 text-sm text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="section-glass p-8 md:p-10">
          <h3 className="mb-6 text-xl font-medium">{projects.highlightsTitle}</h3>
          <ul className="space-y-4">
            {projects.highlights.map((h) => (
              <li key={h} className="flex gap-3 text-gray-300">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                <span className="leading-relaxed">{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
