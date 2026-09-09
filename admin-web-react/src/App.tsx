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
import SiteContentPage from './pages/SiteContent';
import LegacyModule from './pages/LegacyModule';
import { LEGACY_MODULES } from './lib/nav';

/** Бүх route — timely_clone_prompt.md §7-ийн навигацийн модтой 1:1 таарна. */
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/report/daily" element={<AttendancePage />} />
          <Route path="/report/employee" element={<LegacyModule view="reports" title="Тайлан — Ажилтнаар" />} />
          <Route path="/report/general" element={<AttendancePage />} />

          <Route path="/request" element={<RequestsPage />} />
          <Route path="/employee" element={<EmployeesPage />} />
          <Route path="/department" element={<DepartmentsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/location" element={<LocationsPage />} />

          <Route path="/internal/notify" element={<Placeholder title="Мэдэгдэл илгээх" />} />
          <Route path="/internal/news" element={<LegacyModule view="feedposts" title="Мэдээ — Gennetex Post" />} />
          <Route path="/internal/poll" element={<Placeholder title="Санал хураалт" />} />
          <Route path="/internal/work-report" element={<Placeholder title="Ажлын тайлан" />} />
          <Route path="/internal/sent-locations" element={<LegacyModule view="visits" title="Илгээсэн байршил / Очсон лог" />} />
          <Route path="/internal/feedback" element={<LegacyModule view="feedback" title="Санал хүсэлт / гомдол" />} />
          <Route path="/internal/safety" element={<Placeholder title="ХАБ" />} />

          <Route path="/aux/survey" element={<Placeholder title="Дотоод судалгаа" />} />
          <Route path="/aux/exam" element={<Placeholder title="Онлайн шалгалт" />} />

          <Route path="/payroll/auto" element={<Placeholder title="Автомат тооцоолол" />} />
          <Route path="/payroll/payslip" element={<Placeholder title="Задаргаа илгээх" />} />

          <Route path="/site-content" element={<SiteContentPage />} />
          <Route path="/more/settings" element={<Placeholder title="Тохиргоо" />} />
          <Route path="/more/billing" element={<Placeholder title="Төлбөр" />} />
          <Route path="/more/market" element={<Placeholder title="Маркет" />} />
          <Route path="/stock-issues" element={<StockIssuesPage />} />
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
