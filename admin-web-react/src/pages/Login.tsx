import { useState } from 'react';
import { LogIn, ShieldAlert } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Button } from '../components/ui';

/**
 * Google-ээр нэвтрэх — хуучин vanilla admin-web-тэй ЯГ ИЖИЛ урсгал
 * (`signInWithOAuth`, `prompt: select_account`, буцах хаяг нь
 * `/gennetex/admin`).
 *
 * ⚠️ Нэвтрэлтгүйгээр бүх RPC нь `is_admin_user()` шалгалт дээр унадаг
 * тул өгөгдөл ОГТ харагдахгүй. Тиймээс энэ дэлгэц заавал хэрэгтэй.
 */
export default function LoginPage({ error }: { error?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const signIn = async () => {
    if (!isSupabaseConfigured) {
      setMsg('Supabase тохируулаагүй байна.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${location.origin}/gennetex/admin`,
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
    <div className="flex min-h-screen items-center justify-center bg-app p-6">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-line bg-card p-8 shadow-panel">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-xl font-black text-white">
            G
          </span>
          <h1 className="text-[22px] font-bold text-ink">GENNETEX Админ</h1>
          <p className="mt-1 text-[13px] text-muted">ЖЕННЕТЕКС ХХК</p>
        </div>

        {error ? (
          <div className="mb-4 flex gap-2 rounded-[var(--radius-sm)] border-l-2 border-danger bg-danger-soft px-3 py-2.5">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[12px] leading-relaxed text-ink">{error}</p>
          </div>
        ) : null}

        <Button
          className="w-full"
          icon={<LogIn size={16} />}
          onClick={signIn}
          disabled={busy}
        >
          {busy ? 'Түр хүлээнэ үү…' : 'Google-ээр нэвтрэх'}
        </Button>

        {msg ? <p className="mt-3 text-center text-[12px] text-danger">{msg}</p> : null}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-subtle">
          Зөвхөн бүртгэлтэй, админ эрхтэй ажилтан нэвтэрнэ.
        </p>
      </div>
    </div>
  );
}
