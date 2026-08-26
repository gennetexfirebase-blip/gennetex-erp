import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { fetchAttendanceRequests, fetchEmployees } from './lib/data';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<{
    name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null>(null);
  const [counts, setCounts] = useState({ requests: 0, employees: 0 });
  const [employeeCount, setEmployeeCount] = useState({ used: 0, total: 20 });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const { data: sessionData } = await supabase.auth.getUser();
      const uid = sessionData?.user?.id;
      if (uid) {
        const { data } = await supabase
          .from('profiles')
          .select('name, avatar_url, email')
          .eq('id', uid)
          .maybeSingle();
        setProfile(data || { email: sessionData?.user?.email });
      }
      try {
        const [reqs, emps] = await Promise.all([
          fetchAttendanceRequests('pending'),
          fetchEmployees().catch(() => []),
        ]);
        setCounts({
          requests: reqs.length,
          employees: emps.filter((e) => !e.registered).length,
        });
        setEmployeeCount({ used: emps.length, total: Math.max(emps.length, 20) });
      } catch {
        /* дэлгэц ажиллах ёстой — тоолуур л хоосон үлдэнэ */
      }
    })();
  }, []);

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
