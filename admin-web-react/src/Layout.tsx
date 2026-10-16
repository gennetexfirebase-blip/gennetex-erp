import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import LoginPage from './pages/Login';
import AdminGate, { adminGateLogout } from './components/AdminGate';
import { Loading } from './components/ui';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { fetchAttendanceRequests, fetchEmployees } from './lib/data';
import { siteOfPath } from './lib/nav';
import { SITES, currentSite, siteUrl } from './lib/sites';

type Profile = {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  role?: string | null;
  department_id?: string | null;
  permissions?: Record<string, boolean> | null;
};

/** Админ эрх — `role_rank() >= 3` -тэй ижил дүрэм (админ, хөгжүүлэгч). */
const ADMIN_ROLES = new Set(['admin', 'superadmin']);

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authState, setAuthState] = useState<'loading' | 'out' | 'denied' | 'ok'>('loading');
  const [counts, setCounts] = useState({ requests: 0, employees: 0 });
  const [employeeCount, setEmployeeCount] = useState({ used: 0, total: 20 });
  // Админ хэсгүүдийн 4 шаттай нэвтрэлт (akt.gennetex.com-оос бусад).
  const [gateOk, setGateOk] = useState(false);
  const passGate = useCallback(() => setGateOk(true), []);
  const gateSite = currentSite().key !== 'akt';

  // ── Нэвтрэлт ────────────────────────────────────────────────────
  // ⚠️ Нэвтрээгүй үед бүх RPC нь `is_admin_user()` дээр унаж, өгөгдөл
  // ОГТ ирдэггүй. Тиймээс эхлээд эрхийг тодорхойлж, дараа нь л
  // самбарыг үзүүлнэ.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthState('out');
      return;
    }
    let cancelled = false;

    const resolve = async () => {
      // Зөвхөн локал dev: `?design=1` — нэвтрэлтгүйгээр UI-г харах (production-д байхгүй).
      if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('design')) {
        setProfile({ id: 'design', name: 'Дизайн шалгалт', email: 'design@local', role: 'superadmin', permissions: {} });
        setAuthState('ok');
        return;
      }
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (cancelled) return;
      if (!uid) {
        setProfile(null);
        setAuthState('out');
        return;
      }
      const { data: p } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, email, role, department_id, permissions')
        .eq('id', uid)
        .maybeSingle();
      if (cancelled) return;
      const merged: Profile = p || { id: uid, email: data?.user?.email };
      setProfile(merged);
      const role = String(merged.role || '');
      const canUseActs = ['employee', 'ahlah', 'menejer', 'admin', 'superadmin'].includes(role)
        || Boolean(merged.permissions?.['acts.view']);
      setAuthState(canUseActs ? 'ok' : 'denied');
    };

    resolve();
    const { data: sub } = supabase.auth.onAuthStateChange(() => resolve());
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // ── Тоолуурууд (зөвхөн эрх баталгаажсаны дараа) ────────────────
  useEffect(() => {
    if (authState !== 'ok' || !ADMIN_ROLES.has(String(profile?.role || ''))) return;
    (async () => {
      try {
        const [reqs, emps] = await Promise.all([
          fetchAttendanceRequests('pending').catch(() => []),
          fetchEmployees().catch(() => []),
        ]);
        setCounts({
          requests: reqs.length,
          employees: emps.filter((e) => !e.registered).length,
        });
        setEmployeeCount({ used: emps.length, total: Math.max(emps.length, 20) });
      } catch {
        /* тоолуур хоосон үлдэнэ — самбар ажиллах ёстой */
      }
    })();
  }, [authState, profile?.role]);

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loading text="Эрх шалгаж байна…" />
      </div>
    );
  }

  if (authState === 'out') return gateSite ? <AdminGate signedIn={false} onPass={passGate} /> : <LoginPage />;

  if (authState === 'denied') {
    return (
      <LoginPage
        error={`${profile?.email || 'Энэ хаяг'} нь админ эрхгүй байна. Байгууллагынхаа хөгжүүлэгчид хандана уу.`}
      />
    );
  }

  const fullAdmin = ADMIN_ROLES.has(String(profile?.role || ''));
  const isSuper = String(profile?.role || '') === 'superadmin';
  const site = currentSite();
  const actsHost = site.key === 'akt';
  // Тусдаа subdomain-ууд (hr, irts, …) зөвхөн админд. Байршил — эрх олгогдсон
  // хүн ч орно (харах хүрээг сервер `location_scope` шийднэ).
  const openSite = site.key === 'bairshil';
  if (!actsHost && site.key !== 'admin' && !fullAdmin && !openSite) {
    return <LoginPage error={`${profile?.email || 'Энэ хаяг'}-аар ${site.host}-д нэвтрэх эрхгүй. Зөвхөн админ.`} />;
  }
  const actOnly = actsHost || (!fullAdmin && !openSite);
  if (gateSite && !actOnly && !gateOk) return <AdminGate signedIn onPass={passGate} />;
  const canTemplates = fullAdmin || Boolean(profile?.permissions?.['acts.templates']);
  const canCreateAct = fullAdmin || ['menejer', 'manager'].includes(String(profile?.role || '')) || Boolean(profile?.permissions?.['acts.create']);
  const isActPath = location.pathname.startsWith('/admin/documents/acts')
    || (canTemplates && location.pathname.startsWith('/admin/settings/act-templates'));
  if (actOnly && !isActPath) return <Navigate to="/admin/documents/acts" replace />;

  // Хаяг өөр subdomain-д харьяалагдвал тийш нь заана; энэ сайтынх биш бол нүүр рүү.
  const owner = actOnly ? null : siteOfPath(location.pathname);
  if (!actOnly && owner && owner.site !== site.key) {
    return <MovedNotice to={siteUrl(owner.site, location.pathname)} host={SITES[owner.site].host} title={SITES[owner.site].title} />;
  }
  if (!actOnly && ((!owner && site.key !== 'admin') || (owner?.superOnly && !isSuper) || (!fullAdmin && !owner?.openToAll))) {
    return <Navigate to={site.landing} replace />;
  }

  return (
    <div className="app-shell flex min-h-screen">
      <a href="#main-content" className="focus-ring fixed left-3 top-3 z-[200] -translate-y-20 rounded-md bg-card px-4 py-2 text-[13px] font-semibold text-ink shadow-panel transition focus:translate-y-0">Үндсэн хэсэг рүү очих</a>
      <Sidebar
        collapsed={collapsed}
        counts={counts}
        employeeCount={employeeCount}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        actOnly={actOnly}
        canTemplates={canTemplates}
        isSuper={isSuper}
        isAdmin={fullAdmin}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onOpenMobile={() => setMobileOpen(true)}
          profile={profile}
          unread={counts.requests}
          onSignOut={() => adminGateLogout().then(() => supabase.auth.signOut()).then(() => window.location.reload())}
          actOnly={actOnly}
          canCreateAct={canCreateAct}
          canTemplates={canTemplates}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 px-3 pb-10 pt-5 outline-none sm:px-5 lg:px-6 xl:px-8">
        <div className="mx-auto w-full max-w-[1760px]"><Outlet context={{ profile }} /></div>
        </main>
        <footer className="px-6 py-6 text-center text-[11px] text-subtle">
          © {new Date().getFullYear()} GENNETEX ХХК · {site.title}
        </footer>
      </div>
    </div>
  );
}

/** admin.gennetex.com-оос тусдаа subdomain руу шилжсэн хэсэг. */
function MovedNotice({ to, host, title }: { to: string; host: string; title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-4">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-line bg-card p-6 text-center shadow-panel">
        <p className="text-[15px] font-semibold text-ink">{title} тусдаа хаяг руу шилжсэн</p>
        <p className="mt-2 text-[13px] text-muted">Энэ хэсэг одоо {host} дээр ажиллана.</p>
        <a href={to} className="focus-ring mt-4 inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-brand px-4 text-[13px] font-semibold text-white">
          {host} руу очих
        </a>
        <p className="mt-3">
          <a href="/home" className="text-[12px] text-muted underline">Нүүр хуудас</a>
        </p>
      </div>
    </div>
  );
}
