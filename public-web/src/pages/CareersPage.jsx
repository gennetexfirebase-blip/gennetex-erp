import { Briefcase, Clock, MapPin, Shield, Wallet } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import JobApplicationForm from '../components/JobApplicationForm';
import { useSiteContent } from '../context/SiteContentContext';

const PERK_ICONS = [Briefcase, Clock, Shield];

export default function CareersPage() {
  const { careers } = useSiteContent();
  // Нэг л эх сурвалж (`careers.jobOptions`) хуудсан дээрх жагсаалт болон
  // анкетын сонголтыг ЗЭРЭГ тэжээнэ — админаас нэг газар засна.
  const openings = Array.isArray(careers.jobOptions)
    ? careers.jobOptions.filter((j) => j && j.title)
    : [];

  return (
    <>
      <PageHeader label={careers.label} title={careers.title} description={careers.pageIntro} />

      {openings.length ? (
        <section className="border-b border-graphite-800 bg-graphite-950 px-4 pt-12 sm:px-6 md:px-12">
          <div className="mx-auto max-w-6xl pb-12">
            <h2 className="font-display text-2xl tracking-tightest text-graphite-50 md:text-3xl">
              {careers.openingsTitle}
            </h2>
            <p className="mt-2 text-sm text-zinc-500">{careers.openingsNote}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {openings.map((job) => (
                <li key={job.title} className="section-glass p-5">
                  <h3 className="!mt-0 !mb-1 font-display text-base text-graphite-50">{job.title}</h3>
                  {job.text ? <p className="!mb-3 text-sm">{job.text}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {job.type ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase size={13} /> {job.type}
                      </span>
                    ) : null}
                    {job.location ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} /> {job.location}
                      </span>
                    ) : null}
                    {job.salary ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet size={13} /> {job.salary}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

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
