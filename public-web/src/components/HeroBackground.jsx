import { useEffect, useState } from 'react';
import { HERO_GIF_URL, HERO_POSTER_URL } from '../lib/supabase';

const MARQUEE_ITEMS = [
  'Шилэн кабель',
  'Сүлжээний инженерчлэл',
  'CCTV систем',
  'Сервер өрөө',
  'Wi-Fi шийдэл',
  'IT дэд бүтэц',
  'Аюулгүй байдал',
  '24/7 техникийн дэмжлэг',
];

export default function HeroBackground() {
  const [gifReady, setGifReady] = useState(false);
  const [motionReduced, setMotionReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMotionReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const showGif = !motionReduced;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black" aria-hidden>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${HERO_POSTER_URL})` }}
      />

      {showGif && (
        <img
          src={HERO_GIF_URL}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            gifReady ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setGifReady(true)}
          onError={() => setGifReady(false)}
        />
      )}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <p className="hero-watermark select-none text-center font-bold uppercase tracking-[0.35em] text-white/[0.06]">
          ЖЕННЕТЕКС
        </p>
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-graphite-950/70 via-graphite-950/40 to-graphite-950/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(59,130,246,0.15),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_60%,rgba(113,113,122,0.12),transparent_50%)]" />

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 border-t border-graphite-800/80 bg-graphite-950/40 py-3 backdrop-blur-sm">
        <div className="hero-marquee flex w-max gap-10 whitespace-nowrap text-xs font-medium uppercase tracking-[0.2em] text-graphite-400 sm:text-sm">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={`${item}-${i}`} className="inline-flex items-center gap-10">
              {item}
              <span className="text-white/25">◆</span>
            </span>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute left-4 top-24 hidden md:block md:left-12">
        <p className="max-w-[11rem] text-[10px] font-medium uppercase leading-relaxed tracking-[0.25em] text-white/35">
          Монголын IT дэд бүтэц
          <br />
          2010 оноос хойш
        </p>
      </div>
    </div>
  );
}
