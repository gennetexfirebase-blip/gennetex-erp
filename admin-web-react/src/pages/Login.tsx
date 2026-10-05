import { useEffect, useState } from 'react';
import { ChevronRight, LogIn, ShieldAlert, ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { clearAuthErrorFromUrl, readOAuthError } from '../lib/authError';
import { rememberAuthReturn } from '../lib/authReturn';
import { Button } from '../components/ui';
import brandMark from '../assets/report-logo.png';

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
    <div className="min-h-screen bg-app p-3 sm:p-6 lg:grid lg:place-items-center">
      <div className="mx-auto grid min-h-[calc(100vh-24px)] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-[0_20px_60px_rgba(42,41,37,0.10)] sm:min-h-[680px] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-14 place-items-center rounded-lg bg-card p-1.5 shadow-sm"><img src={brandMark} alt="Gennetex" width="56" height="44" className="h-full w-full object-contain" /></span>
              <div><p className="text-[15px] font-bold tracking-[0.04em]">GENNETEX</p><p className="text-[11px] text-slate-400">ERP SYSTEM</p></div>
            </div>
            <div className="mt-24 max-w-md">
              <p className="mb-4 text-[13px] font-medium text-sky-300">Ажил гүйцэтгэлийн акт</p>
              <h1 className="font-display text-[38px] font-semibold leading-[1.15]">Талбай дээр эхэлсэн ажлыг албан баримтаар дуусгана.</h1>
              <p className="mt-5 text-[14px] leading-7 text-slate-400">Төсөл, материал, шалгах хуудас, ажлын зураг, хүлээлцэх хүмүүсийг нэг урсгалд холбосон Gennetex-ийн баримт бичгийн орчин.</p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6">
            <p className="mb-3 text-[11px] text-slate-500">Актын урсгал</p>
            <div className="flex items-center gap-2 text-[12px] font-medium text-slate-300"><span>Төсөл</span><ChevronRight size={13} className="text-slate-600" aria-hidden="true" /><span>Боловсруулах</span><ChevronRight size={13} className="text-slate-600" aria-hidden="true" /><span>Баталгаажуулах</span><ChevronRight size={13} className="text-slate-600" aria-hidden="true" /><span>Архив</span></div>
          </div>
        </section>

        <section className="flex items-start justify-center px-6 py-10 sm:px-12 sm:py-12 lg:items-center lg:px-14">
          <div className="w-full max-w-sm">
            <div className="mb-9">
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <span className="grid h-11 w-14 place-items-center rounded-lg bg-card p-1.5 shadow-sm ring-1 ring-line"><img src={brandMark} alt="Gennetex" width="56" height="44" className="h-full w-full object-contain" /></span>
                <div><p className="text-[15px] font-bold tracking-[0.04em] text-ink">GENNETEX</p><p className="text-[11px] text-subtle">ERP SYSTEM</p></div>
              </div>
              <p className="text-[13px] font-medium text-brand">Gennetex актын систем</p>
              <h2 className="font-display mt-2 text-[30px] font-semibold text-ink">Системд нэвтрэх</h2>
              <p className="mt-2 text-[13px] leading-5 text-muted">Байгууллагын Google хаягаа сонгон үргэлжлүүлнэ үү.</p>
            </div>

            {error ? (
              <div className="mb-4 flex gap-2 rounded-[var(--radius-sm)] border border-danger/20 bg-danger-soft px-3 py-3">
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-danger" />
                <p className="text-[12px] leading-relaxed text-ink">{error}</p>
              </div>
            ) : null}

            <Button
              className="h-11 w-full"
              icon={<LogIn size={16} />}
              onClick={signIn}
              disabled={busy}
            >
              {busy ? 'Түр хүлээнэ үү…' : 'Google-ээр нэвтрэх'}
            </Button>

            {msg ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2.5 text-center text-[12px] text-danger">{msg}</p> : null}

            <div className="mt-6 flex items-start gap-2 border-t border-line pt-5 text-[11px] leading-5 text-subtle">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              <p>Зөвхөн эрх олгогдсон ажилтан нэвтрэх боломжтой. Нэвтрэхэд байгууллагын мэдээллийн аюулгүй байдлын журам үйлчилнэ.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
