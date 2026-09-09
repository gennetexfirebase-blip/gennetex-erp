import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { FileSpreadsheet, LogIn, ShieldAlert } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { clearAuthErrorFromUrl, readOAuthError } from '../lib/authError';

/**
 * Нэвтрэлтийн хаалга.
 *
 * ERP-тэй ижил Supabase project дээр ажилладаг тул ажилтан ERP-д ордог
 * ЯГ ТЭР Google хаягаараа энд нэвтэрнэ. Нэвтрэлтгүйгээр тооллогын түүх
 * (`count_sessions`) RLS дээр бүрэн хаалттай.
 */
export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div
        className="flex h-full items-center justify-center text-[13px]"
        style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}
      >
        Түр хүлээнэ үү…
      </div>
    );
  }

  if (!session) return <LoginScreen />;
  return <>{children(session)}</>;
}

function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Google-ээс алдаатай буцаж ирсэн бол шалтгааныг нь харуулна.
  useEffect(() => {
    const err = readOAuthError();
    if (err) {
      setMsg(err);
      clearAuthErrorFromUrl();
    }
  }, []);

  const signIn = async () => {
    if (!isSupabaseConfigured) {
      setMsg('Supabase тохируулаагүй байна.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: location.origin,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) setMsg(error.message);
    } catch (e) {
      setMsg((e as Error).message || 'Нэвтрэхэд алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="ec-panel w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'var(--found-bg)', color: 'var(--found-text)' }}
          >
            <FileSpreadsheet size={24} />
          </span>
          <h1 className="text-[20px] font-bold" style={{ color: 'var(--text)' }}>
            GENNETEX Тооллого
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Excel харьцуулалт ба тооллогын түүх
          </p>
        </div>

        <button
          className="ec-btn ec-btn-primary h-10 w-full justify-center"
          onClick={() => void signIn()}
          disabled={busy}
        >
          <LogIn size={16} /> {busy ? 'Түр хүлээнэ үү…' : 'Google-ээр нэвтрэх'}
        </button>

        {msg ? (
          <div
            className="mt-4 flex gap-2 rounded px-3 py-2.5"
            style={{ background: 'var(--missing-bg)' }}
          >
            <ShieldAlert size={16} className="mt-0.5 flex-none" style={{ color: 'var(--missing-text)' }} />
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--missing-text)' }}>
              {msg}
            </p>
          </div>
        ) : null}

        <p className="mt-6 text-center text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          ERP-д ордог ижил Google хаягаараа нэвтэрнэ үү.
        </p>
      </div>
    </div>
  );
}
