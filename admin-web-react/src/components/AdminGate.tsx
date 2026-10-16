import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, LogIn, MessageSquare, Smartphone } from 'lucide-react';
import { Button, Input, Loading } from './ui';
import { supabase } from '../lib/supabase';
import { currentSite } from '../lib/sites';
import { rememberAuthReturn } from '../lib/authReturn';
import brandMark from '../assets/report-logo.png';

/**
 * Админ хэсгүүдийн нэвтрэлт (edge function `admin-gate`):
 *   1. Утас руу ирсэн SMS код   2. Google   3. Өөрийн байнгын код
 *
 * 12 цагийн токен `.gennetex.com` cookie-д — бусад subdomain дээр `resume`
 * magic-link token_hash буцааж (`verifyOtp`), Google-ийг дахин шаардахгүй.
 * Явц (gate id, шат) sessionStorage-д — Google руу шилжээд буцахад үргэлжилнэ.
 */

const COOKIE = 'gx_admin_gate';
const PROGRESS = 'gx_admin_gate_step';
type Step = 'phone' | 'sms' | 'google' | 'password';
const progress = {
  get: (): { gate: string; step: Step; phone: string } | null => {
    try {
      return JSON.parse(sessionStorage.getItem(PROGRESS) || 'null');
    } catch {
      return null;
    }
  },
  set: (v: { gate: string; step: Step; phone: string } | null) => {
    try {
      if (v) sessionStorage.setItem(PROGRESS, JSON.stringify(v));
      else sessionStorage.removeItem(PROGRESS);
    } catch {
      /* хувийн цонх */
    }
  },
};

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

/** token_hash-аар Supabase сесс үүсгэнэ (өөр хүнээр нэвтэрсэн бол эхлээд гарна). */
async function signInWith(tokenHash: string) {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => null);
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (error) throw new Error('Нэвтрэх сесс үүсгэж чадсангүй: ' + error.message);
}

export default function AdminGate({ signedIn, onPass, title }: { signedIn: boolean; onPass: () => void; title?: string }) {
  const site = currentSite();
  const [checking, setChecking] = useState(true);
  const saved = progress.get();
  const [step, setStepRaw] = useState<Step>(saved?.step || 'phone');
  const [gateId, setGateId] = useState<string | null>(saved?.gate || null);
  const [phone, setPhone] = useState('');
  const [masked, setMasked] = useState(saved?.phone || '');
  const setStep = (s: Step, g = gateId, m = masked) => {
    setStepRaw(s);
    progress.set(s === 'phone' || !g ? null : { gate: g, step: s, phone: m });
  };
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      const m = (e as Error).message || 'Алдаа гарлаа';
      setErr(m);
      if (/Хугацаа дууссан|Алхам буруу|Эхнээс/.test(m)) {
        setGateId(null);
        setStep('phone', null);
      }
    } finally {
      setBusy(false);
    }
  };

  // Өөр subdomain дээр нэвтэрсэн бол (cookie) шууд нэвтрүүлнэ.
  useEffect(() => {
    (async () => {
      const token = readGateToken();
      // Нэвтрэлтийн явц дунд (Google-ээс буцсан) бол resume хийхгүй.
      if (token && !progress.get()) {
        try {
          if (signedIn) {
            const r = await gate<{ ok: boolean }>({ action: 'check', token });
            if (r.ok) return onPass();
          }
          const r = await gate<{ ok: boolean; tokenHash?: string }>({ action: 'resume', token });
          if (r.ok && r.tokenHash) {
            await signInWith(r.tokenHash);
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

  const start = () =>
    run(async () => {
      const r = await gate<{ gate: string; phone: string }>({ action: 'start', phone });
      setGateId(r.gate);
      setMasked(r.phone);
      setCode('');
      setStep('sms', r.gate, r.phone);
    });
  const sendSms = () =>
    run(async () => {
      await gate({ action: 'sms', gate: gateId, code });
      setStep('google');
    });

  // Google — нэвтэрсэн бол шууд шалгана.
  const checkGoogle = useCallback(async () => {
    await run(async () => {
      const r = await gate<{ setup: boolean }>({ action: 'google', gate: gateId });
      setSetup(r.setup);
      setStep('password');
    });
  }, [gateId]); // eslint-disable-line react-hooks/exhaustive-deps
  const tried = useRef(false);
  useEffect(() => {
    if (!checking && step === 'google' && signedIn && !tried.current) {
      tried.current = true;
      void checkGoogle();
    }
  }, [checking, step, signedIn, checkGoogle]);
  const google = async () => {
    const returnTo = window.location.href;
    rememberAuthReturn(returnTo);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo, queryParams: { prompt: 'select_account' } } });
  };
  const sendPw = () =>
    run(async () => {
      if (setup && pw !== pw2) throw new Error('Код таарахгүй байна.');
      const r = await gate<{ token: string; expiresAt: string }>({ action: 'password', gate: gateId, password: pw });
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

  const steps: [Step[], string][] = [[['phone', 'sms'], 'Утас'], [['google'], 'Google'], [['password'], 'Өөрийн код']];
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
        <ol className="mb-5 grid grid-cols-3 gap-1.5" aria-label="Нэвтрэх шат">
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
            <Button type="submit" className="w-full" disabled={busy || phone.replace(/\D/g, '').length < 8}>{busy ? 'Код илгээж байна…' : 'Код авах'}</Button>
            <p className="text-[12px] text-muted">Ажилтан бол акт руу <a className="text-brand underline" href="https://akt.gennetex.com">akt.gennetex.com</a>-оор нэвтэрнэ.</p>
          </form>
        ) : null}

        {step === 'sms' ? (
          <form onSubmit={(e) => { e.preventDefault(); sendSms(); }} className="space-y-3">
            <label className="block space-y-1 text-[13px] text-ink">
              <span className="flex items-center gap-1.5"><MessageSquare size={14} /> {masked} дугаарт ирсэн 6 оронтой код</span>
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </label>
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>Үргэлжлүүлэх</Button>
            <div className="flex justify-between text-[12px]">
              <button type="button" className="text-muted underline" onClick={() => { setStep('phone', null); setGateId(null); }}>Өөр дугаар</button>
              <button type="button" className="text-muted underline" disabled={busy} onClick={start}>Код дахин авах</button>
            </div>
          </form>
        ) : null}

        {step === 'google' ? (
          <div className="space-y-3">
            <p className="text-[13px] text-success">Утас баталгаажлаа.</p>
            <p className="text-[13px] text-muted">Утастай ижил хүний Google (Gmail) дансаар нэвтэрнэ үү.</p>
            <Button className="w-full" icon={<LogIn size={16} />} disabled={busy} onClick={signedIn ? checkGoogle : google}>{signedIn ? 'Үргэлжлүүлэх' : 'Google-ээр нэвтрэх'}</Button>
            {signedIn ? <button type="button" className="w-full text-[12px] text-muted underline" onClick={() => supabase.auth.signOut().then(google)}>Өөр Google дансаар</button> : null}
            <button type="button" className="w-full text-[12px] text-muted underline" onClick={() => { setStep('phone', null); setGateId(null); }}>Эхнээс нь эхлэх</button>
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
                <span className="block text-[12px] text-muted">Хэзээ ч мартахгүй код сонгоно уу.</span>
              </label>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy || pw.length < (setup ? 6 : 1)}>{busy ? 'Нэвтэрч байна…' : 'Нэвтрэх'}</Button>
          </form>
        ) : null}

        {err ? <p className="mt-3 text-[13px] text-danger" role="alert">{err}</p> : null}
      </div>
    </div>
  );
}
