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

/* ── Утасны хүрээ ─────────────────────────────────────────────────── */
function Phone({ title, right, children, bottom }: { title: string; right?: ReactNode; children: ReactNode; bottom?: ReactNode }) {
  return (
    <div className="mx-auto w-[300px] shrink-0 rounded-[38px] border-[10px] border-[#1b1d1c] bg-[#1b1d1c] shadow-xl">
      <div className="relative flex h-[560px] flex-col overflow-hidden rounded-[28px] bg-[#f4f7f5] text-[#16201c]">
        <div className="flex items-center justify-between px-5 pb-1 pt-2 text-[10px] font-semibold"><span>9:41</span><span className="h-4 w-16 rounded-full bg-[#1b1d1c]" /><span>100%</span></div>
        <div className="flex items-center gap-2 border-b border-[#e3e9e6] bg-white px-4 py-2.5">
          <ArrowLeft size={18} className="text-[#45534d]" />
          <span className="flex-1 truncate text-[15px] font-bold">{title}</span>
          {right}
        </div>
        <div className="flex-1 space-y-3 overflow-hidden p-3">{children}</div>
        {bottom ? <div className="flex gap-2 border-t border-[#e3e9e6] bg-white p-3">{bottom}</div> : null}
      </div>
    </div>
  );
}
const PField = ({ label, value, req, tall }: { label: string; value?: string; req?: boolean; tall?: boolean }) => (
  <div>
    <p className="mb-1 text-[11px] font-semibold text-[#45534d]">{label}{req ? <b className="text-[#e5484d]"> *</b> : null}</p>
    <div className={`rounded-xl border border-[#d9e1dd] bg-white px-3 text-[12px] text-[#5f6d67] ${tall ? 'h-14 py-2' : 'flex h-9 items-center'}`}>{value || ''}</div>
  </div>
);
const PCard = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) => (
  <div className="rounded-2xl bg-white p-3 shadow-sm">
    <div className="mb-2 flex items-center justify-between"><p className="text-[13px] font-bold">{title}</p>{action}</div>
    <div className="space-y-2">{children}</div>
  </div>
);
const PBtn = ({ children, ghost }: { children: ReactNode; ghost?: boolean }) => (
  <span className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold ${ghost ? 'border border-[#d9e1dd] bg-white text-[#16201c]' : 'bg-[#0c8a62] text-white'}`}>{children}</span>
);

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

        <Step n="1" title="Нүүрээс «Акт бичих»-ийг дарна" shot={
          <Phone title="Нүүр">
            <div className="rounded-2xl bg-[#0c8a62] p-4 text-white"><p className="text-[11px] opacity-80">Өнөөдөр</p><p className="text-[16px] font-bold">Сайн байна уу!</p></div>
            <div className="grid grid-cols-3 gap-2">
              {['Ирц', 'Хүсэлт', 'Тайлан', 'Агуулах', 'Хурал'].map((t) => (
                <div key={t} className="flex flex-col items-center gap-1 rounded-2xl bg-white p-2.5 shadow-sm"><span className="h-8 w-8 rounded-full bg-[#e6ece9]" /><span className="text-[10px] font-semibold">{t}</span></div>
              ))}
              <Mark n={1} note="Энд дарна" side="bottom">
                <div className="flex flex-col items-center gap-1 rounded-2xl bg-white p-2.5 shadow-sm"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#dcf5e9] text-[#0b7a57]"><FileText size={16} /></span><span className="text-[10px] font-semibold">Акт бичих</span></div>
              </Mark>
            </div>
          </Phone>
        }>
          <Li n={1}>Gennetex апп-ыг нээгээд нүүр хуудасны <b className="text-ink">«Акт бичих»</b> цэс дээр дарна.</Li>
        </Step>

        <Step n="2" title="«+ Шинэ» товчоор шинэ акт эхлүүлнэ" shot={
          <Phone title="Акт" right={<Mark n={1} note="Шинэ акт" side="bottom"><span className="flex items-center gap-1 rounded-full bg-[#0c8a62] px-3 py-1 text-[11px] font-semibold text-white"><Plus size={13} /> Шинэ</span></Mark>}>
            <div className="flex gap-1.5">
              {['Ноорог 2', 'Илгээсэн 1', 'Баталгаажсан 5'].map((t, i) => <span key={t} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${i === 0 ? 'bg-[#16201c] text-white' : 'bg-white text-[#45534d]'}`}>{t}</span>)}
            </div>
            {['Сүлжээний угсралт', 'Шилэн кабель татах'].map((t) => (
              <div key={t} className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-[13px] font-semibold">{t}</p><p className="text-[10px] text-[#5f6d67]">Ноорог · 2026-10-18</p></div>
            ))}
          </Phone>
        }>
          <Li n={1}>Баруун дээд буланд байрлах <b className="text-ink">«+ Шинэ»</b> товчийг дарна.</Li>
          <p>Дээрх табуудаас өмнө үүсгэсэн актаа (Ноорог, Илгээсэн, Баталгаажсан) харж болно.</p>
        </Step>

        <Step n="3" title="Толгой мэдээллээ бөглөнө" shot={
          <Phone title="Шинэ акт">
            <PCard title="Толгой мэдээлэл">
              <Mark n={1} note="Ажлын нэр" side="right"><PField label="Ажлын нэр" req value="Ж: Сүлжээний угсралт" /></Mark>
              <Mark n={2} note="Захиалагч сонгох" side="right">
                <div><p className="mb-1 text-[11px] font-semibold text-[#45534d]">Захиалагч байгууллага</p><div className="flex gap-1.5">{['Юнивишн', 'Скаймедиа', 'Айл'].map((c, i) => <span key={c} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${i === 0 ? 'bg-[#0c8a62] text-white' : 'border border-[#d9e1dd] bg-white'}`}>{c}</span>)}</div></div>
              </Mark>
              <PField label="Байршил" value="Дүүрэг, хороо, хаяг" />
              <div className="flex gap-2"><div className="flex-1"><PField label="Эхэлсэн" value="2026-10-19" /></div><div className="flex-1"><PField label="Дууссан" value="2026-10-19" /></div></div>
              <Mark n={3} note="Хийсэн ажил" side="right"><PField label="Хийсэн ажил" req tall value="Ямар ажил гүйцэтгэснээ дэлгэрэнгүй бичнэ үү" /></Mark>
            </PCard>
          </Phone>
        }>
          <Li n={1}><b className="text-ink">Ажлын нэр</b> — заавал (ж: «Сүлжээний угсралт»).</Li>
          <Li n={2}><b className="text-ink">Захиалагч</b> — жагсаалтаас дарж сонгоно, байхгүй бол доор нь нэрийг бичнэ.</Li>
          <Li n={3}><b className="text-ink">Хийсэн ажил</b> — юу хийснээ дэлгэрэнгүй бичнэ (заавал).</Li>
          <p>Байршил, эхэлсэн / дууссан огноог мөн бөглөнө.</p>
        </Step>

        <Step n="4" title="Ашигласан бараа материалаа нэмнэ" shot={
          <Phone title="Шинэ акт">
            <PCard title="Бараа материал" action={<Mark n={1} note="Мөр нэмэх" side="top"><span className="text-[12px] font-semibold text-[#0c8a62]">+ Мөр нэмэх</span></Mark>}>
              <div className="rounded-xl border border-[#e3e9e6] p-2.5">
                <div className="mb-1.5 flex justify-between text-[11px]"><b>Материал 1</b><span className="text-[#e5484d]">Устгах</span></div>
                <Mark n={2} note="Нэр, тоо, нэгж" side="right">
                  <div className="space-y-1.5"><PField label="Нэр" value="Шилэн кабель" /><div className="flex gap-2"><div className="flex-1"><PField label="Тоо" value="120" /></div><div className="flex-1"><PField label="Нэгж" value="м" /></div></div></div>
                </Mark>
              </div>
            </PCard>
          </Phone>
        }>
          <Li n={1}><b className="text-ink">«+ Мөр нэмэх»</b> дарж материал бүрийг нэмнэ.</Li>
          <Li n={2}>Материалын <b className="text-ink">нэр, тоо, нэгж</b>-ийг бичнэ. Буруу мөрийг «Устгах»-аар арилгана.</Li>
          <Tip>Материал ашиглаагүй бол энэ хэсгийг хоосон үлдээнэ.</Tip>
        </Step>

        <Step n="5" title="Шалгах хуудсыг бөглөнө" shot={
          <Phone title="Шинэ акт">
            <PCard title="Шалгах хуудас">
              <div className="rounded-xl border border-[#e3e9e6] p-2.5">
                <p className="mb-2 text-[12px]">Ажлын байрыг цэвэрлэж хүлээлгэн өгсөн</p>
                <Mark n={1} note="Тийм / Үгүй" side="right">
                  <div className="flex rounded-full bg-[#eef2f0] p-1 text-[11px] font-semibold"><span className="flex-1 rounded-full bg-[#0c8a62] py-1 text-center text-white">Тийм</span><span className="flex-1 py-1 text-center">Үгүй</span></div>
                </Mark>
              </div>
              <div className="rounded-xl border border-[#e3e9e6] p-2.5">
                <p className="mb-2 text-[12px]">Холболтыг шалгаж хэмжилт хийсэн</p>
                <div className="flex rounded-full bg-[#eef2f0] p-1 text-[11px] font-semibold"><span className="flex-1 py-1 text-center">Тийм</span><span className="flex-1 rounded-full bg-[#e5484d] py-1 text-center text-white">Үгүй</span></div>
                <Mark n={2} note="Шалтгаан" side="right" className="mt-2"><PField label="" value="Шалтгаан" /></Mark>
              </div>
            </PCard>
          </Phone>
        }>
          <Li n={1}>Шаардлага бүрт <b className="text-ink">«Тийм»</b> эсвэл <b className="text-ink">«Үгүй»</b>-г сонгоно.</Li>
          <Li n={2}>«Үгүй» сонгосон бол <b className="text-ink">шалтгааныг заавал</b> бичнэ.</Li>
        </Step>

        <Step n="6" title="Ажлын зураг оруулна" shot={
          <Phone title="Шинэ акт">
            <PCard title="Зураг">
              <div className="grid grid-cols-3 gap-1.5">{[0, 1].map((i) => <span key={i} className="grid aspect-square place-items-center rounded-lg bg-[#dfe7e3] text-[#5f6d67]"><ImageIcon size={18} /></span>)}
                <Mark n={1} note="Камераар" side="bottom"><span className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[#9fb3aa] text-[10px] font-semibold"><Camera size={16} />Камер</span></Mark>
              </div>
              <Mark n={2} note="Галерейгаас" side="right" className="mt-6 w-1/3"><span className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[#9fb3aa] text-[10px] font-semibold"><Images size={16} />Сангаас</span></Mark>
            </PCard>
          </Phone>
        }>
          <Li n={1}><b className="text-ink">«Камер»</b> — шууд зураг авна.</Li>
          <Li n={2}><b className="text-ink">«Сангаас»</b> — утсандаа байгаа зургаас сонгоно.</Li>
          <Tip>Ажлын өмнөх, дараах байдал, холболт, хэмжилтийн зургийг оруулбал акт хурдан баталгаажна.</Tip>
        </Step>

        <Step n="7" title="Хүлээлцэх хүмүүсийг шалгаад илгээнэ" shot={
          <Phone title="Шинэ акт" bottom={<>
            <Mark n={1} note="Ноорог" side="top" className="flex-1"><PBtn ghost><Save size={14} />Хадгалах</PBtn></Mark>
            <Mark n={2} note="Захиралд илгээх" side="top" className="flex-[1.4]"><PBtn><Send size={14} />Илгээх</PBtn></Mark>
          </>}>
            <PCard title="Хүлээлцэх хүмүүс">
              {[['Б.Баясгалан', 'Захирал · Женнетекс', true], ['Мөнхбат', 'Хүлээлцэгч', false], ['Захиалагчийн төлөөлөл', 'Юнивишн', false]].map(([n, p, tag]) => (
                <div key={n as string} className="flex items-center gap-2 rounded-xl border border-[#e3e9e6] p-2"><Users size={16} className="text-[#5f6d67]" /><span className="min-w-0 flex-1"><b className="block text-[12px]">{n as string}</b><span className="text-[10px] text-[#5f6d67]">{p as string}</span></span>{tag ? <span className="rounded-full bg-[#fff0d3] px-2 py-0.5 text-[9px] font-semibold text-[#9a5800]">Тамга</span> : null}</div>
              ))}
            </PCard>
          </Phone>
        }>
          <p>Хүлээлцэх хүмүүс (Захирал, хүлээлцэгч, захиалагч) автоматаар нэмэгдэнэ — зөв эсэхийг шалгана.</p>
          <Li n={1}><b className="text-ink">«Хадгалах»</b> — дуусаагүй бол ноорог болгон хадгална, дараа үргэлжлүүлнэ.</Li>
          <Li n={2}><b className="text-ink">«Илгээх»</b> — бүрэн бол дарна. Акт <b className="text-ink">Захиралд</b> баталгаажуулахаар очно.</Li>
        </Step>

        <Step n="8" title="Актаа хянах, засах" shot={
          <Phone title="Акт" right={<Mark n={2} note="Засах" side="bottom"><span className="flex items-center gap-1 rounded-full bg-[#e6ece9] px-3 py-1 text-[11px] font-semibold"><PenLine size={12} />Засах</span></Mark>}>
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between"><b className="text-[14px]">Сүлжээний угсралт</b>
                <Mark n={1} note="Төлөв" side="bottom"><span className="rounded-full bg-[#e1ecff] px-2 py-0.5 text-[10px] font-semibold text-[#2160c4]">Илгээсэн</span></Mark>
              </div>
              <p className="mt-1 text-[11px] text-[#5f6d67]">АКТ-2026-0142 · Юнивишн</p>
            </div>
            <div className="rounded-2xl bg-white p-3 text-[12px] text-[#45534d] shadow-sm">Хийсэн ажил, материал, зураг, хүлээлцэх хүмүүс энд харагдана.</div>
          </Phone>
        }>
          <Li n={1}>Актын <b className="text-ink">төлөв</b>: Ноорог → Илгээсэн → Баталгаажсан.</Li>
          <Li n={2}>Ноорог үед <b className="text-ink">«Засах»</b>-аар өөрчилнө.</Li>
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

