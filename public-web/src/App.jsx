import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SiteContentProvider } from './context/SiteContentContext';
import SiteLayout from './layouts/SiteLayout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ProjectsPage from './pages/ProjectsPage';
import ContactPage from './pages/ContactPage';
import CareersPage from './pages/CareersPage';
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
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />
          <Route path="/support" element={<SupportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </SiteContentProvider>
  );
}
