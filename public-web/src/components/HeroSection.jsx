import { Link } from 'react-router-dom';
import { Star, Clock, Calendar, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSiteContent } from '../context/SiteContentContext';

export default function HeroSection() {
  const { hero } = useSiteContent();

  return (
    <div className="flex flex-1 flex-col justify-end px-4 pb-8 sm:px-6 md:px-12 md:pb-16">
      <div className="flex flex-col items-end gap-8 md:flex-row">
        <div className="flex-1">
          <div
            className="animate-blur-fade-up mb-6 flex flex-wrap items-center gap-3 text-xs sm:mb-8 sm:gap-6 sm:text-sm"
            style={{ animationDelay: '300ms' }}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Star className="h-4 w-4 fill-white sm:h-5 sm:w-5" />
              {hero.stat1}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              {hero.stat2}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              {hero.stat3}
            </span>
          </div>

          <div
            className="animate-blur-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-md sm:mb-6 sm:text-sm"
            style={{ animationDelay: '250ms' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {hero.badge}
          </div>

          <h1
            className="animate-blur-fade-up mb-4 text-3xl font-normal tracking-tightest sm:mb-6 sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ animationDelay: '400ms' }}
          >
            {hero.title1}
            <br />
            <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
              {hero.title2}
            </span>
          </h1>

          <p
            className="animate-blur-fade-up mb-2 max-w-2xl text-base text-gray-300 sm:mb-4 sm:text-lg md:text-xl"
            style={{ animationDelay: '500ms' }}
          >
            {hero.description}
          </p>

          <p
            className="animate-blur-fade-up mb-6 max-w-xl text-sm italic text-white/45 sm:mb-12 sm:text-base"
            style={{ animationDelay: '550ms' }}
          >
            {hero.tagline}
          </p>

          <div className="flex flex-wrap gap-3 sm:gap-4">
            <Link
              to="/services"
              className="animate-blur-fade-up inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200 sm:px-8 sm:py-3 sm:text-base"
              style={{ animationDelay: '600ms' }}
            >
              <Play size={18} className="fill-black" />
              {hero.btnServices}
            </Link>
            <Link
              to="/about"
              className="animate-blur-fade-up liquid-glass inline-flex items-center rounded-full px-6 py-2.5 text-sm font-medium sm:px-8 sm:py-3 sm:text-base"
              style={{ animationDelay: '700ms' }}
            >
              {hero.btnAbout}
            </Link>
          </div>
        </div>

        <div className="flex w-full gap-3 md:w-auto md:flex-col md:items-end">
          <Link
            to="/contact"
            className="animate-blur-fade-up liquid-glass inline-flex flex-1 items-center justify-center gap-1 rounded-full px-4 py-2.5 text-sm sm:px-6 md:flex-none"
            style={{ animationDelay: '800ms' }}
          >
            <ChevronLeft size={18} />
            {hero.btnContact}
          </Link>
          <Link
            to="/careers"
            className="animate-blur-fade-up liquid-glass inline-flex flex-1 items-center justify-center gap-1 rounded-full px-4 py-2.5 text-sm sm:px-6 md:flex-none"
            style={{ animationDelay: '900ms' }}
          >
            {hero.btnCareers}
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
