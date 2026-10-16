import { useEffect, useMemo, useState } from 'react';
import { Download, LogIn, LogOut, RefreshCw, Search, Wallet } from 'lucide-react';
import { Button, Input, Loading } from '../components/ui';
import { supabase } from '../lib/supabase';
import { rememberAuthReturn } from '../lib/authReturn';
import { downloadSheets } from '../lib/attendanceExport';

/**
 * adiyasuren.gennetex.com/system/admin/ — хувийн, хаана ч холбоосгүй.
 * Зөвхөн adiyasuren1003@gmail.com-ээр нэвтэрсэн үед (сервер `owner_verify_income` ч шалгана).
 * Өөр хэн ч «Хуудас олдсонгүй» л харна.
 */

export const OWNER_HOST = 'adiyasuren.gennetex.com';
export const OWNER_PATH = '/system/admin';
const OWNER_EMAIL = 'adiyasuren1003@gmail.com';

type Row = { phone: string; at: string; source: string | null; name: string | null };
type Income = { per_verify: number; earlier: number; verified: Row[]; pending: number; expired: number };

const money = (n: number) => `${new Intl.NumberFormat('mn-MN').format(Math.round(n || 0))}₮`;
const SOURCE: Record<string, string> = { admin_gate: 'Админ нэвтрэлт', data_gate: 'Data нэвтрэлт' };

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-6 text-center">
      <div>
        <p className="text-[40px] font-semibold text-subtle">404</p>
        <p className="text-[14px] text-muted">Хуудас олдсонгүй.</p>
      </div>
    </div>
  );
}

export default function OwnerSite() {
  const onPath = window.location.pathname.replace(/\/+$/, '') === OWNER_PATH;
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    // Хайлтын системд бүү индексл.
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    document.title = 'Gennetex';
    if (!onPath) return;
    const read = () => supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email?.toLowerCase() || null));
    read();
    const { data: sub } = supabase.auth.onAuthStateChange(() => read());
    return () => {
      sub?.subscription?.unsubscribe();
      m.remove();
    };
  }, [onPath]);

  if (!onPath) return <NotFound />;
  if (email === undefined) return <div className="flex min-h-screen items-center justify-center bg-app"><Loading /></div>;
  if (email === null) {
    const signIn = async () => {
      const to = `${window.location.origin}${OWNER_PATH}/`;
      rememberAuthReturn(to);
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: to, queryParams: { prompt: 'select_account' } } });
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-app p-6">
        <Button icon={<LogIn size={16} />} onClick={signIn}>Google-ээр нэвтрэх</Button>
      </div>
    );
  }
  if (email !== OWNER_EMAIL) return <NotFound />;
  return <Dashboard />;
}

function Dashboard() {
  const [data, setData] = useState<Income | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const load = () => {
    setErr('');
    supabase.rpc('owner_verify_income').then(({ data, error }) => (error ? setErr(error.message) : setData(data as Income)));
  };
  useEffect(load, []);

  const months = useMemo(() => {
    const m = new Map<string, number>();
    (data?.verified || []).forEach((r) => {
      const k = r.at?.slice(0, 7) || '—';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  if (err) return <div className="p-6 text-[13px] text-danger">{err}</div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-app"><Loading /></div>;

  const per = data.per_verify;
  const total = data.verified.length + data.earlier;
  const uniquePhones = new Set(data.verified.map((r) => r.phone)).size;
  const list = data.verified.filter((r) => !q.trim() || `${r.phone} ${r.name || ''}`.includes(q.trim()));

  const exportExcel = () => {
    const rows: (string | number)[][] = [['Огноо', 'Утас', 'Хэн', 'Хаанаас', 'Орлого (₮)']];
    data.verified.forEach((r) => rows.push([r.at ? new Date(r.at).toLocaleString('mn-MN') : '', r.phone, r.name || '', SOURCE[r.source || ''] || r.source || '', per]));
    void downloadSheets('verify_orlogo.xlsx', [{ name: 'Орлого', rows }]);
  };

  return (
    <div className="min-h-screen bg-app">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Wallet size={20} className="text-brand" />
          <h1 className="flex-1 text-[16px] font-semibold text-ink">Орлого — verify.mn</h1>
          <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={load}>Шинэчлэх</Button>
          <Button variant="ghost" icon={<LogOut size={15} />} onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>Гарах</Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            ['Нийт орлого', money(total * per)],
            ['Амжилттай баталгаажсан', `${total}`],
            ['Ялгаатай дугаар', `${uniquePhones}`],
            ['Хүлээгдэж / хугацаа дууссан', `${data.pending} / ${data.expired}`],
          ] as const).map(([k, v]) => (
            <div key={k} className="surface p-4"><p className="text-[12px] text-muted">{k}</p><p className="mt-1 text-[20px] font-semibold text-ink">{v}</p></div>
          ))}
        </div>
        <p className="mb-5 text-[12px] text-muted">
          Баталгаажсан дугаар бүрт {per}₮ (хэрэглэгч оператортоо 150₮ төлнө). Орлого verify.mn dashboard дээр хуримтлагдана.
          {data.earlier ? ` Үүнд бүртгэл эхлэхээс өмнөх ${data.earlier} баталгаажуулалт (дугаар нь хадгалагдаагүй) орсон.` : ''}
        </p>

        {months.length ? (
          <section className="surface mb-5 p-4">
            <h2 className="mb-2 text-[13px] font-semibold text-ink">Сараар</h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {months.map(([m, n]) => (
                <li key={m} className="rounded-[var(--radius-sm)] border border-line bg-card2 p-2 text-[13px]">
                  <span className="block text-muted">{m}</span>
                  <b className="text-ink">{n} · {money(n * per)}</b>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <h2 className="flex-1 text-[14px] font-semibold text-ink">Амжилттай баталгаажсан дугаарууд ({data.verified.length})</h2>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
              <Input placeholder="Дугаар, нэр" value={q} onChange={(e) => setQ(e.target.value)} className="w-40 pl-8" />
            </div>
            <Button variant="outline" icon={<Download size={14} />} disabled={!data.verified.length} onClick={exportExcel}>Excel</Button>
          </div>
          {!list.length ? <p className="p-6 text-center text-[13px] text-muted">Бүртгэл алга.</p> : (
            <table className="w-full text-[13px]">
              <thead className="bg-card2 text-left text-[12px] text-muted"><tr><th className="px-4 py-2 font-medium">Огноо</th><th className="px-4 py-2 font-medium">Утас</th><th className="px-4 py-2 font-medium">Хэн</th><th className="px-4 py-2 font-medium">Хаанаас</th><th className="px-4 py-2 text-right font-medium">Орлого</th></tr></thead>
              <tbody className="divide-y divide-line">
                {list.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-muted">{r.at ? new Date(r.at).toLocaleString('mn-MN') : '—'}</td>
                    <td className="px-4 py-2 font-mono text-ink">{r.phone}</td>
                    <td className="px-4 py-2 text-ink">{r.name || '—'}</td>
                    <td className="px-4 py-2 text-muted">{SOURCE[r.source || ''] || r.source || 'Утас баталгаажуулах'}</td>
                    <td className="px-4 py-2 text-right text-ink">{money(per)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
