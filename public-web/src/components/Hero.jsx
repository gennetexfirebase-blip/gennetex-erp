import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useSiteContent } from '../context/SiteContentContext';

/**
 * Нүүрний баннер.
 *
 * Дэвсгэрт бүтэн өргөнтэй видео явна. Видеоны дээд ирмэгийг #EDEEF5
 * суурь руу градиентээр уусгаж, огтлолцох шугам харагдахгүй болгоно.
 * Бүх текст `hero.*` агуулгаас ирдэг тул админаас засна.
 */
export default function Hero() {
  const { hero } = useSiteContent();

  const lead1 = hero.lead1 ?? hero.title1;
  const lead2 = hero.lead2 ?? hero.description;
  const lead3 = hero.lead3 ?? '';
  const lead4 = hero.lead4 ?? '';

  return (
    <section className="relative flex min-h-[110vh] w-full flex-col items-center justify-start overflow-hidden bg-bg-base sm:min-h-[140vh]">
      {/* ---- дэвсгэр видео ---- */}
      <div className="pointer-events-none absolute left-0 top-[15vh] z-0 h-[95vh] w-full sm:top-[20vh] sm:h-[120vh]">
        {hero.videoUrl ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={hero.videoPoster || undefined}
            className="h-full w-full object-cover opacity-100"
            src={hero.videoUrl}
          />
        ) : null}
        {/* Видеог суурь өнгө рүү уусгах маск */}
        <div className="absolute left-0 top-0 h-24 w-full bg-gradient-to-b from-bg-base to-transparent sm:h-32" />
      </div>

      {/* ---- агуулга ---- */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-12 gap-x-4 px-8 pt-[26vh] md:gap-x-8 md:px-16 md:pt-[24vh] lg:px-20">
        <div className="col-span-12 md:col-span-10 md:col-start-2">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-display text-[30px] font-light leading-[1.15] tracking-tightest sm:text-[42px] md:text-[58px] lg:text-[70px]"
          >
            <span className="text-[#1a1a1a]">{lead1}</span>{' '}
            <span className="text-[#8e8e8e]">{lead2}</span>
            {lead3 ? (
              <>
                <br />
                <span className="text-[#8e8e8e]">{lead3}</span>
              </>
            ) : null}
            {lead4 ? (
              <>
                <br />
                <span className="text-[#8e8e8e]">
                  {lead4.split('|')[0]}
                  <span
                    aria-hidden="true"
                    className="mx-1 inline-flex w-[16px] items-center justify-center rounded-full border-[2px] border-[#1a1a1a] align-middle md:w-[42px] lg:w-[62px]"
                    style={{ height: '0.72em' }}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#1a1a1a]" />
                  </span>
                  {lead4.split('|')[1] ?? ''}
                </span>
              </>
            ) : null}
          </motion.h1>

          {/* ---- хайлтын капсул ---- */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="mt-8 max-w-xl md:mt-10"
          >
            <form
              className="flex items-center rounded-[6px] border border-black/[0.05] bg-white p-1 pl-4 shadow-sm"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                aria-label={hero.searchPlaceholder || 'Хайх'}
                placeholder={hero.searchPlaceholder || 'Юу хайж байна?'}
                className="min-w-0 flex-1 bg-transparent py-2 text-[14px] text-ink outline-none placeholder:text-zinc-400"
              />
              <button
                type="submit"
                aria-label="Хайх"
                className="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#1a1a1a] text-white"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </form>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/services" className="action-primary">
                {hero.btnServices}
              </Link>
              <Link to="/projects" className="action-secondary">
                {hero.btnAbout}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ---- ирмэгийн зангуунууд ---- */}
      <div className="absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 md:block">
        <div className="liquid-glass flex items-center gap-2 rounded-full px-3 py-2 text-[11px] tracking-wide">
          <span className="text-ink">mn</span>
          <span className="text-zinc-400">—</span>
          <span className="text-zinc-400">en</span>
        </div>
      </div>

      <div className="absolute bottom-6 left-8 z-10 text-[11px] tracking-wide text-zinc-500 md:left-16 lg:left-20">
        {hero.year || new Date().getFullYear()}
      </div>
      <div className="absolute bottom-6 right-8 z-10 text-[11px] tracking-wide text-zinc-500 md:right-16 lg:right-20">
        {hero.cornerNote || 'сүлжээний дэд бүтэц'}
      </div>
    </section>
  );
}
