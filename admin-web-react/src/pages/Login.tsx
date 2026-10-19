import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { clearAuthErrorFromUrl, readOAuthError } from '../lib/authError';
import { rememberAuthReturn } from '../lib/authReturn';
import { GoogleIcon } from '../components/ui';
import AuthShell, { GoogleButton } from '../components/AuthShell';

/**
 * Google-ээр нэвтрэх — хуучин vanilla admin-web-тэй ЯГ ИЖИЛ урсгал
 * (`signInWithOAuth`, `prompt: select_account`).
 *
 * Буцах хаяг нь `BASE_URL`-ээс гардаг тул admin.gennetex.com дээр «/»,
 * харин gennetex.com дээр «/gennetex/admin/» болно — нэг код хоёр
 * байрлалд зөв ажиллана.
 *
 * ⚠️ Нэвтрэлтгүйгээр бүх RPC нь `is_admin_user()` шалгалт дээр унадаг
 * тул өгөгдөл ОГТ харагдахгүй. Тиймээс энэ дэлгэц заавал хэрэгтэй.
 */
export default function LoginPage({ error }: { error?: string | null }) {
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
    const returnTo = `${location.origin}${import.meta.env.BASE_URL}`;
    // Supabase энэ хаягийг зөвшөөрөөгүй бол gennetex.com руу хаяна —
    // тэнд байрлах гүүр биднийг эргүүлж авчирна.
    rememberAuthReturn(returnTo);
    try {
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: returnTo,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (e) setMsg(e.message);
    } catch (e) {
      setMsg((e as Error).message || 'Нэвтрэхэд алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {error ? (
        <div className="mb-4 flex gap-2.5 rounded-[var(--radius)] border border-danger/20 bg-danger-soft px-3.5 py-3" role="alert">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-[13px] leading-5 text-ink">{error}</p>
        </div>
      ) : null}
      <GoogleButton onClick={signIn} busy={busy} icon={<GoogleIcon />} label={error ? 'Өөр Google дансаар нэвтрэх' : 'Google-ээр нэвтрэх'} />
      {msg ? <p className="mt-3 rounded-[var(--radius)] bg-danger-soft px-3 py-2.5 text-center text-[13px] text-danger" role="alert">{msg}</p> : null}
    </AuthShell>
  );
}
