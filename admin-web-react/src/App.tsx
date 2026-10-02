import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import HomePage from './pages/Home';
import DashboardPage from './pages/Dashboard';
import AttendancePage from './pages/Attendance';
import RequestsPage from './pages/Requests';
import EmployeesPage from './pages/Employees';
import DepartmentsPage from './pages/Departments';
import SchedulePage from './pages/Schedule';
import LocationsPage from './pages/Locations';
import Placeholder from './pages/Placeholder';
import LegacyPage from './pages/Legacy';
import StockIssuesPage from './pages/StockIssues';
import PhoneVerificationPage from './pages/PhoneVerification';
import OutboundSmsPage from './pages/OutboundSms';
import SiteContentPage from './pages/SiteContent';
import LegacyModule from './pages/LegacyModule';
import BusinessSettingsPage from './pages/BusinessSettings';
import OperationalAlertsPage from './pages/OperationalAlerts';
import NotificationsPage from './pages/Notifications';
import WorkHeightSafetyPage from './pages/WorkHeightSafety';
import TrainingPage from './pages/Training';
import ActsPage from './pages/Acts';
import ActEditorPage from './pages/ActEditor';
import ActPreviewPage from './pages/ActPreview';
import ActTemplatesPage from './pages/ActTemplates';
import PublicActPage from './pages/PublicAct';
import { LEGACY_MODULES } from './lib/nav';

/** Бүх route — timely_clone_prompt.md §7-ийн навигацийн модтой 1:1 таарна. */
export default function App() {
  const landingPath = window.location.hostname === 'akt.gennetex.com'
    ? '/admin/documents/acts'
    : '/home';
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/share/acts/:token" element={<PublicActPage />} />
        <Route path="/s/:token" element={<PublicActPage />} />
        <Route element={<Layout />}>
          <Route index element={<Navigate to={landingPath} replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/report/daily" element={<AttendancePage />} />
          <Route path="/report/employee" element={<LegacyModule view="reports" title="Тайлан — Ажилтнаар" />} />
          <Route path="/report/general" element={<AttendancePage />} />

          <Route path="/request" element={<RequestsPage />} />
          <Route path="/employee" element={<EmployeesPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/department" element={<DepartmentsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/location" element={<LocationsPage />} />

          <Route path="/internal/notify" element={<NotificationsPage />} />
          <Route path="/internal/news" element={<LegacyModule view="feedposts" title="Мэдээ — Gennetex Post" />} />
          <Route path="/internal/poll" element={<Placeholder title="Санал хураалт" />} />
          <Route path="/internal/work-report" element={<Placeholder title="Ажлын тайлан" />} />
          <Route path="/internal/sent-locations" element={<LegacyModule view="visits" title="Илгээсэн байршил / Очсон лог" />} />
          <Route path="/internal/feedback" element={<LegacyModule view="feedback" title="Санал хүсэлт / гомдол" />} />
          <Route path="/internal/safety" element={<WorkHeightSafetyPage />} />

          <Route path="/aux/survey" element={<Placeholder title="Дотоод судалгаа" />} />
          <Route path="/aux/exam" element={<Placeholder title="Онлайн шалгалт" />} />

          <Route path="/payroll/auto" element={<Placeholder title="Автомат тооцоолол" />} />
          <Route path="/payroll/payslip" element={<Placeholder title="Задаргаа илгээх" />} />

          <Route path="/site-content" element={<SiteContentPage />} />
          <Route path="/more/settings" element={<BusinessSettingsPage />} />
          <Route path="/alerts" element={<OperationalAlertsPage />} />
          <Route path="/more/billing" element={<Placeholder title="Төлбөр" />} />
          <Route path="/more/market" element={<Placeholder title="Маркет" />} />
          <Route path="/stock-issues" element={<StockIssuesPage />} />
          <Route path="/phone-verification" element={<PhoneVerificationPage />} />
          <Route path="/outbound-sms" element={<OutboundSmsPage />} />
          <Route path="/admin/documents/acts" element={<ActsPage />} />
          <Route path="/admin/documents/acts/new" element={<ActEditorPage />} />
          <Route path="/admin/documents/acts/:id" element={<ActPreviewPage />} />
          <Route path="/admin/documents/acts/:id/edit" element={<ActEditorPage />} />
          <Route path="/admin/documents/acts/:id/preview" element={<ActPreviewPage />} />
          <Route path="/admin/settings/act-templates" element={<ActTemplatesPage />} />
          <Route path="/documents/acts" element={<Navigate to="/admin/documents/acts" replace />} />
          <Route path="/documents/acts/new" element={<Navigate to="/admin/documents/acts/new" replace />} />
          {/* Хуучин панелийн модулиуд — nav.ts дахь жагсаалтаас автоматаар
              route үүсгэнэ. Ингэснээр цэс ба route хоёр хэзээ ч зөрөхгүй. */}
          {LEGACY_MODULES.map((m) => (
            <Route
              key={m.view}
              path={`/legacy/${m.view}`}
              element={<LegacyModule view={m.view} title={m.label} />}
            />
          ))}
          {/* Анхны загварын панел — glass загвар (admin-ui.css) орж
              ирэхээс өмнөх сүүлчийн хувилбар. */}
          <Route
            path="/legacy-v1"
            element={
              <LegacyModule
                view="dashboard"
                title="Анхны загвар (v1.3.10)"
                base="/gennetex/admin-v1/"
              />
            }
          />
          <Route path="/legacy" element={<LegacyPage />} />
          <Route path="/more/help" element={<Placeholder title="Тусламж" />} />

          <Route path="*" element={<Placeholder title="Хуудас олдсонгүй" note="Хаяг буруу байна." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
