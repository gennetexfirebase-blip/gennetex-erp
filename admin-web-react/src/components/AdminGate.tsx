import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, KeyRound, LogIn, RefreshCw, Smartphone } from 'lucide-react';
import { Button, GoogleIcon, Input, Loading } from './ui';
import AuthShell, { GoogleButton } from './AuthShell';
import { supabase } from '../lib/supabase';
import { rememberAuthReturn } from '../lib/authReturn';

/**
 * Админ хэсгүүдийн нэвтрэлт (edge function `admin-gate`):
 *   1. Утас — verify.mn (өөрийн утаснаас 144773 руу код илгээнэ)   2. Google   3. Өөрийн байнгын код
 *
 * Subdomain бүр тусдаа нэвтрэлттэй — өөр subdomain руу шилжихэд утас + код
 * дахин асууна. Харин Google-ийг дахин шаардахгүй:
 *   • `gx_admin_gate` (.gennetex.com) — Google-ээр нэвтэрсэн хүнийг бусад
 *     subdomain дээр `resume`-ээр (magic-link token_hash) автоматаар нэвтрүүлнэ;
 *   • `gx_admin_site` (зөвхөн энэ host) — энэ subdomain-ийн шатыг давсан эсэх.
 * Явц (gate id, шат) sessionStorage-д — Google руу шилжээд буцахад үргэлжилнэ.
 * Кодоо мартсан бол «Сэргээх» — профайлын утас руу verify.mn SMS → шинэ код.
 */

const GLOBAL = 'gx_admin_gate';
const SITE = 'gx_admin_site';
const PROGRESS = 'gx_admin_gate_step';
/** Өмнө код илгээсэн дугаар — бүх subdomain-д (дугаар дахин бичихгүй). */
const PHONE = 'gx_admin_phone';
const mask = (p: string) => `${p.slice(0, 2)}••••${p.slice(-2)}`;
type Step = 'phone' | 'sms' | 'google' | 'password' | 'reset';

const progress = {
  get: (): { gate: string; step: Step } | null => {
    try {
      return JSON.parse(sessionStorage.getItem(PROGRESS) || 'null');
    } catch {
      return null;
    }
  },
  set: (v: { gate: string; step: Step } | null) => {
    try {
      if (v) sessionStorage.setItem(PROGRESS, JSON.stringify(v));
      else sessionStorage.removeItem(PROGRESS);
    } catch {
      /* хувийн цонх */
    }
  },
};

const sharedDomain = () => {
  const h = location.hostname;
  return h.endsWith('.gennetex.com') || h === 'gennetex.com' ? '; domain=.gennetex.com' : '';
};
const readCookie = (name: string) => document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1] || '';
function rememberPhone(p: string) {
  document.cookie = `${PHONE}=${p}; path=/; max-age=${180 * 86400}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${sharedDomain()}`;
}
function writeCookie(name: string, token: string, expiresAt: string | undefined, shared: boolean) {
  const maxAge = token && expiresAt ? Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;
  document.cookie = `${name}=${token}; path=/; max-age=${maxAge}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${shared ? sharedDomain() : ''}`;
}
export const readGateToken = () => readCookie(GLOBAL);

/** Гарах — энэ subdomain болон бүх subdomain-ийн нэвтрэлтийг цуцална. */
export async function adminGateLogout() {
  const tokens = [readCookie(SITE), readCookie(GLOBAL)].filter(Boolean);
  writeCookie(SITE, '', undefined, false);
  writeCookie(GLOBAL, '', undefined, true);
  await Promise.all(tokens.map((token) => supabase.functions.invoke('admin-gate', { body: { action: 'logout', token } }).catch(() => null)));
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
    if (/Failed to send|fetch/i.test(msg)) msg = 'Сервертэй холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.';
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
  const [checking, setChecking] = useState(true);
  const saved = progress.get();
  const [step, setStepRaw] = useState<Step>(saved?.step || 'phone');
  const [gateId, setGateId] = useState<string | null>(saved?.gate || null);
  const [phone, setPhone] = useState('');
  // Өмнө илгээсэн дугаар (cookie) эсвэл Google-ээр нэвтэрсэн бол бүртгэлтэй утас (далдалсан).
  const [savedPhone] = useState(() => (/^\d{8}$/.test(readCookie(PHONE)) ? readCookie(PHONE) : ''));
  const [myPhone, setMyPhone] = useState('');
  // Google-ээр нэвтэрсэн хүнд дугаар бүртгэлтэй эсэх (undefined — мэдэгдээгүй). false бол эхлээд бүртгүүлнэ.
  const [registered, setRegistered] = useState<boolean | undefined>(undefined);
  // Нэвтрээгүй хүн бүртгэлгүй дугаар оруулсан — Google-ээр нэвтэрч бүртгүүлэхийг санал болгоно.
  const [needRegister, setNeedRegister] = useState(false);
  const [manual, setManual] = useState(false);
  const [sms, setSms] = useState<{ instruction: string; smsUri: string; code: string; expiresAt: string; expired?: boolean } | null>(null);
  const [setup, setSetup] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  // Энэ subdomain-д ирэхэд Google аль хэдийн мэдэгдэж байсан эсэх — шатны тоо (2 эсвэл 3).
  // (Google руу явж буцсан явц — progress — байвал Google нь энэ удаагийн шат байсан гэсэн үг.)
  const [googleKnown, setGoogleKnown] = useState(signedIn && !saved);

  const setStep = (s: Step, g = gateId) => {
    setStepRaw(s);
    progress.set(s === 'phone' || !g ? null : { gate: g, step: s });
  };
  const restart = () => {
    setGateId(null);
    setSms(null);
    setStep('phone', null);
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

  // 1) Энэ subdomain-ийг аль хэдийн давсан бол шууд. 2) Өөр subdomain-д Google-ээр
  //    нэвтэрсэн бол (cookie) Google-гүйгээр нэвтрүүлж, утас + код руу шилжинэ.
  useEffect(() => {
    let live = true;
    (async () => {
      const siteTok = readCookie(SITE);
      if (signedIn && siteTok) {
        try {
          const r = await gate<{ ok: boolean }>({ action: 'check', token: siteTok });
          if (r.ok) return onPass();
        } catch {
          /* шатаар нэвтэрнэ */
        }
        writeCookie(SITE, '', undefined, false);
      }
      const globalTok = readCookie(GLOBAL);
      if (!signedIn && globalTok && !progress.get()) {
        try {
          const r = await gate<{ ok: boolean; tokenHash?: string }>({ action: 'resume', token: globalTok });
          if (r.ok && r.tokenHash) {
            await signInWith(r.tokenHash);
            if (live) setGoogleKnown(true);
          } else writeCookie(GLOBAL, '', undefined, true);
        } catch {
          /* Google-ээр нэвтэрнэ */
        }
      }
      if (live) setChecking(false);
    })();
    return () => {
      live = false;
    };
  }, [signedIn, onPass]);

  useEffect(() => {
    if (signedIn) void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
  }, [signedIn]);

  // Google-ээр нэвтэрсэн, гэхдээ энэ төхөөрөмжид дугаар санагдаагүй бол бүртгэлтэй утсыг асууна.
  useEffect(() => {
    if (!signedIn) return;
    gate<{ phone: string | null }>({ action: 'my_phone' })
      .then((r) => {
        setMyPhone(r.phone || '');
        setRegistered(!!r.phone);
      })
      .catch(() => null);
  }, [signedIn]);
  const registerMode = step === 'phone' && signedIn && registered === false;

  /** quick — санагдсан/бүртгэлтэй дугаар руу (бичихгүй); үгүй бол оруулсан дугаар руу. */
  const start = (quick = false) =>
    run(async () => {
      const typed = phone.replace(/\D/g, '').slice(-8);
      const body = quick ? (savedPhone ? { phone: savedPhone } : { self: true }) : { phone: typed };
      let r: { gate: string; instruction: string; smsUri: string; code: string; expiresAt: string };
      try {
        r = await gate({ action: 'start', host: location.hostname, ...body });
      } catch (e) {
        if (/бүртгэлгүй/.test((e as Error).message)) setNeedRegister(true);
        throw e;
      }
      if (!quick && /^\d{8}$/.test(typed)) rememberPhone(typed);
      setGateId(r.gate);
      setSms({ instruction: r.instruction, smsUri: r.smsUri, code: r.code, expiresAt: r.expiresAt });
      setStep('sms', r.gate);
    });

  /** Утасгүй админ — өөрийн дугаараа бүртгүүлж verify.mn-ээр баталгаажуулна (дараа нь профайлд хадгалагдана). */
  const register = () =>
    run(async () => {
      const typed = phone.replace(/\D/g, '').slice(-8);
      const r = await gate<{ gate: string; instruction: string; smsUri: string; code: string; expiresAt: string }>({ action: 'register', phone: typed, host: location.hostname });
      rememberPhone(typed);
      setGateId(r.gate);
      setSms({ instruction: r.instruction, smsUri: r.smsUri, code: r.code, expiresAt: r.expiresAt });
      setStep('sms', r.gate);
    });

  // verify.mn — 3 секунд тутам; VERIFIED бол шууд зогсоно (нэг SMS 150₮).
  useEffect(() => {
    if ((step !== 'sms' && step !== 'reset') || !gateId || !sms || sms.expired) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await gate<{ verified: boolean; expired?: boolean; google?: boolean; setup?: boolean }>({ action: step === 'reset' ? 'reset_phone' : 'phone', gate: gateId });
        if (stop) return;
        if (r.verified && step === 'reset') {
          setSetup(true);
          setPw('');
          setPw2('');
          setSms(null);
          return setStep('password');
        }
        if (r.verified) {
          if (r.google === false) {
            setSetup(!!r.setup);
            return setStep('password');
          }
          return setStep('google');
        }
        if (r.expired || new Date(sms.expiresAt) < new Date()) return setSms((x) => x && { ...x, expired: true });
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
  }, [step, gateId, sms]); // eslint-disable-line react-hooks/exhaustive-deps

  // Google-ээс буцаж ирсэн (нэвтэрсэн) бол шууд шалгана.
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

  // Нэвтэрсэн Gmail-ээс гараад 3 шатыг эхнээс нь (өөр дансаар) эхлүүлнэ.
  const switchAccount = () =>
    run(async () => {
      await adminGateLogout();
      progress.set(null);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => null);
      setEmail('');
      setGoogleKnown(false);
      tried.current = false;
      restart();
    });

  // Кодоо мартсан — бүртгэлтэй утас руу verify.mn SMS илгээж нотолсны дараа шинэ код тохируулна.
  const resetStart = () =>
    run(async () => {
      const r = await gate<{ instruction: string; smsUri: string; code: string; expiresAt: string }>({ action: 'reset_start', gate: gateId, host: location.hostname });
      setSms({ instruction: r.instruction, smsUri: r.smsUri, code: r.code, expiresAt: r.expiresAt });
      setStep('reset');
    });

  const sendPw = () =>
    run(async () => {
      if (setup && pw !== pw2) throw new Error('Код таарахгүй байна.');
      const r = await gate<{ token: string; expiresAt: string }>({ action: 'password', gate: gateId, password: pw });
      writeCookie(SITE, r.token, r.expiresAt, false); // энэ subdomain
      writeCookie(GLOBAL, r.token, r.expiresAt, true); // бусад subdomain — Google-гүй
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

  const steps: [Step[], string][] = googleKnown
    ? [[['phone', 'sms'], 'Утас'], [['password', 'reset'], 'Өөрийн код']]
    : [[['phone', 'sms'], 'Утас'], [['google'], 'Google'], [['password', 'reset'], 'Өөрийн код']];
  const at = steps.findIndex(([s]) => s.includes(step));

  return (
    <AuthShell
      title={title ? `${title} — нэвтрэх` : undefined}
      subtitle={googleKnown ? 'Өөр хэсэг рүү шилжлээ — утсаа баталгаажуулаад өөрийн кодоо оруулна уу.' : 'Утас, Google, өөрийн код — гурван шатаар нэвтэрнэ.'}
    >
      <ol className="mb-6 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Нэвтрэх шат">
        {steps.map(([, l], i) => (
          <li key={l} aria-current={i === at ? 'step' : undefined} className="min-w-0">
            <span className={`block h-1 rounded-full ${i < at ? 'bg-brand' : i === at ? 'bg-brand/60' : 'bg-card2'}`} />
            <span className={`mt-1.5 flex items-center gap-1 truncate text-[12px] font-semibold ${i <= at ? 'text-ink' : 'text-subtle'}`}>
              {i < at ? <Check size={12} className="shrink-0 text-brand" /> : <span className="tabular-nums text-subtle">{i + 1}.</span>} {l}
            </span>
          </li>
        ))}
      </ol>

      {signedIn && email ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-line bg-card2 px-3.5 py-2.5">
          <GoogleIcon size={18} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-subtle">Нэвтэрсэн Gmail</span>
            <span className="block truncate text-[13px] font-semibold text-ink">{email}</span>
          </span>
          <button type="button" onClick={switchAccount} disabled={busy} className="focus-ring shrink-0 rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-semibold text-brand hover:bg-brand-soft">
            Өөр имэйлээр
          </button>
        </div>
      ) : null}

      {registerMode ? (
        <form onSubmit={(e) => { e.preventDefault(); register(); }} className="space-y-3">
          <p className="rounded-xl border border-line bg-card2 px-4 py-3 text-[13px] leading-5 text-ink">
            Таны бүртгэлд утасны дугаар алга. Өөрийн дугаараа оруулаад SMS-ээр баталгаажуулна уу — баталгаажсаны дараа системд бүртгэгдэж, цаашид энэ дугаараар нэвтэрнэ.
          </p>
          <label className="block space-y-1.5 text-[13px] text-ink">
            <span className="flex items-center gap-1.5 font-medium"><Smartphone size={14} /> Өөрийн утасны дугаар</span>
            <Input inputMode="numeric" autoComplete="tel" placeholder="99112233" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus className="h-11" />
          </label>
          <Button type="submit" className="h-11 w-full" disabled={busy || phone.replace(/\D/g, '').length < 8}>{busy ? 'Түр хүлээнэ үү…' : 'Бүртгүүлж баталгаажуулах'}</Button>
        </form>
      ) : null}

      {step === 'phone' && !registerMode && !manual && (savedPhone || myPhone) ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-card2 px-4 py-3">
            <Smartphone size={18} className="shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-subtle">Код илгээх дугаар</span>
              <span className="block text-[17px] font-semibold tracking-[0.06em] tabular-nums text-ink">{savedPhone ? mask(savedPhone) : myPhone}</span>
            </span>
          </div>
          <Button className="h-11 w-full" disabled={busy} onClick={() => start(true)} autoFocus>{busy ? 'Түр хүлээнэ үү…' : 'Код илгээх'}</Button>
          <button type="button" className="w-full text-[12px] text-muted underline" onClick={() => setManual(true)}>Өөр дугаар оруулах</button>
        </div>
      ) : null}

      {step === 'phone' && !registerMode && (manual || !(savedPhone || myPhone)) ? (
        <form onSubmit={(e) => { e.preventDefault(); start(); }} className="space-y-3">
          <label className="block space-y-1.5 text-[13px] text-ink">
            <span className="flex items-center gap-1.5 font-medium"><Smartphone size={14} /> Утасны дугаар</span>
            <Input inputMode="numeric" autoComplete="tel" placeholder="99112233" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus className="h-11" />
          </label>
          <Button type="submit" className="h-11 w-full" disabled={busy || phone.replace(/\D/g, '').length < 8}>{busy ? 'Түр хүлээнэ үү…' : 'Үргэлжлүүлэх'}</Button>
          {needRegister && !signedIn ? (
            <GoogleButton onClick={google} icon={<GoogleIcon />} label="Google-ээр нэвтэрч дугаараа бүртгүүлэх" />
          ) : null}
        </form>
      ) : null}

      {step === 'reset' && !sms ? (
        <Button className="h-11 w-full" onClick={() => setStep('password')}>Өөрийн код руу буцах</Button>
      ) : null}

      {step === 'reset' && sms ? (
        <div className="space-y-3">
          <p className="text-[13px] font-medium text-ink">Кодоо сэргээх — бүртгэлтэй утаснаасаа SMS илгээж баталгаажуулна уу.</p>
          {sms.expired ? (
            <>
              <p className="rounded-xl bg-warning-soft p-3 text-[13px] text-warning">Хугацаа дууссан. Дахин оролдоно уу.</p>
              <Button className="h-11 w-full" disabled={busy} onClick={() => { setStep('password'); setSms(null); }}>Буцах</Button>
            </>
          ) : (
            <>
              <p className="whitespace-pre-line rounded-xl border border-line bg-card2 p-3.5 text-[14px] leading-6 text-ink">{sms.instruction}</p>
              <a href={sms.smsUri} className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-brand text-[14px] font-semibold text-white hover:bg-brand-600">
                <Smartphone size={16} /> SMS илгээх (144773)
              </a>
              <p className="flex items-center justify-center gap-2 text-[12px] text-muted"><RefreshCw size={13} className="animate-spin" /> SMS хүлээж байна…</p>
            </>
          )}
          <button type="button" className="w-full text-[12px] text-muted underline" onClick={() => { setStep('password'); setSms(null); }}>Буцах — кодоо санаж байна</button>
        </div>
      ) : null}

      {step === 'sms' ? (
        <div className="space-y-3">
          {!sms ? (
            <>
              <p className="text-[13px] text-muted">Утасны баталгаажуулалт тасарсан. Дахин эхлүүлнэ үү.</p>
              <Button className="h-11 w-full" onClick={restart}>Эхнээс нь</Button>
            </>
          ) : sms.expired ? (
            <>
              <p className="rounded-xl bg-warning-soft p-3 text-[13px] text-warning">Хугацаа дууссан. Өмнөх код ({sms.code}) хүчингүй боллоо — шинэ код аваад дахин илгээнэ үү.</p>
              <Button className="h-11 w-full" disabled={busy} onClick={() => start(!manual && !!(savedPhone || myPhone))}>Шинэ код авах</Button>
            </>
          ) : (
            <>
              {/* displayInstruction-ийг үгчлэн — аль дугаараас илгээхийг заадаг. */}
              <p className="whitespace-pre-line rounded-xl border border-line bg-card2 p-3.5 text-[14px] leading-6 text-ink">{sms.instruction}</p>
              <a href={sms.smsUri} className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-brand text-[14px] font-semibold text-white hover:bg-brand-600">
                <Smartphone size={16} /> SMS илгээх (144773)
              </a>
              <p className="flex items-center justify-center gap-2 text-[12px] text-muted"><RefreshCw size={13} className="animate-spin" /> SMS хүлээж байна…</p>
            </>
          )}
          <button type="button" className="w-full text-[12px] text-muted underline" onClick={restart}>Өөр дугаар оруулах</button>
        </div>
      ) : null}

      {step === 'google' ? (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-success"><Check size={14} /> Утас баталгаажлаа.</p>
          <p className="text-[13px] text-muted">Утастай ижил хүний Google (Gmail) дансаар нэвтэрнэ үү.</p>
          {signedIn ? (
            <>
              <Button className="h-11 w-full" icon={<LogIn size={16} />} disabled={busy} onClick={checkGoogle}>Үргэлжлүүлэх</Button>
              <GoogleButton onClick={() => void supabase.auth.signOut().then(google)} icon={<GoogleIcon />} label="Өөр Google дансаар" />
            </>
          ) : (
            <GoogleButton onClick={google} busy={busy} icon={<GoogleIcon />} />
          )}
          <button type="button" className="w-full text-[12px] text-muted underline" onClick={restart}>Эхнээс нь эхлэх</button>
        </div>
      ) : null}

      {step === 'password' ? (
        <form onSubmit={(e) => { e.preventDefault(); sendPw(); }} className="space-y-3">
          <label className="block space-y-1.5 text-[13px] text-ink">
            <span className="flex items-center gap-1.5 font-medium"><KeyRound size={14} /> {setup ? 'Өөрийн байнгын код тохируулах (6+ тэмдэгт)' : 'Өөрийн байнгын код'}</span>
            <Input type="password" autoComplete={setup ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} autoFocus className="h-11" />
          </label>
          {setup ? (
            <label className="block space-y-1.5 text-[13px] text-ink">
              <span className="font-medium">Кодоо давтах</span>
              <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-11" />
              <span className="block text-[12px] text-muted">Хэзээ ч мартахгүй код сонгоно уу.</span>
            </label>
          ) : null}
          <Button type="submit" className="h-11 w-full" disabled={busy || pw.length < (setup ? 6 : 1)}>{busy ? 'Нэвтэрч байна…' : setup ? 'Шинэ код хадгалаад нэвтрэх' : 'Нэвтрэх'}</Button>
          {!setup ? (
            <button type="button" className="w-full text-[12px] text-muted underline" disabled={busy} onClick={resetStart}>
              Кодоо мартсан уу? Сэргээх
            </button>
          ) : null}
        </form>
      ) : null}

      {err ? <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] text-danger" role="alert">{err}</p> : null}
    </AuthShell>
  );
}
