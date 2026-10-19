import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Globe, LogOut, Search } from 'lucide-react';
import LoginPage from './Login';
import AdminGate, { adminGateLogout } from '../components/AdminGate';
import { Button, Loading, ToneIcon, toneOf } from '../components/ui';
import SiteShell from '../components/SiteShell';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * link.gennetex.com — Gennetex-ийн бүх домэйны жагсаалт.
 * Домэйн бүр юу хийдэг, хэн нэвтэрдгийг бичиж, дарахад шууд тийш нь очно.
 * Шинэ subdomain нэмбэл энд нэг мөр нэмнэ. Зөвхөн админ (admin, superadmin) харна.
 */

type Access = 'public' | 'staff' | 'granted' | 'admin' | 'super';
type Link = { host: string; name: string; desc: string; access: Access };
type Group = { title: string; links: Link[] };

const ACCESS: Record<Access, { label: string; cls: string }> = {
  public: { label: 'Нийтэд нээлттэй', cls: 'bg-success-soft text-success' },
  staff: { label: 'Ажилтан', cls: 'bg-brand-soft text-brand' },
  granted: { label: 'Зөвшөөрөл өгсний дараа', cls: 'bg-brand-soft text-brand' },
  admin: { label: 'Админ', cls: 'bg-warning-soft text-warning' },
  super: { label: 'Sysadmin', cls: 'bg-danger-soft text-danger' },
};

const GROUPS: Group[] = [
  {
    title: 'Нийтийн сайтууд',
    links: [
      { host: 'gennetex.com', name: 'Gennetex — үндсэн сайт', desc: 'Компанийн танилцуулга, үйлчилгээ, холбоо барих. Апп татах холбоос (/app) энд байна.', access: 'public' },
      { host: 'cv.gennetex.com', name: 'Ажилд орох', desc: 'Нээлттэй ажлын байрууд ба онлайн анкет бөглөх.', access: 'public' },
      { host: 'ai.gennetex.com', name: 'Gennetex AI', desc: 'Бодож байж хариулдаг хиймэл оюун туслах.', access: 'public' },
    ],
  },
  {
    title: 'Удирдлага',
    links: [
      { host: 'admin.gennetex.com', name: 'ERP удирдлага', desc: 'Хянах самбар, анхааруулгын төв, хөдөлмөрийн гэрээ, машин, дуудлага, SMS, тохиргоо.', access: 'admin' },
      { host: 'akt.gennetex.com', name: 'Ажил гүйцэтгэлийн акт', desc: 'Төсөл, материал, шалгах хуудас, зурагтай актыг үүсгэж баталгаажуулна. Захирал батална.', access: 'granted' },
      { host: 'geree.gennetex.com', name: 'Хөдөлмөрийн гэрээ', desc: 'Ажилтан гэрээтэйгээ танилцаж гарын үсэг зурна; админ гэрээ удирдана.', access: 'granted' },
      { host: 'share.gennetex.com', name: 'Хуваалцах', desc: 'Нэвтрэлтгүй: текст бичих эсвэл файл (50MB хүртэл) байршуулж холбоос авна. 1/7/30 хоногийн дараа устна.', access: 'public' },
      { host: 'noft.gennetex.com', name: 'Мэдэгдэл', desc: 'Бүх ажилтан, хэлтэс эсвэл хүн бүрт апп-аар push мэдэгдэл илгээнэ.', access: 'admin' },
    ],
  },
  {
    title: 'Ирц ба хүний нөөц',
    links: [
      { host: 'irts.gennetex.com', name: 'Ирц бүртгэл', desc: 'Ажилтны ирэлт, явалт, зайнаас бүртгэл, цагийн (чөлөөний) хүсэлтийг шийдвэрлэнэ.', access: 'admin' },
      { host: 'tailan.gennetex.com', name: 'Цагийн тайлан', desc: 'Ирцийн зураглал, хоцролт, тасалсан өдөр; ажилтны 7 хоногийн хуваарь; сануулга илгээх.', access: 'admin' },
      { host: 'hr.gennetex.com', name: 'Хүний нөөц', desc: 'Ажилтан, алба хэлтэс, ажлын байрны анкет (цаасан загвар, PDF, батлах).', access: 'admin' },
      { host: 'surgalt.gennetex.com', name: 'Сургалт', desc: 'Ажилтны авсан ба заавал авах сургалт, гэрчилгээ.', access: 'admin' },
      { host: 'habea.gennetex.com', name: 'Өндөрт ажиллах ХАБЭА', desc: 'Өндөрт ажиллах ажилтны аюулгүй ажиллагааны бүртгэл, зөвшөөрөл.', access: 'admin' },
      { host: 'haab.gennetex.com', name: 'ХААБ гарын үсэг', desc: 'Апп-аас ХААБ зааврыг уншаад зурсан өдөр бүрийн гарын үсэг — зурсан, зураагүй ажилтан.', access: 'admin' },
      { host: 'guitsetgel.gennetex.com', name: 'Ажилчдын гүйцэтгэл', desc: 'Баг бүр өдөрт хэдэн айл, хэр хугацаанд ажилласан тухай гүйцэтгэлийн тайлан.', access: 'admin' },
    ],
  },
  {
    title: 'Байршил, хурал',
    links: [
      { host: 'bairshil.gennetex.com', name: 'Байршил', desc: 'Ажилчдын байршлыг хэлтсээр нь газрын зураг дээр; ирц бүртгэх цэгүүд. Хэлтсийн админ өөрийн хэлтсийг харна.', access: 'admin' },
      { host: 'meet.gennetex.com', name: 'Хурал', desc: 'Вэбээс хурал эхлүүлж дэлгэц хуваалцана; ажилтан апп-аасаа орно.', access: 'admin' },
    ],
  },
  {
    title: 'Санхүү ба агуулах',
    links: [
      { host: 'sanhuu.gennetex.com', name: 'Санхүү', desc: 'Ирцээс цалин тооцох, хоолны мөнгө (нөхөж/түрүүлж авах), бензин зарцуулалт ба цэнэглэх.', access: 'admin' },
      { host: 'aguulah.gennetex.com', name: 'Агуулах', desc: 'Бараа материал, багаж, хангамж; орлого авах; ажилтны авсан бараа ба үлдэгдэл.', access: 'admin' },
      { host: 'toololgo.gennetex.com', name: 'Тооллого', desc: 'Excel тооллогыг харьцуулах хэрэгсэл; үр дүн серверт хадгалагдана.', access: 'admin' },
    ],
  },
  {
    title: 'Өгөгдөл ба архив',
    links: [
      { host: 'arhiv.gennetex.com', name: 'Архив', desc: 'Апп-аас ирсэн бүх үйлдлийн лог ба татсан бүх Excel файл.', access: 'admin' },
      { host: 'data.gennetex.com/data/', name: 'Gennetex Data', desc: 'Бүх хүснэгт, файлын сав. Утас → Gmail код → Google → нууц үг гэсэн 4 шаттай нэвтрэлт.', access: 'super' },
      { host: 'bayasgalan.gennetex.com/data/', name: 'Data — харах эрх', desc: 'Gennetex Data-г зөвхөн харах эрхтэй хүнд. Мөн 4 шаттай нэвтрэлт.', access: 'super' },
    ],
  },
];

/** Зөвхөн админ эрхээр нэвтэрсэн хүн харна. */
export default function LinkSite() {
  const [state, setState] = useState<'loading' | 'out' | 'denied' | 'ok'>('loading');
  const [email, setEmail] = useState('');
  const [gateOk, setGateOk] = useState(false);
  const pass = useCallback(() => setGateOk(true), []);
  useEffect(() => {
    if (!isSupabaseConfigured) return setState('out');
    const read = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return setState('out');
      setEmail(data.user.email || '');
      const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
      setState(['admin', 'superadmin'].includes(String(p?.role || '')) ? 'ok' : 'denied');
    };
    read();
    const { data: sub } = supabase.auth.onAuthStateChange(() => read());
    return () => sub?.subscription?.unsubscribe();
  }, []);
  if (state === 'loading') return <div className="flex min-h-screen items-center justify-center bg-app"><Loading text="Эрх шалгаж байна…" /></div>;
  if (state === 'out') return <AdminGate signedIn={false} onPass={pass} title="Бүх хаяг" />;
  if (state === 'denied') return <LoginPage error={`${email || 'Энэ хаяг'} нь админ эрхгүй байна. Бүх хаягийн жагсаалтыг зөвхөн админ харна.`} />;
  if (!gateOk) return <AdminGate signedIn onPass={pass} title="Бүх хаяг" />;
  return <Links onSignOut={() => adminGateLogout().then(() => supabase.auth.signOut()).then(() => window.location.reload())} />;
}

function Links({ onSignOut }: { onSignOut: () => void }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const n = q.trim().toLowerCase();
    return GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => !n || `${l.host} ${l.name} ${l.desc}`.toLowerCase().includes(n)) })).filter((g) => g.links.length);
  }, [q]);
  const total = GROUPS.reduce((s, g) => s + g.links.length, 0);

  return (
    <SiteShell
      title="Бүх хаяг"
      subtitle={`${total} домэйн. Дарахад шууд тийш нь очно.`}
      icon={<Globe size={24} />}
      actions={
        <>
          <label className="relative hidden w-64 sm:block">
            <span className="sr-only">Хайх</span>
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Хайх: цалин, ирц, агуулах…"
              className="focus-ring h-10 w-full rounded-full bg-card2 pl-10 pr-4 text-[14px] text-ink placeholder:text-subtle"
            />
          </label>
          <Button variant="outline" icon={<LogOut size={15} />} onClick={onSignOut}>Гарах</Button>
        </>
      }
    >
      <label className="relative mb-5 block sm:hidden">
        <span className="sr-only">Хайх</span>
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Хайх…" className="focus-ring h-11 w-full rounded-full bg-card pl-10 pr-4 text-[14px] text-ink shadow-[var(--shadow)] placeholder:text-subtle" />
      </label>
      {!groups.length ? <p className="py-16 text-center text-[14px] text-muted">«{q}» гэсэн хаяг олдсонгүй.</p> : null}
      {groups.map((g) => (
        <section key={g.title} className="mb-8">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{g.title} <span className="font-normal text-subtle">({g.links.length})</span></h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.links.map((l) => (
              <a
                key={l.host}
                href={`https://${l.host}`}
                className="surface focus-ring group flex flex-col p-5 transition-transform hover:-translate-y-0.5"
              >
                <span className="flex items-start gap-3">
                  <ToneIcon tone={toneOf(l.name)} size={40}><span className="text-[14px] font-bold">{l.name[0]}</span></ToneIcon>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{l.name}</span>
                    <span className="block truncate text-[12px] font-medium text-brand">{l.host.replace(/\/$/, '')}</span>
                  </span>
                  <ArrowUpRight size={18} className="shrink-0 text-subtle transition group-hover:text-brand" aria-hidden="true" />
                </span>
                <span className="mt-3 flex-1 text-[13px] leading-5 text-muted">{l.desc}</span>
                <span className={`mt-3 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${ACCESS[l.access].cls}`}>{ACCESS[l.access].label}</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </SiteShell>
  );
}
