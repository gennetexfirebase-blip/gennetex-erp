import { Briefcase, Clock, Shield } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import JobApplicationForm from '../components/JobApplicationForm';
import { useSiteContent } from '../context/SiteContentContext';

const PERK_ICONS = [Briefcase, Clock, Shield];

export default function CareersPage() {
  const { careers } = useSiteContent();

  return (
    <>
      <PageHeader label={careers.label} title={careers.title} description={careers.pageIntro} />

      <section className="relative z-20 border-t border-graphite-800 bg-graphite-950 px-4 py-12 sm:px-6 md:px-12 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-10 xl:grid-cols-[minmax(0,320px)_1fr]">
            <aside className="order-2 lg:order-1">
              <div className="section-glass p-5 sm:p-6 lg:sticky lg:top-24">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-graphite-400">{careers.perksTitle}</h2>
                <ul className="mt-4 space-y-3">
                  {careers.perks.map((text, i) => {
                    const Icon = PERK_ICONS[i] || Briefcase;
                    return (
                      <li key={text} className="flex items-center gap-3 text-sm text-graphite-300">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-graphite-800 text-accent">
                          <Icon size={16} />
                        </span>
                        {text}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-6 rounded-xl border border-graphite-700/80 bg-graphite-950/50 p-4 text-xs leading-relaxed text-graphite-500">
                  {careers.sidebarNote}
                </div>
              </div>
            </aside>

            <div className="order-1 min-w-0 lg:order-2">
              <div className="section-glass">
                <JobApplicationForm embedded />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
