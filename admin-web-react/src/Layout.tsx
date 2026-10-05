import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import LoginPage from './pages/Login';
import { Loading } from './components/ui';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { fetchAttendanceRequests, fetchEmployees } from './lib/data';

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

  if (authState === 'out') return <LoginPage />;

  if (authState === 'denied') {
    return (
      <LoginPage
        error={`${profile?.email || 'Энэ хаяг'} нь админ эрхгүй байна. Байгууллагынхаа хөгжүүлэгчид хандана уу.`}
      />
    );
  }

  const fullAdmin = ADMIN_ROLES.has(String(profile?.role || ''));
  const actsHost = window.location.hostname === 'akt.gennetex.com';
  const actOnly = actsHost || !fullAdmin;
  const canTemplates = fullAdmin || Boolean(profile?.permissions?.['acts.templates']);
  const canCreateAct = fullAdmin || ['menejer', 'manager'].includes(String(profile?.role || '')) || Boolean(profile?.permissions?.['acts.create']);
  const isActPath = location.pathname.startsWith('/admin/documents/acts')
    || (canTemplates && location.pathname.startsWith('/admin/settings/act-templates'));
  if (actOnly && !isActPath) return <Navigate to="/admin/documents/acts" replace />;

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
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onOpenMobile={() => setMobileOpen(true)}
          profile={profile}
          unread={counts.requests}
          onSignOut={() => supabase.auth.signOut().then(() => window.location.reload())}
          actOnly={actOnly}
          canCreateAct={canCreateAct}
          canTemplates={canTemplates}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 px-3 pb-10 pt-5 outline-none sm:px-5 lg:px-6 xl:px-8">
        <div className="mx-auto w-full max-w-[1760px]"><Outlet context={{ profile }} /></div>
        </main>
        <footer className="px-6 py-6 text-center text-[11px] text-subtle">
          © {new Date().getFullYear()} GENNETEX ХХК · ERP баримт бичгийн систем
        </footer>
      </div>
    </div>
  );
}
