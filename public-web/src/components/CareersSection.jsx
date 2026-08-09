import JobApplicationForm from './JobApplicationForm';
import { useSiteContent } from '../context/SiteContentContext';

export default function CareersSection() {
  const { careers } = useSiteContent();

  return (
    <section id="careers" className="relative z-20 border-t border-graphite-800 bg-graphite-950 px-4 py-20 sm:px-6 md:px-12 md:py-28">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-graphite-500">{careers.label}</p>
        <h2 className="mb-3 text-center text-3xl font-normal tracking-tightest text-graphite-50 md:text-5xl">{careers.title}</h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-graphite-400">{careers.intro}</p>
        <div className="section-glass">
          <JobApplicationForm embedded />
        </div>
      </div>
    </section>
  );
}
