import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function SiteLayout({ showFooter = true }) {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div className={isHome ? 'bg-graphite-950 text-graphite-50' : 'min-h-screen bg-graphite-950 text-graphite-50'}>
      <Navbar />
      <Outlet />
      {showFooter ? <Footer /> : null}
    </div>
  );
}
