import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
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
};

/** Админ эрх — `role_rank() >= 3` -тэй ижил дүрэм (админ, хөгжүүлэгч). */
const ADMIN_ROLES = new Set(['admin', 'superadmin']);

export default function Layout() {
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
        .select('id, name, avatar_url, email, role')
        .eq('id', uid)
        .maybeSingle();
      if (cancelled) return;
      const merged: Profile = p || { id: uid, email: data?.user?.email };
      setProfile(merged);
      setAuthState(ADMIN_ROLES.has(String(merged.role || '')) ? 'ok' : 'denied');
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
    if (authState !== 'ok') return;
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
  }, [authState]);

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

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar
        collapsed={collapsed}
        counts={counts}
        employeeCount={employeeCount}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onOpenMobile={() => setMobileOpen(true)}
          profile={profile}
          unread={counts.requests}
          onSignOut={() => supabase.auth.signOut().then(() => window.location.reload())}
        />
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
        <footer className="border-t border-line px-6 py-4 text-center text-[12px] text-subtle">
          © Developed by <span className="text-danger">♥</span> GENNETEX
        </footer>
      </div>
    </div>
  );
}
