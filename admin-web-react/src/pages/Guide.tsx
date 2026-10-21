import { useEffect, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, CloudDownload, Download, FilePlus2, FileText,
  Globe, Image as ImageIcon, ImagePlus, Images, Lightbulb, LogIn, PenLine, Plus, Printer, Save, Search, Send, Signature, Smartphone, Upload, Users,
} from 'lucide-react';
import brandMark from '../assets/report-logo.png';
import { ThemeToggle } from '../components/ThemeToggle';
import { GoogleIcon } from '../components/ui';

/**
 * guide.gennetex.com — ажилтанд зориулсан гарын авлага (нэвтрэлтгүй).
 * Дэлгэцийн зураг нь апп / akt.gennetex.com-ийн жинхэнэ бичиг, товчны нэрээр
 * хуулбарласан зураглал; дарах газрыг дугаартай хайрцаг + сумаар заана.
 */

/* ── Тэмдэглэгээ: дугаартай хайрцаг + сум ─────────────────────────── */
function Mark({ n, children, note, side = 'right', className = '' }: { n: number; children: ReactNode; note?: string; side?: 'right' | 'left' | 'top' | 'bottom'; className?: string }) {
  const pos =
    side === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-2 flex-row' :
    side === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2 flex-row-reverse' :
    side === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2 flex-col-reverse' :
    'top-full left-1/2 -translate-x-1/2 mt-2 flex-col';
  const arrow = side === 'right' ? '←' : side === 'left' ? '→' : side === 'top' ? '↓' : '↑';
  return (
    <div className={`guide-mark relative ${className}`}>
      <div className="rounded-[10px] outline outline-[3px] outline-offset-[3px] outline-[#e5484d]">{children}</div>
      <span className="absolute -left-3 -top-3 z-10 grid h-6 w-6 place-items-center rounded-full bg-[#e5484d] text-[12px] font-bold text-white shadow">{n}</span>
      {note ? (
        <span className={`pointer-events-none absolute z-10 hidden items-center gap-1 whitespace-nowrap md:flex ${pos}`}>
          <span className="text-[22px] font-black leading-none text-[#e5484d]">{arrow}</span>
          <span className="rounded-md bg-[#e5484d] px-2 py-1 text-[11px] font-semibold text-white shadow">{note}</span>
        </span>
      ) : null}
    </div>
  );
}

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

/* ── Хөтчийн хүрээ ───────────────────────────────────────────────── */
function Browser({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-[#cfd8d4] bg-white text-[#16201c] shadow-xl">
      <div className="flex items-center gap-2 border-b border-[#e3e9e6] bg-[#eef2f0] px-3 py-2">
        <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" /></span>
        <span className="ml-2 flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] text-[#5f6d67]">{url}</span>
      </div>
      <div className="flex min-h-[340px]">
        <aside className="hidden w-44 shrink-0 border-r border-[#e3e9e6] bg-[#f8faf9] p-3 sm:block">
          <div className="mb-3 flex items-center gap-2"><img src={brandMark} alt="" className="h-6 w-6 rounded bg-white object-contain" /><b className="text-[11px]">GENNETEX</b></div>
          <p className="mb-1 text-[9px] font-semibold uppercase text-[#5f6d67]">Баримт бичиг</p>
          <p className="rounded-md bg-[#e6ece9] px-2 py-1.5 text-[11px] font-semibold">Ажил гүйцэтгэлийн акт</p>
        </aside>
        <div className="min-w-0 flex-1 space-y-3 bg-[#f7f9f8] p-4">{children}</div>
      </div>
    </div>
  );
}
const WField = ({ label, value, req, select, tall }: { label: string; value?: string; req?: boolean; select?: boolean; tall?: boolean }) => (
  <div>
    <p className="mb-1 text-[10px] font-semibold text-[#5f6d67]">{label}{req ? <b className="text-[#e5484d]"> *</b> : null}</p>
    <div className={`flex items-center justify-between rounded-md border border-[#d9e1dd] bg-white px-2.5 text-[11px] text-[#5f6d67] ${tall ? 'h-14 items-start py-1.5' : 'h-8'}`}>{value || ''}{select ? <ChevronDown size={13} /> : null}</div>
  </div>
);
const WBtn = ({ children, outline, icon }: { children: ReactNode; outline?: boolean; icon?: ReactNode }) => (
  <span className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[11px] font-semibold ${outline ? 'border border-[#d9e1dd] bg-white text-[#16201c]' : 'bg-[#0c8a62] text-white'}`}>{icon}{children}</span>
);
const WCard = ({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) => (
  <div className="rounded-lg border border-[#e3e9e6] bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e3e9e6] px-3 py-2"><b className="text-[12px]">{title}</b><div className="flex flex-wrap gap-1.5">{actions}</div></div>
    <div className="space-y-2.5 p-3">{children}</div>
  </div>
);

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
            <a href="#status" className="rounded-md px-3 py-1.5 text-muted hover:bg-hover hover:text-ink">Төлөв</a>
          </nav>
          <button type="button" onClick={() => window.print()} className="hidden items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-hover sm:inline-flex"><Printer size={14} /> Хэвлэх</button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="py-12">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-bold text-brand"><BookOpen size={14} /> Ажилтанд зориулсан</p>
          <h1 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[42px]">Ажил гүйцэтгэлийн акт хэрхэн үүсгэх вэ?</h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-muted">
            Ажлаа дуусгаад актаа <b className="text-ink">Gennetex утасны апп</b>-аас эсвэл компьютерээс <b className="text-ink">akt.gennetex.com</b>-оос үүсгэнэ. Зураг дээрх <span className="font-bold text-[#e5484d]">улаан хайрцаг, дугаар, сум</span> нь хаана дарахыг заана.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[[Smartphone, 'Утасны апп', 'Талбай дээрээ шууд — зураг авч, илгээнэ', '#app'], [Globe, 'akt.gennetex.com', 'Компьютерээс — PDF / Word, гарын үсэг', '#web'], [Check, 'Актын төлөв', 'Ноорог → Илгээсэн → Баталгаажсан', '#status']].map(([I, t, d, h]) => {
              const Icon = I as typeof Smartphone;
              return (
                <a key={t as string} href={h as string} className="surface flex items-start gap-3 p-4 hover:border-[var(--border-strong)]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={20} /></span>
                  <span><b className="block text-[14px] text-ink">{t as string}</b><span className="text-[12px] text-muted">{d as string}</span></span>
                </a>
              );
            })}
          </div>
          <Tip>Акт бичих эрхгүй бол «Акт бичих» цэс харагдахгүй — ахлагч эсвэл системийн админд хандаж эрх авна уу. Актыг зөвхөн <b>Захирал</b> баталгаажуулна.</Tip>
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

        <Step wide n="1" title="akt.gennetex.com-д Google-ээр нэвтэрнэ" shot={
          <Browser url="https://akt.gennetex.com">
            <div className="mx-auto mt-6 max-w-xs rounded-xl border border-[#e3e9e6] bg-white p-5 text-center">
              <p className="text-[15px] font-bold">Тавтай морил</p>
              <p className="mb-4 text-[11px] text-[#5f6d67]">Байгууллагын Google хаягаараа нэвтэрнэ үү.</p>
              <Mark n={1} note="Google данс" side="right"><span className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#dadce0] bg-white text-[12px] font-semibold"><GoogleIcon size={16} />Google-ээр нэвтрэх</span></Mark>
            </div>
          </Browser>
        }>
          <Li n={1}>Хөтчөөр <b className="text-ink">akt.gennetex.com</b>-г нээж, <b className="text-ink">«Google-ээр нэвтрэх»</b> дарна. Апп-д нэвтэрдэг Gmail-ээ сонгоно.</Li>
        </Step>

        <Step wide n="2" title="«Акт үүсгэх» товчийг дарна" shot={
          <Browser url="https://akt.gennetex.com/admin/documents/acts">
            <div className="flex items-center justify-between"><b className="text-[15px]">Актын бүртгэл</b><Mark n={1} note="Шинэ акт" side="bottom"><WBtn icon={<FilePlus2 size={13} />}>Акт үүсгэх</WBtn></Mark></div>
            <div className="flex gap-2"><span className="flex h-8 flex-1 items-center gap-1.5 rounded-md border border-[#d9e1dd] bg-white px-2 text-[11px] text-[#5f6d67]"><Search size={12} />Хайх…</span></div>
            {['АКТ-2026-0142 · Сүлжээний угсралт', 'АКТ-2026-0141 · Шилэн кабель'].map((t) => <div key={t} className="rounded-md border border-[#e3e9e6] bg-white px-3 py-2 text-[11px]">{t}</div>)}
          </Browser>
        }>
          <Li n={1}>Баруун дээрх <b className="text-ink">«Акт үүсгэх»</b> дарна.</Li>
        </Step>

        <Step wide n="3" title="Төсөл сонгох эсвэл гараар үүсгэх" shot={
          <Browser url="https://akt.gennetex.com/admin/documents/acts/new">
            <WCard title="Акт үүсгэх">
              <div className="rounded-md border border-[#bfe3d3] bg-[#e8f6ef] p-3">
                <p className="text-[12px] font-semibold">Эхлээд төсөл / объект / ажлын захиалга сонгоно уу</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Mark n={1} note="Төсөл сонгох" side="top" className="min-w-[160px] flex-1"><WField label="" value="Төсөл / Объект сонгох" select /></Mark>
                  <Mark n={2} note="Гараар" side="right"><WBtn outline>Гараар үүсгэх</WBtn></Mark>
                </div>
              </div>
            </WCard>
          </Browser>
        }>
          <Li n={1}><b className="text-ink">Төсөл / Объект</b>-оо сонговол захиалагч, хаяг, огноо, ажил <b className="text-ink">автоматаар бөглөгдөнө</b>.</Li>
          <Li n={2}>Жагсаалтад байхгүй бол <b className="text-ink">«Гараар үүсгэх»</b> дарна.</Li>
        </Step>

        <Step wide n="4" title="1.1 Үндсэн мэдээлэл" shot={
          <Browser url="https://akt.gennetex.com/admin/documents/acts/…/edit">
            <div className="flex gap-4 border-b border-[#e3e9e6] text-[11px] font-semibold">{['Үндсэн мэдээлэл', 'Хүлээлцэх хүмүүс', 'Урьдчилан харах', 'PDF / Word'].map((t, i) => <span key={t} className={`pb-2 ${i === 0 ? 'border-b-2 border-[#0c8a62] text-[#0c8a62]' : 'text-[#5f6d67]'}`}>{i + 1}. {t}</span>)}</div>
            <WCard title="1.1 Үндсэн мэдээлэл">
              <div className="grid grid-cols-2 gap-2.5">
                <Mark n={1} note="Загвар, төрөл" side="left"><WField label="Актын загвар" req select value="Ажил гүйцэтгэлийн акт" /></Mark>
                <WField label="Актын төрөл" req select value="Ажил гүйцэтгэлийн акт" />
                <WField label="Төсөл / Объект" req value="Сүлжээний угсралт" />
                <WField label="Хаяг / Байршил" req value="БЗД, 26-р хороо" />
                <Mark n={2} note="Захиалагч" side="left"><WField label="Захиалагч байгууллага" req select value="Юнивишн" /></Mark>
                <WField label="Ажил дууссан хугацаа" value="2026-10-19" />
              </div>
              <Mark n={3} note="Гүйцэтгэсэн ажил" side="bottom"><WField label="Гүйцэтгэсэн ажил" req tall value="…" /></Mark>
            </WCard>
          </Browser>
        }>
          <Li n={1}><b className="text-ink">Актын загвар, төрөл</b>-ийг сонгоно.</Li>
          <Li n={2}>Төсөл, хаяг, <b className="text-ink">захиалагч</b>, огноог шалгаж бөглөнө.</Li>
          <Li n={3}><b className="text-ink">Гүйцэтгэсэн ажил</b>-аа бичнэ. Улаан <b className="text-[#e5484d]">*</b> тэмдэгтэй талбар заавал.</Li>
        </Step>

        <Step wide n="5" title="1.2 Материал ба 1.3 Шаардлага" shot={
          <Browser url="https://akt.gennetex.com/admin/documents/acts/…/edit">
            <WCard title="1.2 Материал" actions={<>
              <Mark n={1} note="ERP-с татах" side="left"><WBtn outline icon={<CloudDownload size={12} />}>ERP-с материал татах</WBtn></Mark>
              <Mark n={2} note="Гараар нэмэх" side="top"><WBtn icon={<Plus size={12} />}>Материал нэмэх</WBtn></Mark>
            </>}>
              <div className="grid grid-cols-3 gap-2"><WField label="Бараа материал" value="Шилэн кабель" /><WField label="Хэмжих нэгж" value="м" /><WField label="Тоо хэмжээ" value="120" /></div>
            </WCard>
            <WCard title="1.3 Ажил гүйцэтгэхэд баримтлах шаардлага">
              <div className="grid grid-cols-2 gap-2"><WField label="Шаардлага" value="Холболтыг хэмжсэн" /><Mark n={3} note="Тийм/Үгүй/N/A" side="left"><WField label="Төлөв" select value="✓ Тийм" /></Mark></div>
            </WCard>
          </Browser>
        }>
          <Li n={1}><b className="text-ink">«ERP-с материал татах»</b> — агуулахаас олгосон материалыг автоматаар авна.</Li>
          <Li n={2}>Эсвэл <b className="text-ink">«Материал нэмэх»</b>-ээр гараар нэмнэ.</Li>
          <Li n={3}>Шаардлага бүрт <b className="text-ink">Тийм / Үгүй / N/A</b>; «Үгүй» бол шалтгаан заавал.</Li>
        </Step>

        <Step wide n="6" title="1.4 Ажлын зураг" shot={
          <Browser url="https://akt.gennetex.com/admin/documents/acts/…/edit">
            <WCard title="1.4 Ажлын зураг" actions={<>
              <Mark n={1} note="ERP зураг" side="left"><WBtn outline icon={<ImagePlus size={12} />}>ERP-с зураг сонгох</WBtn></Mark>
              <Mark n={2} note="Компьютерээс" side="top"><WBtn icon={<Upload size={12} />}>Зураг upload</WBtn></Mark>
            </>}>
              <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((i) => <div key={i}><span className="grid h-16 place-items-center rounded bg-[#dfe7e3] text-[#5f6d67]"><ImageIcon size={18} /></span>{i === 1 ? <Mark n={3} note="Тайлбар" side="bottom" className="mt-1.5"><WField label="" value="Зургийн тайлбар" /></Mark> : <div className="mt-1.5"><WField label="" value="Тайлбар" /></div>}</div>)}</div>
            </WCard>
          </Browser>
        }>
          <Li n={1}><b className="text-ink">«ERP-с зураг сонгох»</b> — апп-аар авсан ажлын зургаас сонгоно.</Li>
          <Li n={2}><b className="text-ink">«Зураг upload»</b> — компьютерээс оруулна.</Li>
          <Li n={3}>Зураг бүрт <b className="text-ink">тайлбар</b> бичнэ. Чирж дарааллыг өөрчилнө.</Li>
        </Step>

        <Step wide n="7" title="2. Хүлээлцэх хүмүүс ба гарын үсэг" shot={
          <Browser url="https://akt.gennetex.com/admin/documents/acts/…/edit">
            <WCard title="2. Хүлээлцэх хүмүүс" actions={<Mark n={1} note="Хүн нэмэх" side="left"><WBtn icon={<Plus size={12} />}>Хүн нэмэх</WBtn></Mark>}>
              <div className="grid grid-cols-2 gap-2"><WField label="Хүлээлцэх хэсэг" req select value="Захиалагч" /><WField label="Нэр" req value="Д.Болд" /></div>
              <div className="rounded-md border border-[#e3e9e6] bg-[#f8faf9] p-2.5">
                <p className="mb-1.5 text-[10px] font-semibold text-[#5f6d67]">Гарын үсэг</p>
                <div className="flex flex-wrap gap-1.5"><WBtn outline icon={<Upload size={12} />}>Upload</WBtn><Mark n={2} note="Зурах" side="right"><WBtn outline icon={<Signature size={12} />}>Зурах</WBtn></Mark></div>
              </div>
            </WCard>
          </Browser>
        }>
          <Li n={1}><b className="text-ink">«Хүн нэмэх»</b> — захиалагч, хүлээлцэгчийг нэмнэ (хадгалсан хүн эсвэл ERP ажилтнаас сонгож болно).</Li>
          <Li n={2}>Гарын үсгийг <b className="text-ink">«Зурах»</b>-аар дэлгэц дээр зурна эсвэл зураг upload хийнэ.</Li>
        </Step>

        <Step wide n="8" title="Урьдчилан харж, хадгалж, илгээнэ" shot={
          <Browser url="https://akt.gennetex.com/admin/documents/acts/…/edit">
            <div className="mx-auto h-40 w-32 rounded border border-[#d9e1dd] bg-white p-2 shadow"><div className="mb-1 h-2 w-16 rounded bg-[#d9e1dd]" /><div className="space-y-1">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-1.5 rounded bg-[#eef2f0]" />)}</div></div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e3e9e6] pt-3">
              <WBtn outline icon={<ChevronLeft size={12} />}>Өмнөх</WBtn>
              <div className="flex gap-2">
                <Mark n={1} note="Хадгалах" side="top"><WBtn outline icon={<Save size={12} />}>Хадгалах</WBtn></Mark>
                <Mark n={2} note="Дараагийн алхам" side="top"><WBtn icon={<ArrowRight size={12} />}>Дараах</WBtn></Mark>
              </div>
            </div>
            <WCard title="4. PDF / Word үүсгэх">
              <div className="flex flex-wrap gap-1.5"><WBtn icon={<Download size={12} />}>PDF татах</WBtn><WBtn outline icon={<FileText size={12} />}>Word татах</WBtn><WBtn outline icon={<Printer size={12} />}>Хэвлэх</WBtn>
                <Mark n={3} note="Захиралд илгээх" side="bottom"><WBtn outline icon={<Check size={12} />}>Бэлэн болгох</WBtn></Mark>
              </div>
            </WCard>
          </Browser>
        }>
          <Li n={1}><b className="text-ink">«Хадгалах»</b> — алхам бүрт хадгална.</Li>
          <Li n={2}><b className="text-ink">«Дараах»</b> — дараагийн алхам руу (Урьдчилан харах → PDF / Word).</Li>
          <Li n={3}>Бүх зүйл зөв бол <b className="text-ink">«Бэлэн болгох»</b> дарж Захиралд илгээнэ. PDF / Word-оор татаж, хэвлэж болно.</Li>
        </Step>

        {/* ═══════════════ ТӨЛӨВ ═══════════════ */}
        <section id="status" className="scroll-mt-20 border-t border-line pt-12">
          <h2 className="text-[26px] font-bold text-ink"><Check className="mr-2 inline text-brand" size={26} />Актын төлөв</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[['Ноорог', 'Хадгалсан, дуусаагүй. Та засаж болно.', '#eef2f0', '#45534d'], ['Илгээсэн / Бэлэн', 'Захиралд баталгаажуулахаар очсон.', '#e1ecff', '#2160c4'], ['Баталгаажсан', 'Захирал баталсан — тамга, гарын үсэгтэй PDF гарна.', '#e0f5ea', '#0f8150'], ['Хүлээлгэн өгсөн', 'Захиалагчид хүлээлгэн өгсөн, архивт.', '#fff1d6', '#9a5800']].map(([t, d, bg, fg], i) => (
              <div key={t} className="surface p-4">
                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>{i + 1}. {t}</span>
                <p className="mt-3 text-[13px] leading-5 text-muted">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2">
            <Tip>Актыг зөвхөн <b>Захирал</b> баталгаажуулна. Баталгаажсан актыг өөрчлөх шаардлагатай бол админд хандана.</Tip>
            <Tip>Асуудал гарвал апп дахь «Хөгжүүлэгчтэй холбогдох» эсвэл ахлагчдаа хандана уу.</Tip>
          </div>
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[12px] text-subtle">
          <span>© {new Date().getFullYear()} GENNETEX ХХК · Гарын авлага</span>
          <span className="flex gap-3"><a href="https://akt.gennetex.com" className="inline-flex items-center gap-1 text-brand hover:underline"><LogIn size={13} />akt.gennetex.com</a><a href="#app" className="inline-flex items-center gap-1 text-brand hover:underline"><ChevronRight size={13} />Дээш</a></span>
        </footer>
      </main>
    </div>
  );
}

