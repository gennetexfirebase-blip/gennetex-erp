import { useEffect, useRef, useState } from 'react';
import { LogIn } from 'lucide-react';
import { Button, GoogleIcon, Loading } from './ui';
import AuthShell, { GoogleButton } from './AuthShell';
import { supabase } from '../lib/supabase';
import { rememberAuthReturn } from '../lib/authReturn';

/**
 * Админ хэсгүүдийн нэвтрэлт (edge function `admin-gate`) — зөвхөн Google.
 *
 * 12 цагийн токен `.gennetex.com` cookie-д — бусад subdomain дээр `resume`
 * magic-link token_hash буцааж (`verifyOtp`), Google-ийг дахин шаардахгүй.
 */

const COOKIE = 'gx_admin_gate';

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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');

  const login = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await gate<{ token: string; expiresAt: string }>({ action: 'login' });
      writeGateToken(r.token, r.expiresAt);
      onPass();
    } catch (e) {
      setErr((e as Error).message || 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  // Өөр subdomain дээр нэвтэрсэн бол (cookie) шууд нэвтрүүлнэ.
  useEffect(() => {
    (async () => {
      const token = readGateToken();
      if (token) {
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
          /* шалгаж чадсангүй — Google-ээр нэвтэрнэ */
        }
      }
      setChecking(false);
    })();
  }, [signedIn, onPass]);

  // Google-ээс буцаж ирсэн (нэвтэрсэн) бол шууд эрх шалгана.
  const tried = useRef(false);
  useEffect(() => {
    if (checking || !signedIn) return;
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
    if (!tried.current) {
      tried.current = true;
      void login();
    }
  }, [checking, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const google = async () => {
    const returnTo = window.location.href;
    rememberAuthReturn(returnTo);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo, queryParams: { prompt: 'select_account' } } });
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loading text="Эрх шалгаж байна…" />
      </div>
    );
  }

  return (
    <AuthShell title={title ? `${title} — нэвтрэх` : undefined} subtitle={signedIn ? 'Эрхийг тань шалгаж байна. Шаардлагатай бол өөр данс сонгоно уу.' : undefined}>
      {signedIn && email ? (
        <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] bg-card2 px-3.5 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-bold uppercase text-brand">{email[0]}</span>
          <div className="min-w-0">
            <p className="text-[11px] text-subtle">Нэвтэрсэн данс</p>
            <p className="truncate text-[13px] font-semibold text-ink">{email}</p>
          </div>
        </div>
      ) : null}
      {signedIn ? (
        <div className="space-y-2">
          <Button className="h-12 w-full" icon={<LogIn size={16} />} disabled={busy} onClick={login}>
            {busy ? 'Шалгаж байна…' : 'Үргэлжлүүлэх'}
          </Button>
          <GoogleButton onClick={() => void supabase.auth.signOut().then(google)} icon={<GoogleIcon />} label="Өөр Google дансаар" />
        </div>
      ) : (
        <GoogleButton onClick={google} busy={busy} icon={<GoogleIcon />} />
      )}
      {err ? <p className="mt-3 rounded-[var(--radius)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger" role="alert">{err}</p> : null}
    </AuthShell>
  );
}
