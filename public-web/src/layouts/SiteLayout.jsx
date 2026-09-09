import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function SiteLayout({ showFooter = true }) {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);

  return (
    <div className={isHome ? 'bg-bg-base text-zinc-900' : 'min-h-screen bg-bg-base text-zinc-900'}>
      <a href="#main-content" className="public-skip">Үндсэн агуулга руу очих</a>
      <Navbar />
      <main id="main-content" tabIndex={-1}><Outlet /></main>
      {showFooter ? <Footer /> : null}
    </div>
  );
}
