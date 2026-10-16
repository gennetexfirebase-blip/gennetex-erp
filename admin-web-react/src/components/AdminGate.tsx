import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, LogIn, Mail, RefreshCw, Smartphone } from 'lucide-react';
import { Button, Input, Loading } from './ui';
import { supabase } from '../lib/supabase';
import { rememberAuthReturn } from '../lib/authReturn';
import { currentSite } from '../lib/sites';
import brandMark from '../assets/report-logo.png';

/**
 * Админ хэсгүүдийн 4 шаттай нэвтрэлт (edge function `admin-gate`):
 *   1. Утас — verify.mn   2. Google   3. Өөрийн байнгын код   4. Gmail-д ирсэн код
 *
 * Амжилттай бол 12 цагийн токен `.gennetex.com` cookie-д хадгалагдаж, бүх
 * subdomain дээр хүчинтэй (бусад subdomain дээр зөвхөн Google-ээр нэвтэрнэ).
 * Явц (gate id, шат) sessionStorage-д — Google руу шилжээд буцахад үргэлжилнэ.
 */

const COOKIE = 'gx_admin_gate';
const STEP_KEY = 'gx_admin_gate_step';
type Step = 'phone' | 'sms' | 'google' | 'password' | 'email';

function cookieDomain() {
  const h = location.hostname;
  return h.endsWith('.gennetex.com') || h === 'gennetex.com' ? '; domain=.gennetex.com' : '';
}
export function readGateToken() {
  return document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`))?.[1] || '';
}
function writeGateToken(token: string, expiresAt?: string) {
  const maxAge = token && expiresAt ? Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;
  document.cookie = `${COOKIE}=${token}; path=/; max-age=${maxAge}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${cookieDomain()}`;
}
export async function adminGateLogout() {
  const token = readGateToken();
  writeGateToken('');
  if (token) await supabase.functions.invoke('admin-gate', { body: { action: 'logout', token } }).catch(() => null);
}

const progress = {
  get: (): { gate: string; step: Step } | null => {
    try {
      return JSON.parse(sessionStorage.getItem(STEP_KEY) || 'null');
    } catch {
      return null;
    }
  },
  set: (v: { gate: string; step: Step } | null) => {
    try {
      if (v) sessionStorage.setItem(STEP_KEY, JSON.stringify(v));
      else sessionStorage.removeItem(STEP_KEY);
    } catch {
      /* хувийн цонх — шатыг дахин хийнэ */
    }
  },
};

async function gate<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-gate', { body });
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

export default function AdminGate({ signedIn, onPass, title }: { signedIn: boolean; onPass: () => void; title?: string }) {
  const site = currentSite();
  const saved = progress.get();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>(saved?.step || 'phone');
  const [gateId, setGateId] = useState<string | null>(saved?.gate || null);
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState<{ instruction: string; smsUri: string; code: string; expiresAt: string; expired?: boolean } | null>(null);
  const [setup, setSetup] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const go = (s: Step, g = gateId) => {
    setStep(s);
    if (g) progress.set({ gate: g, step: s });
  };
  const restart = () => {
    progress.set(null);
    setGateId(null);
    setSms(null);
    setStep('phone');
  };
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

  // Бусад subdomain дээр аль хэдийн нэвтэрсэн бол (cookie) шууд нэвтрүүлнэ.
  useEffect(() => {
    (async () => {
      const token = readGateToken();
      if (signedIn && token) {
        try {
          const r = await gate<{ ok: boolean }>({ action: 'check', token });
          if (r.ok) {
            progress.set(null);
            return onPass();
          }
          writeGateToken('');
        } catch {
          /* шалгаж чадсангүй — шатаар нэвтэрнэ */
        }
      }
      setChecking(false);
    })();
  }, [signedIn, onPass]);

  // 1. Утас
  const start = () =>
    run(async () => {
      const r = await gate<{ gate: string; instruction: string; smsUri: string; code: string; expiresAt: string }>({ action: 'start', phone });
      setGateId(r.gate);
      setSms({ instruction: r.instruction, smsUri: r.smsUri, code: r.code, expiresAt: r.expiresAt });
      go('sms', r.gate);
    });

  // 1б. verify.mn — 3 секунд тутам, VERIFIED бол зогсоно.
  useEffect(() => {
    if (step !== 'sms' || !gateId || sms?.expired) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await gate<{ verified: boolean; expired?: boolean }>({ action: 'phone', gate: gateId });
        if (stop) return;
        if (r.verified) return go('google');
        if (r.expired || (sms && new Date(sms.expiresAt) < new Date())) return setSms((s) => s && { ...s, expired: true });
      } catch (e) {
        if (!stop) setErr((e as Error).message);
      }
      if (!stop) timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [step, gateId, sms?.expired]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Google — нэвтэрсэн бол шууд шалгана.
  const checkGoogle = useCallback(async () => {
    if (!gateId) return;
    await run(async () => {
      const r = await gate<{ setup: boolean }>({ action: 'google', gate: gateId });
      setSetup(r.setup);
      go('password');
    });
  }, [gateId]); // eslint-disable-line react-hooks/exhaustive-deps
  const triedGoogle = useRef(false);
  useEffect(() => {
    if (step === 'google' && signedIn && !triedGoogle.current) {
      triedGoogle.current = true;
      void checkGoogle();
    }
  }, [step, signedIn, checkGoogle]);
  const google = async () => {
    const returnTo = window.location.href;
    rememberAuthReturn(returnTo);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo, queryParams: { prompt: 'select_account' } } });
  };

  // 3. Байнгын код → Gmail руу код
  const sendPw = () =>
    run(async () => {
      if (setup && pw !== pw2) throw new Error('Код таарахгүй байна.');
      const r = await gate<{ email: string }>({ action: 'password', gate: gateId, password: pw });
      setPw('');
      setPw2('');
      setEmail(r.email);
      go('email');
    });

  // 4. Gmail код → сесс
  const sendCode = () =>
    run(async () => {
      const r = await gate<{ token: string; expiresAt: string }>({ action: 'email', gate: gateId, code });
      writeGateToken(r.token, r.expiresAt);
      progress.set(null);
      onPass();
    });

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loading text="Эрх шалгаж байна…" />
      </div>
    );
  }

  const steps: [Step[], string][] = [[['phone', 'sms'], 'Утас'], [['google'], 'Google'], [['password'], 'Код'], [['email'], 'Gmail код']];
  const at = steps.findIndex(([s]) => s.includes(step));

  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-4">
      <div className="w-full max-w-sm rounded-[var(--radius)] border border-line bg-card p-6 shadow-panel">
        <div className="mb-5 flex items-center gap-3">
          <img src={brandMark} alt="" width="36" height="36" className="h-9 w-9 rounded-md object-contain" />
          <div>
            <h1 className="text-[16px] font-semibold text-ink">{title || site.title}</h1>
            <p className="text-[12px] text-muted">Gennetex · админ нэвтрэлт</p>
          </div>
        </div>
        <ol className="mb-5 grid grid-cols-4 gap-1.5" aria-label="Нэвтрэх шат">
          {steps.map(([, l], i) => (
            <li key={l} aria-current={i === at ? 'step' : undefined} className={`rounded-full px-1 py-1 text-center text-[11px] font-semibold ${i < at ? 'bg-success text-white' : i === at ? 'bg-brand text-white' : 'bg-card2 text-subtle'}`}>
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
            <p className="text-[12px] text-muted">Ажилтан бол акт руу <a className="text-brand underline" href="https://akt.gennetex.com">akt.gennetex.com</a>-оор нэвтэрнэ.</p>
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
                <p className="whitespace-pre-line rounded-[var(--radius-sm)] border border-line bg-card2 p-3 text-[14px] leading-6 text-ink">{sms.instruction}</p>
                <a href={sms.smsUri} className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-brand text-[14px] font-semibold text-white">
                  <Smartphone size={16} /> SMS илгээх (144773)
                </a>
                <p className="flex items-center justify-center gap-2 text-[12px] text-muted"><RefreshCw size={13} className="animate-spin" /> SMS хүлээж байна… Нэг SMS 150₮.</p>
              </>
            )}
            <button type="button" className="w-full text-[12px] text-muted underline" onClick={restart}>Өөр дугаар оруулах</button>
          </div>
        ) : null}

        {step === 'google' ? (
          <div className="space-y-3">
            <p className="text-[13px] text-success">Утас баталгаажлаа.</p>
            <p className="text-[13px] text-muted">Утастай ижил хүний Google (Gmail) дансаар нэвтэрнэ үү.</p>
            <Button className="w-full" icon={<LogIn size={16} />} disabled={busy} onClick={signedIn ? checkGoogle : google}>{signedIn ? 'Үргэлжлүүлэх' : 'Google-ээр нэвтрэх'}</Button>
            {signedIn ? <button type="button" className="w-full text-[12px] text-muted underline" onClick={() => supabase.auth.signOut().then(google)}>Өөр Google дансаар</button> : null}
            <button type="button" className="w-full text-[12px] text-muted underline" onClick={restart}>Эхнээс нь эхлэх</button>
          </div>
        ) : null}

        {step === 'password' ? (
          <form onSubmit={(e) => { e.preventDefault(); sendPw(); }} className="space-y-3">
            <label className="block space-y-1 text-[13px] text-ink">
              <span className="flex items-center gap-1.5"><KeyRound size={14} /> {setup ? 'Өөрийн байнгын код тохируулах (6+ тэмдэгт)' : 'Өөрийн байнгын код'}</span>
              <Input type="password" autoComplete={setup ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
            </label>
            {setup ? (
              <label className="block space-y-1 text-[13px] text-ink">
                <span>Кодоо давтах</span>
                <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                <span className="block text-[12px] text-muted">Хэзээ ч мартахгүй код сонгоно уу. data.gennetex.com-д ч мөн энэ кодоор нэвтэрнэ.</span>
              </label>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy || pw.length < (setup ? 6 : 1)}>Үргэлжлүүлэх</Button>
          </form>
        ) : null}

        {step === 'email' ? (
          <form onSubmit={(e) => { e.preventDefault(); sendCode(); }} className="space-y-3">
            <label className="block space-y-1 text-[13px] text-ink">
              <span className="flex items-center gap-1.5"><Mail size={14} /> {email || 'Gmail'} хаягт ирсэн 6 оронтой код</span>
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </label>
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>Нэвтрэх</Button>
            <button type="button" className="w-full text-[12px] text-muted underline" disabled={busy} onClick={() => run(async () => { const r = await gate<{ email: string }>({ action: 'resend', gate: gateId }); setEmail(r.email); })}>Код дахин илгээх</button>
          </form>
        ) : null}

        {err ? <p className="mt-3 text-[13px] text-danger" role="alert">{err}</p> : null}
      </div>
    </div>
  );
}
