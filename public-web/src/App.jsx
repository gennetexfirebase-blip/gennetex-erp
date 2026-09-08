import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { SiteContentProvider } from './context/SiteContentContext';
import SiteLayout from './layouts/SiteLayout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ProjectsPage from './pages/ProjectsPage';
import ContactPage from './pages/ContactPage';
const CareersPage = lazy(() => import('./pages/CareersPage'));
// ⚠️ ДООРХ ГУРВЫГ ХОЁР ДЭЛГҮҮР ЗААВАЛ ШААРДДАГ бөгөөд бүгд НЭВТРЭЛТ
//    ШААРДАХГҮЙ байх ёстой — шинжээч нэвтрэх эрхгүй тул хаалттай
//    хуудас нь 404-тэй ижил үр дүнтэй.
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
// Google Play · Data safety → Account deletion
import DeleteAccountPage from './pages/DeleteAccountPage';
// App Store Connect · Support URL (заавал талбар)
import SupportPage from './pages/SupportPage';

export default function App() {
  return (
    <SiteContentProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/careers" element={<Suspense fallback={<div role="status" className="px-6 py-24 text-center text-graphite-300">Ажлын байрны мэдээлэл ачаалж байна…</div>}><CareersPage /></Suspense>} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="*" element={<section className="mx-auto max-w-3xl px-6 py-24"><p className="mb-4 text-accent">404</p><h1 className="mb-4 text-4xl font-semibold">Хуудас олдсонгүй</h1><p className="mb-8 text-graphite-300">Холбоос өөрчлөгдсөн эсвэл буруу хаягаар орсон байна.</p><Link className="action-primary" to="/">Нүүр хуудас руу буцах</Link></section>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </SiteContentProvider>
  );
}
