import { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Send, Trash2 } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { submitJobApplication } from '../lib/submitApplication';
import {
  JOB_APPLICATION_RULES,
  JOB_APPLICATION_RULES_TITLE,
  JOB_CONSENT_LABEL,
} from '../lib/jobApplicationRules';
import { emptyForm, type JobApplicationFormData } from '../types/jobApplication';

const STEPS = [
  { id: 'general', num: '1', title: 'Ерөнхий мэдээлэл', short: 'Үндсэн' },
  { id: 'family', num: '2', title: 'Гэр бүл, боловсрол', short: 'Гэр бүл' },
  { id: 'work', num: '3', title: 'Туршлага, хүсэлт', short: 'Туршлага' },
  { id: 'finish', num: '4', title: 'Баталгаажуулах', short: 'Дуусгах' },
];

const inputCls = 'job-input';
const labelCls = 'job-label';
const sectionCls = 'job-section';

function Field({
  children,
  title,
  required,
  className = '',
}: {
  children: React.ReactNode;
  title: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>
        {title}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3 border-b border-graphite-700/80 pb-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-sm font-bold text-accent">
        {num}
      </span>
      <h3 className="text-base font-semibold uppercase tracking-wide text-graphite-100 sm:text-lg">{title}</h3>
    </div>
  );
}

function YesNo({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (v: 'Тийм' | 'Үгүй') => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      {(['Тийм', 'Үгүй'] as const).map((v) => (
        <label
          key={v}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 transition-colors ${
            value === v
              ? 'border-accent bg-accent/10 text-graphite-50'
              : 'border-graphite-700 text-graphite-400 hover:border-graphite-600'
          }`}
        >
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="accent-accent" />
          {v}
        </label>
      ))}
    </div>
  );
}

function RowCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={sectionCls}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-graphite-200">{title}</span>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-graphite-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            aria-label="Устгах"
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-dashed border-graphite-600 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/5"
    >
      <Plus size={16} />
      {children}
    </button>
  );
}

export default function JobApplicationForm({ embedded = false }: { embedded?: boolean }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<JobApplicationFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [rulesRead, setRulesRead] = useState(false);
  const rulesScrollRef = useRef<HTMLDivElement>(null);

  const SCROLL_END = 40;

  const checkRulesScroll = useCallback(() => {
    const el = rulesScrollRef.current;
    if (!el || rulesRead) return;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_END;
    if (atEnd) setRulesRead(true);
  }, [rulesRead]);

  const onRulesScroll = () => checkRulesScroll();

  const onRulesRef = (el: HTMLDivElement | null) => {
    rulesScrollRef.current = el;
    if (el && !rulesRead) {
      requestAnimationFrame(() => {
        if (el.scrollHeight <= el.clientHeight + SCROLL_END) setRulesRead(true);
      });
    }
  };

  const setGeneral = (patch: Partial<JobApplicationFormData['general']>) =>
    setForm((f) => ({ ...f, general: { ...f.general, ...patch } }));

  const progress = ((step + 1) / STEPS.length) * 100;

  const validateStep = (): string | null => {
    const g = form.general;
    if (step === 0) {
      if (!g.firstName.trim()) return 'Өөрийн нэрээ оруулна уу.';
      if (!g.fatherName.trim()) return 'Эцэг (эх)-ийн нэрийг оруулна уу.';
      if (!g.phoneMobile.trim()) return 'Утасны дугаараа оруулна уу.';
      if (!g.registrationNo.trim()) return 'Регистрийн дугаараа оруулна уу.';
    }
    if (step === 3) {
      if (!rulesRead) return 'Журмыг доош гүйлгэж бүрэн уншина уу.';
      if (!form.consent) return 'Журмыг зөвшөөрч тэмдэглэнэ үү.';
      if (!form.signatureSvg.trim()) return 'Гарын үсэг зурна уу.';
      const ok = form.emergencyContacts.some((e) => e.name.trim() && e.phone.trim());
      if (!ok) return 'Яаралтай холбоо барих хүний мэдээлэл оруулна уу.';
    }
    return null;
  };

  const next = () => {
    setMsg(null);
    const err = validateStep();
    if (err) {
      setMsg({ type: 'err', text: err });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    setMsg(null);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onPhoto = (file: File | null) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Зураг 3MB-аас бага байх ёстой.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setGeneral({ photoDataUrl: String(reader.result || '') });
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setMsg(null);
    const err = validateStep();
    if (err) {
      setMsg({ type: 'err', text: err });
      return;
    }
    setLoading(true);
    try {
      await submitJobApplication({ ...form, signedAt: new Date().toISOString() });
      setForm(emptyForm());
      setStep(0);
      setRulesRead(false);
      setMsg({ type: 'ok', text: 'Амжилттай илгээгдлээ. Баярлалаа!' });
    } catch (ex) {
      setMsg({ type: 'err', text: ex instanceof Error ? ex.message : 'Илгээхэд алдаа гарлаа.' });
    } finally {
      setLoading(false);
    }
  };

  const StepNav = ({ className = '' }: { className?: string }) => (
    <div className={`flex flex-col-reverse gap-3 sm:flex-row sm:justify-between ${className}`}>
      {step > 0 ? (
        <button
          type="button"
          onClick={back}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-graphite-700 py-3 text-sm font-medium text-graphite-200 transition-colors hover:bg-graphite-800 sm:max-w-[200px] sm:flex-none"
        >
          <ChevronLeft size={18} />
          Буцах
        </button>
      ) : (
        <div className="hidden sm:block sm:w-[200px]" />
      )}
      {step < STEPS.length - 1 ? (
        <button
          type="button"
          onClick={next}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-opacity hover:opacity-90 sm:ml-auto sm:max-w-[240px] sm:flex-none"
        >
          Дараах
          <ChevronRight size={18} />
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-opacity hover:opacity-90 disabled:opacity-50 sm:ml-auto sm:max-w-[240px] sm:flex-none"
        >
          <Send size={16} />
          {loading ? 'Илгээж байна...' : 'Анкет илгээх'}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      {!embedded ? (
        <div className="border-b border-graphite-800 bg-graphite-900/80 px-4 py-6 text-center sm:px-8 sm:py-8">
          <img src="/logo.png" alt="" className="mx-auto mb-4 h-12 object-contain sm:h-14" />
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-graphite-500">{form.company}</p>
          <h2 className="mt-2 text-lg font-semibold text-graphite-50 sm:text-xl">{form.title}</h2>
          <p className="mt-1 text-sm text-graphite-400">{STEPS[step].title}</p>
        </div>
      ) : null}

      {/* Алхам — mobile scroll + desktop row */}
      <div className="border-b border-graphite-800 px-4 py-4 sm:px-6">
        {embedded ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-graphite-500">{form.company}</p>
            <p className="text-sm text-graphite-400">{STEPS[step].title}</p>
          </div>
        ) : null}
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-graphite-800">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-2 sm:overflow-visible">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex min-w-[5.5rem] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-center transition-colors sm:min-w-0 ${
                i === step
                  ? 'bg-accent/15 text-accent'
                  : i < step
                    ? 'text-graphite-300 hover:bg-graphite-800'
                    : 'text-graphite-600'
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  i <= step ? 'bg-accent text-white' : 'bg-graphite-800 text-graphite-500'
                }`}
              >
                {i + 1}
              </span>
              <span className="text-[10px] font-medium leading-tight sm:text-xs">{s.short}</span>
            </button>
          ))}
        </div>
        <StepNav className="mt-4 border-t border-graphite-800 pt-4" />
      </div>

      {/* Агуулга */}
      <div className="min-h-[min(60vh,520px)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {step === 0 && (
          <div className="space-y-6">
            <SectionHead num="1" title="Ерөнхий мэдээлэл" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field title="Ургийн овог">
                <input className={inputCls} value={form.general.clanName} onChange={(e) => setGeneral({ clanName: e.target.value })} />
              </Field>
              <Field title="Эцэг (эх)-ийн нэр" required>
                <input className={inputCls} value={form.general.fatherName} onChange={(e) => setGeneral({ fatherName: e.target.value })} />
              </Field>
              <Field title="Өөрийн нэр" required>
                <input className={inputCls} value={form.general.firstName} onChange={(e) => setGeneral({ firstName: e.target.value })} />
              </Field>
              <Field title="Регистрийн дугаар" required>
                <input className={inputCls} value={form.general.registrationNo} onChange={(e) => setGeneral({ registrationNo: e.target.value })} />
              </Field>
              <Field title="Утас (гар)" required>
                <input className={inputCls} type="tel" value={form.general.phoneMobile} onChange={(e) => setGeneral({ phoneMobile: e.target.value })} />
              </Field>
              <Field title="И-мэйл">
                <input className={inputCls} type="email" value={form.general.email} onChange={(e) => setGeneral({ email: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field title="Төрсөн он">
                <input className={inputCls} inputMode="numeric" value={form.general.birthYear} onChange={(e) => setGeneral({ birthYear: e.target.value })} />
              </Field>
              <Field title="Сар">
                <input className={inputCls} inputMode="numeric" value={form.general.birthMonth} onChange={(e) => setGeneral({ birthMonth: e.target.value })} />
              </Field>
              <Field title="Өдөр">
                <input className={inputCls} inputMode="numeric" value={form.general.birthDay} onChange={(e) => setGeneral({ birthDay: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field title="Төрсөн аймаг/хот">
                <input className={inputCls} value={form.general.birthProvince} onChange={(e) => setGeneral({ birthProvince: e.target.value })} />
              </Field>
              <Field title="Сум/дүүрэг">
                <input className={inputCls} value={form.general.birthDistrict} onChange={(e) => setGeneral({ birthDistrict: e.target.value })} />
              </Field>
              <Field title="Хүйс">
                <select className={inputCls} value={form.general.gender} onChange={(e) => setGeneral({ gender: e.target.value as 'Эрэгтэй' | 'Эмэгтэй' | '' })}>
                  <option value="">Сонгох</option>
                  <option value="Эрэгтэй">Эрэгтэй</option>
                  <option value="Эмэгтэй">Эмэгтэй</option>
                </select>
              </Field>
              <Field title="Цусны бүлэг">
                <input className={inputCls} value={form.general.bloodType} onChange={(e) => setGeneral({ bloodType: e.target.value })} placeholder="ж: I, II, III, IV" />
              </Field>
            </div>

            <Field title="Оршин суугаа хаяг" className="sm:col-span-2">
              <input className={inputCls} value={form.general.address} onChange={(e) => setGeneral({ address: e.target.value })} />
            </Field>

            <div className={`${sectionCls} grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]`}>
              <div>
                {form.general.photoDataUrl ? (
                  <img src={form.general.photoDataUrl} alt="Зураг" className="aspect-[3/4] w-full max-w-[140px] rounded-lg border border-graphite-600 object-cover" />
                ) : (
                  <div className="flex aspect-[3/4] w-full max-w-[140px] items-center justify-center rounded-lg border border-dashed border-graphite-600 bg-graphite-950/50 text-xs text-graphite-500">
                    3×4 зураг
                  </div>
                )}
              </div>
              <Field title="Зураг хавсаргах">
                <input type="file" accept="image/*" className="text-sm text-graphite-400 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" onChange={(e) => onPhoto(e.target.files?.[0] || null)} />
                <p className="mt-2 text-xs text-graphite-500">JPG/PNG, хамгийн ихдээ 3MB</p>
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <div>
              <SectionHead num="2" title="Гэр бүлийн байдал" />
              <div className="mb-4">
                <span className={labelCls}>Гэрлэсэн эсэх</span>
                <YesNo name="married" value={form.family.married} onChange={(v) => setForm((f) => ({ ...f, family: { ...f.family, married: v } }))} />
              </div>
              <div className="space-y-4">
                {form.family.members.map((m, i) => (
                  <RowCard
                    key={i}
                    title={`Гэр бүлийн гишүүн ${i + 1}`}
                    onRemove={form.family.members.length > 1 ? () => setForm((f) => ({ ...f, family: { ...f.family, members: f.family.members.filter((_, j) => j !== i) } })) : undefined}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <input className={inputCls} placeholder="Овог нэр" value={m.fullName} onChange={(e) => { const members = [...form.family.members]; members[i] = { ...members[i], fullName: e.target.value }; setForm((f) => ({ ...f, family: { ...f.family, members } })); }} />
                      <input className={inputCls} placeholder="Хэн болох" value={m.relation} onChange={(e) => { const members = [...form.family.members]; members[i] = { ...members[i], relation: e.target.value }; setForm((f) => ({ ...f, family: { ...f.family, members } })); }} />
                      <input className={inputCls} placeholder="Төрсөн он" value={m.birthYear} onChange={(e) => { const members = [...form.family.members]; members[i] = { ...members[i], birthYear: e.target.value }; setForm((f) => ({ ...f, family: { ...f.family, members } })); }} />
                      <input className={inputCls} placeholder="Утас" value={m.phone} onChange={(e) => { const members = [...form.family.members]; members[i] = { ...members[i], phone: e.target.value }; setForm((f) => ({ ...f, family: { ...f.family, members } })); }} />
                      <input className={`${inputCls} sm:col-span-2`} placeholder="Ажил/сургууль" value={m.workOrSchool} onChange={(e) => { const members = [...form.family.members]; members[i] = { ...members[i], workOrSchool: e.target.value }; setForm((f) => ({ ...f, family: { ...f.family, members } })); }} />
                    </div>
                  </RowCard>
                ))}
              </div>
              <div className="mt-4">
                <AddBtn onClick={() => setForm((f) => ({ ...f, family: { ...f.family, members: [...f.family.members, { fullName: '', relation: '', birthYear: '', workOrSchool: '', phone: '' }] } }))}>
                  Гишүүн нэмэх
                </AddBtn>
              </div>
            </div>

            <div>
              <SectionHead num="3" title="Боловсролын байдал" />
              <div className="space-y-4">
                {form.education.map((row, i) => (
                  <RowCard
                    key={i}
                    title={`Боловсрол ${i + 1}`}
                    onRemove={form.education.length > 1 ? () => setForm((f) => ({ ...f, education: f.education.filter((_, j) => j !== i) })) : undefined}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <input className={inputCls} placeholder="Байршил/хот" value={row.location} onChange={(e) => { const education = [...form.education]; education[i] = { ...education[i], location: e.target.value }; setForm((f) => ({ ...f, education })); }} />
                      <input className={inputCls} placeholder="Сургуулийн нэр" value={row.schoolName} onChange={(e) => { const education = [...form.education]; education[i] = { ...education[i], schoolName: e.target.value }; setForm((f) => ({ ...f, education })); }} />
                      <input className={inputCls} placeholder="Элссэн он" value={row.enteredYear} onChange={(e) => { const education = [...form.education]; education[i] = { ...education[i], enteredYear: e.target.value }; setForm((f) => ({ ...f, education })); }} />
                      <input className={inputCls} placeholder="Төгссөн он" value={row.graduatedYear} onChange={(e) => { const education = [...form.education]; education[i] = { ...education[i], graduatedYear: e.target.value }; setForm((f) => ({ ...f, education })); }} />
                      <input className={inputCls} placeholder="Мэргэжил" value={row.profession} onChange={(e) => { const education = [...form.education]; education[i] = { ...education[i], profession: e.target.value }; setForm((f) => ({ ...f, education })); }} />
                      <input className={inputCls} placeholder="Зэрэг" value={row.degree} onChange={(e) => { const education = [...form.education]; education[i] = { ...education[i], degree: e.target.value }; setForm((f) => ({ ...f, education })); }} />
                      <input className={inputCls} placeholder="Голч" value={row.gpa} onChange={(e) => { const education = [...form.education]; education[i] = { ...education[i], gpa: e.target.value }; setForm((f) => ({ ...f, education })); }} />
                    </div>
                  </RowCard>
                ))}
              </div>
              <div className="mt-4">
                <AddBtn onClick={() => setForm((f) => ({ ...f, education: [...f.education, { location: '', schoolName: '', enteredYear: '', graduatedYear: '', profession: '', degree: '', gpa: '' }] }))}>
                  Боловсрол нэмэх
                </AddBtn>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <div>
              <SectionHead num="4" title="Ажлын туршлага" />
              <p className="mb-4 text-sm text-graphite-500">Заавал биш — байвал бөглөнө.</p>
              <div className="space-y-4">
                {form.workExperience.map((row, i) => (
                  <RowCard
                    key={i}
                    title={`Ажил ${i + 1}`}
                    onRemove={form.workExperience.length > 1 ? () => setForm((f) => ({ ...f, workExperience: f.workExperience.filter((_, j) => j !== i) })) : undefined}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <input className={inputCls} placeholder="Байгууллагын нэр" value={row.companyName} onChange={(e) => { const workExperience = [...form.workExperience]; workExperience[i] = { ...workExperience[i], companyName: e.target.value }; setForm((f) => ({ ...f, workExperience })); }} />
                      <input className={inputCls} placeholder="Албан тушаал" value={row.position} onChange={(e) => { const workExperience = [...form.workExperience]; workExperience[i] = { ...workExperience[i], position: e.target.value }; setForm((f) => ({ ...f, workExperience })); }} />
                      <input className={inputCls} placeholder="Ажилд орсон" value={row.startDate} onChange={(e) => { const workExperience = [...form.workExperience]; workExperience[i] = { ...workExperience[i], startDate: e.target.value }; setForm((f) => ({ ...f, workExperience })); }} />
                      <input className={inputCls} placeholder="Ажлаас гарсан" value={row.endDate} onChange={(e) => { const workExperience = [...form.workExperience]; workExperience[i] = { ...workExperience[i], endDate: e.target.value }; setForm((f) => ({ ...f, workExperience })); }} />
                      <textarea className={`${inputCls} min-h-[80px] resize-y sm:col-span-2`} placeholder="Гүйцэтгэсэн үндсэн ажил" value={row.duties} onChange={(e) => { const workExperience = [...form.workExperience]; workExperience[i] = { ...workExperience[i], duties: e.target.value }; setForm((f) => ({ ...f, workExperience })); }} />
                    </div>
                  </RowCard>
                ))}
              </div>
              <div className="mt-4">
                <AddBtn onClick={() => setForm((f) => ({ ...f, workExperience: [...f.workExperience, { companyName: '', duties: '', position: '', startDate: '', endDate: '', salary: '', leaveReason: '' }] }))}>
                  Туршлага нэмэх
                </AddBtn>
              </div>
            </div>

            <div>
              <SectionHead num="6" title="Хувийн онцлог" />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Field title="Давуу тал">
                  <textarea className={`${inputCls} min-h-[100px] resize-y`} value={form.personal.strengths} onChange={(e) => setForm((f) => ({ ...f, personal: { ...f.personal, strengths: e.target.value } }))} />
                </Field>
                <Field title="Сул тал">
                  <textarea className={`${inputCls} min-h-[100px] resize-y`} value={form.personal.weaknesses} onChange={(e) => setForm((f) => ({ ...f, personal: { ...f.personal, weaknesses: e.target.value } }))} />
                </Field>
              </div>
            </div>

            <div>
              <SectionHead num="7" title="Ажилд орох хүсэлт" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field title="Сонирхож буй албан тушаал">
                  <input className={inputCls} value={form.jobInterest.position} onChange={(e) => setForm((f) => ({ ...f, jobInterest: { ...f.jobInterest, position: e.target.value } }))} />
                </Field>
                <Field title="Хүсэж буй цалин">
                  <input className={inputCls} value={form.jobInterest.desiredSalary} onChange={(e) => setForm((f) => ({ ...f, jobInterest: { ...f.jobInterest, desiredSalary: e.target.value } }))} />
                </Field>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <SectionHead num="8" title="Яаралтай холбоо барих" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {form.emergencyContacts.map((c, i) => (
                <RowCard key={i} title={`Хүн ${i + 1}`}>
                  <input className={inputCls} placeholder="Овог нэр" value={c.name} onChange={(e) => { const emergencyContacts = [...form.emergencyContacts]; emergencyContacts[i] = { ...emergencyContacts[i], name: e.target.value }; setForm((f) => ({ ...f, emergencyContacts })); }} />
                  <input className={inputCls} placeholder="Хэн болох" value={c.relation} onChange={(e) => { const emergencyContacts = [...form.emergencyContacts]; emergencyContacts[i] = { ...emergencyContacts[i], relation: e.target.value }; setForm((f) => ({ ...f, emergencyContacts })); }} />
                  <input className={inputCls} placeholder="Утас" value={c.phone} onChange={(e) => { const emergencyContacts = [...form.emergencyContacts]; emergencyContacts[i] = { ...emergencyContacts[i], phone: e.target.value }; setForm((f) => ({ ...f, emergencyContacts })); }} />
                </RowCard>
              ))}
            </div>

            <div className={sectionCls}>
              <SectionHead num="10" title="Журм, зөвшөөрөл" />

              <p className="mb-3 text-sm font-medium text-graphite-200">{JOB_APPLICATION_RULES_TITLE}</p>
              <div
                ref={onRulesRef}
                onScroll={onRulesScroll}
                className="max-h-52 overflow-y-auto rounded-xl border border-graphite-700 bg-graphite-900/80 p-4 text-sm leading-relaxed text-graphite-200 sm:max-h-60"
              >
                <ol className="list-decimal space-y-3 pl-5">
                  {JOB_APPLICATION_RULES.map((rule, i) => (
                    <li key={i}>{rule}</li>
                  ))}
                </ol>
              </div>

              <p
                className={`mt-3 text-xs ${
                  rulesRead ? 'text-green-400' : 'text-graphite-500'
                }`}
              >
                {rulesRead
                  ? '✓ Журмыг уншсан — доор зөвшөөрч, гарын үсэг зурна уу'
                  : '↓ Журмыг доош гүйлгэж бүрэн уншина уу'}
              </p>

              <label
                className={`mb-5 mt-4 flex items-start gap-3 rounded-lg border p-4 text-sm transition-colors ${
                  rulesRead
                    ? 'cursor-pointer border-graphite-700 bg-graphite-950/50 text-graphite-300'
                    : 'cursor-not-allowed border-graphite-800 bg-graphite-900/30 text-graphite-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.consent}
                  disabled={!rulesRead}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((f) => ({
                      ...f,
                      consent: checked,
                      signatureSvg: checked ? f.signatureSvg : '',
                    }));
                  }}
                  className="mt-0.5 accent-accent disabled:opacity-40"
                />
                <span>{JOB_CONSENT_LABEL}</span>
              </label>

              <SectionHead num="9" title="Гарын үсэг" />
              <SignaturePad
                disabled={!form.consent}
                onChange={(svg) => setForm((f) => ({ ...f, signatureSvg: svg }))}
              />
            </div>
          </div>
        )}

        {msg ? (
          <p
            className={`mt-6 rounded-lg px-4 py-3 text-center text-sm ${
              msg.type === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {msg.text}
          </p>
        ) : null}
      </div>

      {/* Доод товчлуурууд */}
      <div className="border-t border-graphite-800 bg-graphite-900/95 px-4 py-4 sm:px-6 lg:px-8">
        <StepNav />
      </div>
    </div>
  );
}
