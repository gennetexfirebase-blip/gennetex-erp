import { useEffect, type ReactNode } from 'react';
import { BookOpen, ChevronRight, FilePlus2, Globe, Lightbulb, LogIn, Printer, Smartphone } from 'lucide-react';
import brandMark from '../assets/report-logo.png';
import { ThemeToggle } from '../components/ThemeToggle';

/**
 * guide.gennetex.com — ажилтанд зориулсан гарын авлага (нэвтрэлтгүй).
 * Дэлгэцийн зураг нь апп / akt.gennetex.com-ийн жинхэнэ бичиг, товчны нэрээр
 * хуулбарласан зураглал; дарах газрыг дугаартай хайрцаг + сумаар заана.
 */

/* ── Апп-ын бодит дэлгэц + тэмдэглэгээ ─────────────────────────────
 * Зураг нь 390×844 (CSS px) утасны дэлгэц; хайрцгийн координат тэр хэмжээгээр.
 */
type ShotMark = { n: number; r: [number, number, number, number]; note?: string; side?: 'right' | 'left' | 'top' | 'bottom' };
const SW = 390;
const SH = 844;
function Shot({ src, marks }: { src: string; marks: ShotMark[] }) {
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div className="mx-auto w-[280px] shrink-0 rounded-[36px] border-[9px] border-[#1b1d1c] bg-[#1b1d1c] shadow-xl sm:w-[300px]">
      <div className="relative overflow-visible rounded-[27px]" style={{ aspectRatio: `${SW} / ${SH}` }}>
        <img src={`${import.meta.env.BASE_URL}guide/${src}.webp`} alt="" loading="lazy" className="absolute inset-0 h-full w-full rounded-[27px] object-cover" />
        {marks.map((m) => {
          const [x, y, w, h] = m.r;
          const side = m.side || 'right';
          const pos =
            side === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-2 flex-row' :
            side === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2 flex-row-reverse' :
            side === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2 flex-col-reverse' :
            'top-full left-1/2 -translate-x-1/2 mt-2 flex-col';
          const arrow = side === 'right' ? '←' : side === 'left' ? '→' : side === 'top' ? '↓' : '↑';
          return (
            <div key={m.n} className="guide-mark absolute" style={{ left: pct(x - 3, SW), top: pct(y - 3, SH), width: pct(w + 6, SW), height: pct(h + 6, SH) }}>
              <div className="h-full w-full rounded-[10px] outline outline-[3px] outline-[#e5484d] shadow-[0_0_0_4px_rgba(229,72,77,0.25)]" />
              <span className="absolute -left-2.5 -top-2.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-[#e5484d] text-[12px] font-bold text-white shadow">{m.n}</span>
              {m.note ? (
                <span className={`pointer-events-none absolute z-10 flex items-center gap-1 whitespace-nowrap ${pos}`}>
                  <span className="text-[22px] font-black leading-none text-[#e5484d]">{arrow}</span>
                  <span className="rounded-md bg-[#e5484d] px-2 py-1 text-[11px] font-semibold text-white shadow">{m.note}</span>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── akt.gennetex.com-ийн бодит дэлгэц (1280×800 CSS px) + тэмдэглэгээ ── */
const WW = 1280;
const WH = 800;
function WebShot({ src, marks }: { src: string; marks: ShotMark[] }) {
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div className="w-full overflow-visible rounded-xl border border-[#cfd8d4] bg-[#eef2f0] shadow-xl dark:border-[#2a2d2b] dark:bg-[#1b1d1c]">
      <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2">
        <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" /></span>
        <span className="ml-2 flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] text-[#5f6d67] dark:bg-[#111312] dark:text-[#a9aeac]">https://akt.gennetex.com</span>
      </div>
      <div className="relative" style={{ aspectRatio: `${WW} / ${WH}` }}>
        <img src={`${import.meta.env.BASE_URL}guide/${src}.webp`} alt="" loading="lazy" className="absolute inset-0 h-full w-full rounded-b-xl object-cover" />
        {marks.map((m) => {
          const [x, y, w, h] = m.r;
          const side = m.side || 'right';
          const pos =
            side === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-2 flex-row' :
            side === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2 flex-row-reverse' :
            side === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2 flex-col-reverse' :
            'top-full left-1/2 -translate-x-1/2 mt-2 flex-col';
          const arrow = side === 'right' ? '←' : side === 'left' ? '→' : side === 'top' ? '↓' : '↑';
          return (
            <div key={m.n} className="guide-mark absolute" style={{ left: pct(x - 4, WW), top: pct(y - 4, WH), width: pct(w + 8, WW), height: pct(h + 8, WH) }}>
              <div className="h-full w-full rounded-[8px] outline outline-[3px] outline-[#e5484d] shadow-[0_0_0_4px_rgba(229,72,77,0.25)]" />
              <span className="absolute -left-2.5 -top-2.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-[#e5484d] text-[12px] font-bold text-white shadow">{m.n}</span>
              {m.note ? (
                <span className={`pointer-events-none absolute z-10 hidden items-center gap-1 whitespace-nowrap sm:flex ${pos}`}>
                  <span className="text-[20px] font-black leading-none text-[#e5484d]">{arrow}</span>
                  <span className="rounded-md bg-[#e5484d] px-2 py-1 text-[11px] font-semibold text-white shadow">{m.note}</span>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Алхам ───────────────────────────────────────────────────────── */
function Step({ n, title, children, shot, wide = false }: { n: string; title: string; children: ReactNode; shot: ReactNode; wide?: boolean }) {
  return (
    <section className={`guide-step grid gap-8 border-t border-line py-10 ${wide ? '' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center'}`}>
      <div>
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-bold text-brand">Алхам {n}</p>
        <h3 className="text-[20px] font-bold leading-tight text-ink">{title}</h3>
        <div className="mt-3 space-y-2 text-[14px] leading-6 text-muted">{children}</div>
      </div>
      <div className={`flex justify-center px-2 py-8 md:px-40 ${wide ? 'mx-auto w-full max-w-5xl' : ''}`}>{shot}</div>
    </section>
  );
}
const Li = ({ n, children }: { n: number; children: ReactNode }) => (
  <p className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e5484d] text-[11px] font-bold text-white">{n}</span><span>{children}</span></p>
);
const Tip = ({ children }: { children: ReactNode }) => <p className="flex gap-2 rounded-lg border border-line bg-card2 px-3 py-2 text-[13px] text-ink"><Lightbulb size={16} className="mt-0.5 shrink-0 text-warning" /><span>{children}</span></p>;

export default function GuidePage() {
  useEffect(() => {
    document.title = 'Гарын авлага — Акт үүсгэх · Gennetex';
    // act-document.css-ийн глобал хэвлэх дүрэм (body * нуух)-ийг энэ хуудсанд цуцална.
    document.documentElement.classList.add('print-plain');
    return () => document.documentElement.classList.remove('print-plain');
  }, []);

  return (
    <div className="min-h-screen bg-app text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-[var(--bg-topbar)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-line bg-white p-0.5"><img src={brandMark} alt="" className="h-full w-full object-contain" /></span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[13px] font-bold">Gennetex · Гарын авлага</p>
            <p className="text-[11px] text-subtle">guide.gennetex.com</p>
          </div>
          <nav className="hidden gap-1 text-[13px] font-semibold sm:flex">
            <a href="#app" className="rounded-md px-3 py-1.5 text-muted hover:bg-hover hover:text-ink">Утасны апп</a>
            <a href="#web" className="rounded-md px-3 py-1.5 text-muted hover:bg-hover hover:text-ink">akt.gennetex.com</a>
          </nav>
          <button type="button" onClick={() => window.print()} className="hidden items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-hover sm:inline-flex"><Printer size={14} /> Хэвлэх</button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="py-12">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-bold text-brand"><BookOpen size={14} /> Ажилтанд зориулсан</p>
          <h1 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[42px]">Ажил гүйцэтгэлийн акт хэрхэн үүсгэх вэ?</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[[Smartphone, 'Утасны апп', 'Талбай дээрээ шууд — зураг авч, илгээнэ', '#app'], [Globe, 'akt.gennetex.com', 'Компьютерээс — PDF / Word, гарын үсэг', '#web']].map(([I, t, d, h]) => {
              const Icon = I as typeof Smartphone;
              return (
                <a key={t as string} href={h as string} className="surface flex items-start gap-3 p-4 hover:border-[var(--border-strong)]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={20} /></span>
                  <span><b className="block text-[14px] text-ink">{t as string}</b><span className="text-[12px] text-muted">{d as string}</span></span>
                </a>
              );
            })}
          </div>
        </section>

        {/* ═══════════════ УТАСНЫ АПП ═══════════════ */}
        <h2 id="app" className="scroll-mt-20 pt-4 text-[26px] font-bold text-ink"><Smartphone className="mr-2 inline text-brand" size={26} />Утасны апп-аас акт үүсгэх</h2>
        <p className="mt-2 text-[13px] text-subtle">Зургууд нь Gennetex апп-ын бодит дэлгэц (жишээ өгөгдөлтэй demo данс).</p>

        <Step n="1" title="Нүүрээс «Акт бичих»-ийг дарна" shot={
          <Shot src="app-1-home" marks={[{ n: 1, r: [196, 340, 82, 106], note: 'Энд дарна', side: 'left' }]} />
        }>
          <Li n={1}>Апп-ын нүүрийг доош гүйлгээд <b className="text-ink">«Ажил ба дуудлага»</b> хэсгийн <b className="text-ink">«Акт бичих»</b> дээр дарна.</Li>
        </Step>

        <Step n="2" title="«+ Шинэ» товчоор шинэ акт эхлүүлнэ" shot={
          <Shot src="app-2-acts" marks={[{ n: 1, r: [286, 24, 88, 36], note: 'Шинэ акт', side: 'bottom' }, { n: 2, r: [16, 148, 374, 34], note: 'Төлөвөөр шүүх', side: 'bottom' }]} />
        }>
          <Li n={1}>Баруун дээд буланд байрлах <b className="text-ink">«+ Шинэ»</b> товчийг дарна (акт байхгүй үед голд «Акт үүсгэх» гарна).</Li>
          <Li n={2}>Эндээс өмнөх актаа <b className="text-ink">Ноорог / Илгээсэн / Баталгаажсан</b>-аар шүүж харна.</Li>
        </Step>

        <Step n="3" title="Толгой мэдээллээ бөглөнө" shot={
          <Shot src="app-3-header" marks={[{ n: 1, r: [32, 136, 326, 54], note: 'Ажлын нэр', side: 'right' }, { n: 2, r: [32, 224, 326, 54], note: 'Захиалагч', side: 'right' }, { n: 3, r: [32, 488, 326, 110], note: 'Хийсэн ажил', side: 'right' }]} />
        }>
          <Li n={1}><b className="text-ink">Ажлын нэр</b> — заавал (ж: «Сүлжээний угсралт»).</Li>
          <Li n={2}><b className="text-ink">Захиалагч</b> — байгууллага эсвэл хүний нэр. Доор нь байршил, эхэлсэн / дууссан огноо.</Li>
          <Li n={3}><b className="text-ink">Хийсэн ажил</b> — юу хийснээ дэлгэрэнгүй бичнэ (заавал).</Li>
        </Step>

        <Step n="4" title="Ашигласан бараа материалаа нэмнэ" shot={
          <Shot src="app-4-materials" marks={[{ n: 1, r: [272, 219, 86, 33], note: 'Мөр нэмэх', side: 'top' }, { n: 2, r: [47, 300, 296, 166], note: 'Нэр, тоо, нэгж', side: 'right' }]} />
        }>
          <Li n={1}><b className="text-ink">«+ Мөр нэмэх»</b> дарж материал бүрийг нэмнэ.</Li>
          <Li n={2}>Материалын <b className="text-ink">нэр, тоо, нэгж</b>-ийг бичнэ. Буруу мөрийг «Устгах»-аар арилгана.</Li>
          <Tip>Материал ашиглаагүй бол энэ хэсгийг хоосон үлдээнэ.</Tip>
        </Step>

        <Step n="5" title="Ажлын зураг оруулна" shot={
          <Shot src="app-4-materials" marks={[{ n: 1, r: [32, 579, 90, 90], note: 'Камераар', side: 'left' }, { n: 2, r: [132, 579, 90, 90], note: 'Галерейгаас', side: 'right' }]} />
        }>
          <Li n={1}><b className="text-ink">«Камер»</b> — шууд зураг авна.</Li>
          <Li n={2}><b className="text-ink">«Сангаас»</b> — утсандаа байгаа зургаас сонгоно.</Li>
          <Tip>Ажлын өмнөх, дараах байдал, холболт, хэмжилтийн зургийг оруулбал акт хурдан баталгаажна.</Tip>
        </Step>

        <Step n="6" title="Хадгалах эсвэл Захиралд илгээх" shot={
          <Shot src="app-4-materials" marks={[{ n: 1, r: [16, 792, 154, 52], note: 'Ноорог', side: 'top' }, { n: 2, r: [180, 792, 194, 52], note: 'Захиралд илгээх', side: 'top' }]} />
        }>
          <Li n={1}><b className="text-ink">«Хадгалах»</b> — дуусаагүй бол ноорог болгон хадгална, дараа үргэлжлүүлнэ.</Li>
          <Li n={2}><b className="text-ink">«Илгээх»</b> — бүрэн бол дарна. Акт <b className="text-ink">Захиралд</b> баталгаажуулахаар очно.</Li>
          <Tip>Захирал баталгаажуулахад Женнетексийн тамга автоматаар дарагдана. PDF / Word-ийг akt.gennetex.com-оос гаргана.</Tip>
        </Step>

        <Step n="7" title="Актын төлвийг хянана" shot={
          <Shot src="app-5-status" marks={[{ n: 1, r: [16, 148, 374, 34], note: 'Шүүлтүүр', side: 'bottom' }, { n: 2, r: [288, 206, 76, 36], note: 'Төлөв', side: 'left' }]} />
        }>
          <Li n={1}>Дээрх табаар <b className="text-ink">Ноорог / Илгээсэн / Баталгаажсан</b> актаа шүүнэ.</Li>
          <Li n={2}>Карт бүрийн баруун дээд буланд <b className="text-ink">төлөв</b> нь харагдана.</Li>
        </Step>

        <Step n="8" title="Ноорог актаа засах, илгээх" shot={
          <Shot src="app-6-detail" marks={[{ n: 1, r: [287, 12, 87, 36], note: 'Засах', side: 'bottom' }, { n: 2, r: [16, 792, 358, 52], note: 'Захиралд илгээх', side: 'top' }]} />
        }>
          <p>Жагсаалтаас актаа дарж дэлгэрэнгүйг нээнэ.</p>
          <Li n={1}>Ноорог үед <b className="text-ink">«Засах»</b>-аар өөрчилнө.</Li>
          <Li n={2}>Бэлэн болмогц <b className="text-ink">«Захиралд илгээх»</b> дарна.</Li>
        </Step>

        {/* ═══════════════ ВЕБ ═══════════════ */}
        <h2 id="web" className="scroll-mt-20 border-t border-line pt-12 text-[26px] font-bold text-ink"><Globe className="mr-2 inline text-brand" size={26} />Компьютерээс — akt.gennetex.com</h2>
        <p className="mt-2 text-[13px] text-subtle">Зургууд нь akt.gennetex.com-ийн бодит дэлгэц (жишээ өгөгдөлтэй). Хөтчөөр akt.gennetex.com-г нээж, апп-д нэвтэрдэг Google хаягаараа нэвтэрнэ.</p>

        <Step wide n="1" title="«Акт үүсгэх» товчийг дарна" shot={
          <WebShot src="web-1" marks={[{ n: 1, r: [1132, 118, 116, 36], note: 'Шинэ акт', side: 'bottom' }, { n: 2, r: [292, 198, 560, 48], note: 'Төлөвөөр шүүх', side: 'bottom' }]} />
        }>
          <Li n={1}><b className="text-ink">Актын бүртгэл</b> хуудасны баруун дээрх <b className="text-ink">«Акт үүсгэх»</b> дарна.</Li>
          <Li n={2}>Өмнөх актаа <b className="text-ink">Ноорог / Бэлэн / Баталгаажсан</b>-аар шүүж, хайж олно.</Li>
        </Step>

        <Step wide n="2" title="Төсөл сонгох эсвэл гараар үүсгэх" shot={
          <WebShot src="web-2" marks={[{ n: 1, r: [585, 410, 494, 40], note: 'Төсөл сонгох', side: 'bottom' }, { n: 2, r: [1092, 410, 115, 40], note: 'Гараар', side: 'bottom' }]} />
        }>
          <Li n={1}><b className="text-ink">Төсөл / Объект</b>-оо сонговол захиалагч, хаяг, огноо, гүйцэтгэсэн ажил <b className="text-ink">автоматаар бөглөгдөнө</b>.</Li>
          <Li n={2}>Жагсаалтад байхгүй бол <b className="text-ink">«Гараар үүсгэх»</b> дарна.</Li>
        </Step>

        <Step wide n="3" title="1.1 Үндсэн мэдээлэл" shot={
          <WebShot src="web-3" marks={[{ n: 1, r: [309, 420, 904, 40], note: 'Загвар, төрөл', side: 'top' }, { n: 2, r: [309, 500, 444, 40], note: 'Төсөл', side: 'right' }, { n: 3, r: [309, 660, 444, 40], note: 'Захиалагч', side: 'right' }, { n: 4, r: [1022, 752, 216, 36], note: 'Хадгалах / Дараах', side: 'top' }]} />
        }>
          <Li n={1}><b className="text-ink">Актын загвар, төрөл</b>-ийг сонгоно.</Li>
          <Li n={2}>Төсөл / объект, хаяг, гүйцэтгэгчийг шалгана.</Li>
          <Li n={3}><b className="text-ink">Захиалагч байгууллага</b>, огноо, <b className="text-ink">гүйцэтгэсэн ажил</b>-аа бичнэ. Улаан <b className="text-[#e5484d]">*</b> тэмдэгтэй талбар заавал.</Li>
          <Li n={4}>Доод талын <b className="text-ink">«Хадгалах»</b>, <b className="text-ink">«Дараах»</b> товч алхам бүрт байна (мөн автоматаар хадгалагдана).</Li>
        </Step>

        <Step wide n="4" title="1.2 Материал, 1.3 Шаардлага, 1.4 Зураг" shot={
          <WebShot src="web-4" marks={[{ n: 1, r: [686, 103, 187, 36], note: 'ERP-с татах', side: 'bottom' }, { n: 2, r: [1060, 103, 153, 36], note: 'Гараар нэмэх', side: 'bottom' }, { n: 3, r: [740, 518, 128, 40], note: 'Тийм / Үгүй / N/A', side: 'left' }, { n: 4, r: [902, 633, 311, 38], note: 'Зураг оруулах', side: 'left' }]} />
        }>
          <Li n={1}><b className="text-ink">«ERP-с материал татах»</b> — агуулахаас олгосон материалыг автоматаар авна.</Li>
          <Li n={2}>Эсвэл <b className="text-ink">«Материал нэмэх»</b>-ээр нэр, нэгж, тоо хэмжээг гараар бичнэ.</Li>
          <Li n={3}>Шаардлага бүрт <b className="text-ink">Тийм / Үгүй / N/A</b>; «Үгүй» бол шалтгаанаа бичнэ.</Li>
          <Li n={4}><b className="text-ink">«ERP-с зураг сонгох»</b> (апп-аар авсан) эсвэл <b className="text-ink">«Зураг upload»</b>.</Li>
        </Step>

        <Step wide n="5" title="2. Хүлээлцэх хүмүүс ба гарын үсэг" shot={
          <WebShot src="web-5" marks={[{ n: 1, r: [302, 186, 160, 28], note: 'Актад оруулах', side: 'right' }, { n: 2, r: [309, 282, 444, 40], note: 'Хэсэг', side: 'right' }, { n: 3, r: [309, 442, 904, 40], note: 'Нэр, албан тушаал', side: 'top' }, { n: 4, r: [326, 597, 182, 36], note: 'Гарын үсэг', side: 'right' }]} />
        }>
          <Li n={1}>Хүлээлцэх хүнийг <b className="text-ink">чагтлах</b> — чагтласан хүн л PDF, Word дээр гарна.</Li>
          <Li n={2}><b className="text-ink">Хүлээлцэх хэсэг</b> (Захиалагч, Өрх, Женнетекс …)-ийг сонгоно.</Li>
          <Li n={3}>Нэр, албан тушаалыг бичнэ эсвэл хадгалсан хүн / ERP ажилтнаас сонгоно.</Li>
          <Li n={4}>Гарын үсгийг <b className="text-ink">«Зурах»</b>-аар дэлгэц дээр зурна эсвэл <b className="text-ink">«Upload»</b> хийнэ.</Li>
        </Step>

        <Step wide n="6" title="3. Урьдчилан харах" shot={
          <WebShot src="web-6" marks={[{ n: 1, r: [444, 357, 636, 380], note: 'Актын хэвлэх хувилбар', side: 'left' }, { n: 2, r: [807, 272, 113, 36], note: 'PDF засах', side: 'bottom' }]} />
        }>
          <Li n={1}>Акт A4 хуудсан дээр яг хэвлэгдэх байдлаар харагдана — алдаагаа шалгана.</Li>
          <Li n={2}>Шаардлагатай бол <b className="text-ink">«PDF засах»</b>-аар байрлалыг тохируулна.</Li>
        </Step>

        <Step wide n="7" title="4. PDF / Word ба Бэлэн болгох" shot={
          <WebShot src="web-7" marks={[{ n: 1, r: [330, 504, 91, 36], note: 'PDF', side: 'bottom' }, { n: 2, r: [637, 504, 98, 36], note: 'Word', side: 'bottom' }, { n: 3, r: [943, 504, 74, 36], note: 'Хэвлэх', side: 'bottom' }, { n: 4, r: [383, 606, 111, 36], note: 'Захиралд илгээх', side: 'bottom' }]} />
        }>
          <Li n={1}><b className="text-ink">«PDF татах»</b> — A4 PDF.</Li>
          <Li n={2}><b className="text-ink">«Word татах»</b> — засварлах боломжтой DOCX.</Li>
          <Li n={3}><b className="text-ink">«Хэвлэх»</b> — шууд хэвлэнэ.</Li>
          <Li n={4}>Бүх зүйл зөв бол <b className="text-ink">«Бэлэн болгох»</b> дарж Захиралд баталгаажуулахаар илгээнэ.</Li>
        </Step>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[12px] text-subtle">
          <span>© {new Date().getFullYear()} GENNETEX ХХК · Гарын авлага</span>
          <span className="flex gap-3"><a href="https://akt.gennetex.com" className="inline-flex items-center gap-1 text-brand hover:underline"><LogIn size={13} />akt.gennetex.com</a><a href="#app" className="inline-flex items-center gap-1 text-brand hover:underline"><ChevronRight size={13} />Дээш</a></span>
        </footer>
      </main>
    </div>
  );
}

