import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Database, Download, Eye, File, Folder, KeyRound, LogOut, Mail, RefreshCw, Smartphone, UserCheck } from 'lucide-react';
import { Button, Input, Loading, EmptyState } from '../components/ui';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { rememberAuthReturn } from '../lib/authReturn';
import { downloadSheets } from '../lib/attendanceExport';
import brandMark from '../assets/report-logo.png';

/**
 * data.gennetex.com/data/ — компанийн бүх өгөгдөл (хүснэгт + файлын сав).
 *
 * superadmin (бүрэн) ба «зөвхөн харах» эрхтэй хүн. Нэвтрэх 4 шат (сервер `data-gate` шалгана):
 *   1. Утас — verify.mn: өөрийн утаснаас 144773 руу код илгээнэ
 *   2. Gmail-д ирсэн код
 *   3. Google-ээр нэвтрэх
 *   4. Өөрийн нууц үг
 */

const GATE_KEY = 'gx_data_gate';
const TOKEN_KEY = 'gx_data_token';
type Step = 'phone' | 'sms' | 'email' | 'google' | 'password' | 'app';

const store = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) sessionStorage.removeItem(k);
      else sessionStorage.setItem(k, v);
    } catch {
      /* хувийн цонх — шат бүрийг дахин хийнэ */
    }
  },
};

async function gate<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('data-gate', { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await (error as any).context?.json?.();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export default function DataSite() {
  const [step, setStep] = useState<Step>(() => (store.get(TOKEN_KEY) ? 'app' : store.get(GATE_KEY) ? 'google' : 'phone'));
  const [gateId, setGateId] = useState<string | null>(() => store.get(GATE_KEY));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState<{ instruction: string; smsUri: string; code: string; expiresAt: string; expired?: boolean } | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      const m = (e as Error).message || 'Алдаа гарлаа';
      setErr(m);
      if (/Хугацаа дууссан|Алхам буруу|Эхнээс/.test(m)) restart();
    } finally {
      setBusy(false);
    }
  };
  const restart = () => {
    store.set(GATE_KEY, null);
    setGateId(null);
    setSms(null);
    setStep('phone');
  };

  // 1. Утас
  const start = () =>
    run(async () => {
      const r = await gate<{ gate: string; instruction: string; smsUri: string; code: string; expiresAt: string }>({ action: 'start', phone });
      setGateId(r.gate);
      setSms({ instruction: r.instruction, smsUri: r.smsUri, code: r.code, expiresAt: r.expiresAt });
      setStep('sms');
    });

  // 1б. 3 секунд тутам verify.mn-ийн төлөв — VERIFIED бол шууд зогсоно.
  useEffect(() => {
    if (step !== 'sms' || !gateId || sms?.expired) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await gate<{ verified: boolean; expired?: boolean; email?: string }>({ action: 'phone', gate: gateId });
        if (stop) return;
        if (r.verified) {
          setEmail(r.email || '');
          setStep('email');
          return;
        }
        if (r.expired || (sms && new Date(sms.expiresAt) < new Date())) {
          setSms((s) => s && { ...s, expired: true });
          return;
        }
      } catch (e) {
        if (!stop) setErr((e as Error).message);
      }
      if (!stop) timer = setTimeout(tick, 3000);
    };
    let timer = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [step, gateId, sms?.expired]);

  // 2. Gmail код
  const sendCode = () =>
    run(async () => {
      await gate({ action: 'email', gate: gateId, code });
      store.set(GATE_KEY, gateId);
      setStep('google');
    });

  // 3. Google — буцаж ирэхэд сесс байвал шалгана.
  const checkGoogle = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session || !gateId) return;
    await run(async () => {
      const r = await gate<{ setup: boolean }>({ action: 'google', gate: gateId });
      setSetup(r.setup);
      setStep('password');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateId]);
  const checked = useRef(false);
  useEffect(() => {
    if (step !== 'google' || checked.current) return;
    checked.current = true;
    void checkGoogle();
  }, [step, checkGoogle]);
  const google = async () => {
    const returnTo = `${location.origin}/data/`;
    rememberAuthReturn(returnTo);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo, queryParams: { prompt: 'select_account' } } });
  };

  // 4. Нууц үг
  const sendPw = () =>
    run(async () => {
      if (setup && pw !== pw2) throw new Error('Нууц үг таарахгүй байна.');
      const r = await gate<{ token: string }>({ action: 'password', gate: gateId, password: pw });
      store.set(TOKEN_KEY, r.token);
      store.set(GATE_KEY, null);
      setPw('');
      setPw2('');
      setStep('app');
    });

  const logout = async () => {
    const token = store.get(TOKEN_KEY);
    store.set(TOKEN_KEY, null);
    store.set(GATE_KEY, null);
    if (token) await gate({ action: 'logout', token }).catch(() => null);
    await supabase.auth.signOut();
    location.replace('/data/');
  };

  if (!isSupabaseConfigured) return <Shell><p className="text-[13px] text-danger">Supabase тохируулаагүй.</p></Shell>;
  if (step === 'app') return <DataApp onLogout={logout} onExpired={() => { store.set(TOKEN_KEY, null); restart(); }} />;

  const steps: [Step[], string][] = [[['phone', 'sms'], 'Утас'], [['email'], 'Gmail код'], [['google'], 'Google'], [['password'], 'Нууц үг']];
  const at = steps.findIndex(([s]) => s.includes(step));

  return (
    <Shell>
      <ol className="mb-5 grid grid-cols-4 gap-1.5" aria-label="Нэвтрэх шат">
        {steps.map(([, l], i) => (
          <li key={l} className={`rounded-full px-2 py-1 text-center text-[11px] font-semibold ${i < at ? 'bg-success text-white' : i === at ? 'bg-brand text-white' : 'bg-card2 text-subtle'}`} aria-current={i === at ? 'step' : undefined}>
            {i + 1}. {l}
          </li>
        ))}
      </ol>

      {step === 'phone' ? (
        <form onSubmit={(e) => { e.preventDefault(); start(); }} className="space-y-3">
          <label className="block space-y-1 text-[13px] text-ink">
            <span className="flex items-center gap-1.5"><Smartphone size={14} /> Утасны дугаар</span>
            <Input inputMode="numeric" autoComplete="tel" placeholder="99112233" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
          </label>
          <Button type="submit" className="w-full" disabled={busy || phone.replace(/\D/g, '').length < 8}>{busy ? 'Түр хүлээнэ үү…' : 'Үргэлжлүүлэх'}</Button>
        </form>
      ) : null}

      {step === 'sms' && sms ? (
        <div className="space-y-3">
          {sms.expired ? (
            <>
              <p className="rounded-[var(--radius-sm)] bg-warning-soft p-3 text-[13px] text-warning">Хугацаа дууссан. Өмнөх код ({sms.code}) хүчингүй боллоо — шинэ код аваад дахин илгээнэ үү.</p>
              <Button className="w-full" disabled={busy} onClick={start}>Шинэ код авах</Button>
            </>
          ) : (
            <>
              {/* displayInstruction-ийг үгчлэн — аль дугаараас илгээхийг заадаг. */}
              <p className="whitespace-pre-line rounded-[var(--radius-sm)] border border-line bg-card2 p-3 text-[14px] leading-6 text-ink">{sms.instruction}</p>
              <a href={sms.smsUri} className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-brand text-[14px] font-semibold text-white">
                <Smartphone size={16} /> SMS илгээх (144773)
              </a>
              <p className="flex items-center justify-center gap-2 text-[12px] text-muted"><RefreshCw size={13} className="animate-spin" /> SMS хүлээж байна… Нэг SMS 150₮.</p>
              <button type="button" className="w-full text-[12px] text-muted underline" onClick={restart}>Өөр дугаар оруулах</button>
            </>
          )}
        </div>
      ) : null}

      {step === 'email' ? (
        <form onSubmit={(e) => { e.preventDefault(); sendCode(); }} className="space-y-3">
          <p className="text-[13px] text-success">Утас баталгаажлаа.</p>
          <label className="block space-y-1 text-[13px] text-ink">
            <span className="flex items-center gap-1.5"><Mail size={14} /> {email || 'Gmail'} хаягт ирсэн 6 оронтой код</span>
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </label>
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>Баталгаажуулах</Button>
        </form>
      ) : null}

      {step === 'google' ? (
        <div className="space-y-3">
          <p className="text-[13px] text-muted">Утастай ижил хүний Google (Gmail) дансаар нэвтэрнэ үү.</p>
          <Button className="w-full" disabled={busy} onClick={google}>Google-ээр нэвтрэх</Button>
          <button type="button" className="w-full text-[12px] text-muted underline" onClick={restart}>Эхнээс нь эхлэх</button>
        </div>
      ) : null}

      {step === 'password' ? (
        <form onSubmit={(e) => { e.preventDefault(); sendPw(); }} className="space-y-3">
          <label className="block space-y-1 text-[13px] text-ink">
            <span className="flex items-center gap-1.5"><KeyRound size={14} /> {setup ? 'Шинэ нууц үг тохируулах (10+ тэмдэгт)' : 'Нууц үг'}</span>
            <Input type="password" autoComplete={setup ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          </label>
          {setup ? (
            <label className="block space-y-1 text-[13px] text-ink">
              <span>Нууц үгээ давтах</span>
              <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </label>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy || pw.length < (setup ? 10 : 1)}>Нэвтрэх</Button>
        </form>
      ) : null}

      {err ? <p className="mt-3 text-[13px] text-danger" role="alert">{err}</p> : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-4">
      <div className="w-full max-w-sm rounded-[var(--radius)] border border-line bg-card p-6 shadow-panel">
        <div className="mb-5 flex items-center gap-3">
          <img src={brandMark} alt="" width="36" height="36" className="h-9 w-9 rounded-md object-contain" />
          <div>
            <h1 className="text-[16px] font-semibold text-ink">Gennetex Data</h1>
            <p className="text-[12px] text-muted">Зөвхөн эрх бүхий хүн</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════ Нэвтэрсний дараа ═══════════════════ */
type Table = { name: string; approx_rows: number; has_created_at: boolean };
type Bucket = { id: string; name: string; public: boolean };
type FileObj = { name: string; id: string | null; created_at?: string; metadata?: { size?: number; mimetype?: string } | null };

function DataApp({ onLogout, onExpired }: { onLogout: () => void; onExpired: () => void }) {
  const token = store.get(TOKEN_KEY) || '';
  const [tab, setTab] = useState<'tables' | 'files' | 'viewers'>('tables');
  const [admin, setAdmin] = useState(false);
  const call = useCallback(
    async <T,>(body: Record<string, unknown>) => {
      try {
        return await gate<T>({ ...body, token });
      } catch (e) {
        if (/Сесс дууссан|Google-ээр нэвтэрнэ/.test((e as Error).message)) onExpired();
        throw e;
      }
    },
    [token, onExpired]
  );

  useEffect(() => {
    call<{ admin: boolean }>({ action: 'me' }).then((r) => setAdmin(!!r.admin)).catch(() => null);
  }, [call]);

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-card px-4 py-3">
        <img src={brandMark} alt="" width="28" height="28" className="h-7 w-7 rounded object-contain" />
        <h1 className="text-[15px] font-semibold text-ink">Gennetex Data</h1>
        <div className="ml-4 inline-flex rounded-full border border-line bg-card2 p-1" role="tablist">
          {([['tables', 'Хүснэгт'], ['files', 'Файлын сав'], ...(admin ? [['viewers', 'Харах эрх']] : [])] as ['tables' | 'files' | 'viewers', string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${tab === k ? 'bg-brand text-white' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
        {!admin ? <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-card2 px-2.5 py-1 text-[12px] text-muted"><Eye size={13} /> Зөвхөн харах</span> : null}
        <Button variant="ghost" className={admin ? 'ml-auto' : ''} icon={<LogOut size={15} />} onClick={onLogout}>Гарах</Button>
      </header>
      <main className="p-4">{tab === 'tables' ? <Tables call={call} /> : tab === 'files' ? <Files call={call} /> : <Viewers call={call} />}</main>
    </div>
  );
}

type Call = <T>(body: Record<string, unknown>) => Promise<T>;

function Tables({ call }: { call: Call }) {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Table | null>(null);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState('');
  const size = 100;

  useEffect(() => {
    call<{ tables: Table[] }>({ action: 'tables' }).then((r) => setTables(r.tables)).catch((e) => setErr(e.message));
  }, [call]);
  useEffect(() => {
    if (!sel) return;
    setRows(null);
    call<{ rows: Record<string, unknown>[]; count: number }>({ action: 'rows', table: sel.name, page, size })
      .then((r) => {
        setRows(r.rows);
        setCount(r.count || 0);
      })
      .catch((e) => setErr(e.message));
  }, [sel, page, call]);

  const cols = rows?.length ? Object.keys(rows[0]) : [];
  const cell = (v: unknown) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const exportPage = () => {
    if (!sel || !rows) return;
    void downloadSheets(`${sel.name}_${page + 1}.xlsx`, [{ name: sel.name.slice(0, 31), rows: [cols, ...rows.map((r) => cols.map((c) => cell(r[c]).slice(0, 32000)))] }]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="surface p-2">
        <Input placeholder="Хүснэгт хайх" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
        {!tables ? <Loading /> : (
          <ul className="max-h-[75vh] overflow-y-auto">
            {tables.filter((t) => t.name.includes(q.trim().toLowerCase())).map((t) => (
              <li key={t.name}>
                <button onClick={() => { setSel(t); setPage(0); }} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${sel?.name === t.name ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-hover'}`}>
                  <Database size={13} className="shrink-0 text-subtle" />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="text-[11px] text-subtle">~{t.approx_rows}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="surface min-w-0">
        {err ? <p className="p-4 text-[13px] text-danger" role="alert">{err}</p> : null}
        {!sel ? <EmptyState text="Зүүн талаас хүснэгт сонгоно уу." /> : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
              <b className="text-[14px] text-ink">{sel.name}</b>
              <span className="text-[12px] text-muted">{count} мөр</span>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Өмнөх"><ChevronLeft size={15} /></Button>
                <span className="text-[12px] text-muted">{page + 1} / {Math.max(1, Math.ceil(count / size))}</span>
                <Button variant="ghost" disabled={(page + 1) * size >= count} onClick={() => setPage((p) => p + 1)} aria-label="Дараах"><ChevronRight size={15} /></Button>
                <Button variant="outline" icon={<Download size={14} />} disabled={!rows?.length} onClick={exportPage}>Excel</Button>
              </div>
            </div>
            {!rows ? <Loading /> : !rows.length ? <EmptyState text="Мөр алга." /> : (
              <div className="max-h-[75vh] overflow-auto">
                <table className="text-[12px]">
                  <thead className="sticky top-0 bg-card2 text-left text-muted">
                    <tr>{cols.map((c) => <th key={c} className="whitespace-nowrap px-3 py-1.5 font-medium">{c}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r, i) => (
                      <tr key={i}>{cols.map((c) => <td key={c} className="max-w-[320px] truncate px-3 py-1.5 text-ink" title={cell(r[c])}>{cell(r[c])}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Files({ call }: { call: Call }) {
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [bucket, setBucket] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [files, setFiles] = useState<FileObj[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    call<{ buckets: Bucket[] }>({ action: 'buckets' }).then((r) => setBuckets(r.buckets)).catch((e) => setErr(e.message));
  }, [call]);
  useEffect(() => {
    if (!bucket) return;
    setFiles(null);
    call<{ files: FileObj[] }>({ action: 'files', bucket, prefix }).then((r) => setFiles(r.files)).catch((e) => setErr(e.message));
  }, [bucket, prefix, call]);

  const open = async (name: string) => {
    try {
      const r = await call<{ url: string }>({ action: 'sign', bucket, path: prefix ? `${prefix}/${name}` : name });
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const up = () => setPrefix((p) => p.split('/').slice(0, -1).join('/'));

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="surface p-2">
        {!buckets ? <Loading /> : (
          <ul>
            {buckets.map((b) => (
              <li key={b.id}>
                <button onClick={() => { setBucket(b.id); setPrefix(''); }} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${bucket === b.id ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-hover'}`}>
                  <Folder size={13} className="shrink-0 text-subtle" /> {b.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="surface min-w-0">
        {err ? <p className="p-4 text-[13px] text-danger" role="alert">{err}</p> : null}
        {!bucket ? <EmptyState text="Зүүн талаас сав сонгоно уу." /> : (
          <>
            <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-[13px]">
              {prefix ? <Button variant="ghost" onClick={up} aria-label="Дээш"><ChevronLeft size={15} /></Button> : null}
              <b className="truncate text-ink">{bucket}/{prefix}</b>
            </div>
            {!files ? <Loading /> : !files.length ? <EmptyState text="Хоосон." /> : (
              <ul className="divide-y divide-line">
                {files.map((f) => (
                  <li key={f.name}>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] hover:bg-hover"
                      onClick={() => (f.id ? open(f.name) : setPrefix((p) => (p ? `${p}/${f.name}` : f.name)))}
                    >
                      {f.id ? <File size={14} className="text-subtle" /> : <Folder size={14} className="text-brand" />}
                      <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                      {f.metadata?.size ? <span className="text-[11px] text-subtle">{Math.round(f.metadata.size / 1024)} KB</span> : null}
                      {f.created_at ? <span className="text-[11px] text-subtle">{f.created_at.slice(0, 10)}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** Superadmin — «зөвхөн харах» эрх олгох (bayasgalan.gennetex.com г.м.). */
function Viewers({ call }: { call: Call }) {
  type Person = { id: string; name: string | null; last_name: string | null; email: string | null; phone: string | null; role: string | null };
  const [people, setPeople] = useState<Person[] | null>(null);
  const [on, setOn] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    call<{ viewers: { user_id: string }[]; people: Person[] }>({ action: 'viewers' })
      .then((r) => {
        setPeople(r.people);
        setOn(new Set(r.viewers.map((v) => v.user_id)));
      })
      .catch((e) => setErr(e.message));
  }, [call]);
  const toggle = async (p: Person, v: boolean) => {
    setBusy(p.id);
    setErr('');
    try {
      await call({ action: 'viewer_set', user_id: p.id, on: v });
      setOn((s) => {
        const n = new Set(s);
        if (v) n.add(p.id);
        else n.delete(p.id);
        return n;
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const name = (p: Person) => [p.last_name, p.name].filter(Boolean).join(' ') || p.email || 'Ажилтан';
  const list = (people || []).filter((p) => `${name(p)} ${p.email || ''}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => Number(on.has(b.id)) - Number(on.has(a.id)));
  return (
    <section className="surface mx-auto max-w-3xl p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><UserCheck size={17} /> Зөвхөн харах эрх</h2>
      <p className="mb-3 mt-1 text-[13px] text-muted">
        Сонгосон хүн data.gennetex.com эсвэл bayasgalan.gennetex.com-оор мөн 4 шатаар (утас → Gmail код → Google → нууц үг) нэвтэрч, бүх хүснэгт, файлыг зөвхөн харна. Профайлд нь утасны дугаар, Gmail байх ёстой.
      </p>
      <Input placeholder="Хүн хайх" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
      {err ? <p className="mb-2 text-[13px] text-danger" role="alert">{err}</p> : null}
      {!people ? <Loading /> : (
        <ul className="divide-y divide-line">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{name(p)}</span>
                <span className="block truncate text-[12px] text-muted">{p.email || 'Gmail алга'} · {p.phone || 'утас алга'}</span>
              </span>
              <label className="flex items-center gap-1.5 text-[12px] text-ink">
                <input type="checkbox" checked={on.has(p.id)} disabled={busy === p.id} onChange={(e) => toggle(p, e.target.checked)} />
                Харах эрх
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
