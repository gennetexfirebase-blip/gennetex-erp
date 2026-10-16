import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import HomePage from './pages/Home';
import DashboardPage from './pages/Dashboard';
import AttendancePage from './pages/Attendance';
import RequestsPage from './pages/Requests';
import EmployeesPage from './pages/Employees';
import DepartmentsPage from './pages/Departments';
import LocationsPage from './pages/Locations';
import StaffLocationsPage from './pages/StaffLocations';
import PayrollPage from './pages/Payroll';
import MealMoneyPage from './pages/MealMoney';
import FuelPage from './pages/Fuel';
import VehiclesPage from './pages/Vehicles';
import CompanionsPage from './pages/Companions';
import ServiceCallsPage from './pages/ServiceCalls';
import { InventoryPage, UsagePage } from './pages/Inventory';
import { ApplicationsPage, DevicesPage } from './pages/Applications';
import MeetingsPage from './pages/Meetings';
import { ActivityLogsPage, ExcelArchivePage } from './pages/Archive';
import Placeholder from './pages/Placeholder';
import LegacyPage from './pages/Legacy';
import StockIssuesPage from './pages/StockIssues';
import OutboundSmsPage from './pages/OutboundSms';
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
import ContractsPage from './pages/Contracts';
import ContractSignPage from './pages/ContractSign';
import { CONTRACT_HOST } from './lib/contracts';
import TimeReportSite, { AttendanceWarningPage } from './pages/TimeReportSite';
import { TIME_REPORT_HOST } from './lib/timeReport';
import { LEGACY_MODULES, LEGACY_REDIRECTS } from './lib/nav';
import { DATA_HOSTS, currentSite, isTestHost, siteTabTitle } from './lib/sites';
import DataSite from './pages/DataSite';
import LinkSite from './pages/LinkSite';
import ShareSite from './pages/ShareSite';
import OwnerSite, { OWNER_HOST } from './pages/OwnerSite';

/** Бүх route — timely_clone_prompt.md §7-ийн навигацийн модтой 1:1 таарна. */
export default function App() {
  // Хөтчийн табын гарчиг — subdomain бүр өөрийн нэртэй.
  const host = window.location.hostname;
  const linkHost = host === 'link.gennetex.com' || (isTestHost() && window.location.pathname.startsWith('/links'));
  document.title =
    linkHost ? 'Бүх хаяг — Gennetex'
    : host === CONTRACT_HOST ? 'Хөдөлмөрийн гэрээ — Gennetex'
    : host === TIME_REPORT_HOST ? 'Цагийн тайлан — Gennetex'
    : DATA_HOSTS.has(host) || (isTestHost() && window.location.pathname.startsWith('/data')) ? 'Gennetex Data'
    : siteTabTitle();

  // Хувийн хаяг — хаана ч холбоосгүй, зөвхөн эзэмшигч (OwnerSite дотор шалгана).
  if (host === OWNER_HOST) return <OwnerSite />;

  // link.gennetex.com — бүх домэйны жагсаалт (зөвхөн админ).
  if (linkHost) return <LinkSite />;
  // share.gennetex.com — ажилтнууд текст, файл хуваалцах (бүх ажилтан).
  if (host === 'share.gennetex.com' || (isTestHost() && window.location.pathname.startsWith('/sharing'))) return <ShareSite />;

  // geree.gennetex.com — зөвхөн гэрээтэй танилцаж гарын үсэг зурах хуудас.
  if (window.location.hostname === CONTRACT_HOST) {
    return (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<ContractSignPage />} />
          <Route path="/:slug" element={<ContractSignPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }
  // tailan.gennetex.com — цагийн тайлан ба ажилтны сануулгын хуудас.
  if (window.location.hostname === TIME_REPORT_HOST) {
    return (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<TimeReportSite />} />
          <Route path="/w/:token" element={<AttendanceWarningPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }
  // data.gennetex.com/data/ — 4 шаттай нэвтрэлттэй өгөгдлийн сан (зөвхөн superadmin).
  if (DATA_HOSTS.has(window.location.hostname) || (isTestHost() && window.location.pathname.startsWith('/data'))) {
    return (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/data/*" element={<DataSite />} />
          <Route path="*" element={<Navigate to="/data/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }
  const landingPath = currentSite().landing;
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* Домэйн холбогдохоос өмнө туршихад: /geree/<slug> */}
        <Route path="/geree" element={<ContractSignPage />} />
        <Route path="/geree/:slug" element={<ContractSignPage />} />
        <Route path="/tailan" element={<TimeReportSite />} />
        <Route path="/tailan/w/:token" element={<AttendanceWarningPage />} />
        <Route path="/share/acts/:token" element={<PublicActPage />} />
        <Route path="/s/:token" element={<PublicActPage />} />
        <Route element={<Layout />}>
          <Route index element={<Navigate to={landingPath} replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/attendance" element={<AttendancePage />} />

          <Route path="/request" element={<RequestsPage />} />
          <Route path="/employee" element={<EmployeesPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/department" element={<DepartmentsPage />} />
          <Route path="/location" element={<LocationsPage />} />
          <Route path="/location/staff" element={<StaffLocationsPage />} />
          <Route path="/finance/payroll" element={<PayrollPage />} />
          <Route path="/finance/meal" element={<MealMoneyPage />} />
          <Route path="/finance/fuel" element={<FuelPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/companions" element={<CompanionsPage />} />
          <Route path="/service-calls" element={<ServiceCallsPage />} />
          <Route path="/stock" element={<InventoryPage />} />
          <Route path="/stock/usage" element={<UsagePage />} />
          <Route path="/hr/applications" element={<ApplicationsPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/meetings" element={<MeetingsPage />} />
          {/* Хуучин iframe хаягууд → шинэ хуудас */}
          {Object.entries(LEGACY_REDIRECTS).map(([view, to]) => (
            <Route key={view} path={`/legacy/${view}`} element={<Navigate to={to} replace />} />
          ))}
          <Route path="/archive/logs" element={<ActivityLogsPage />} />
          <Route path="/archive/excel" element={<ExcelArchivePage />} />

          <Route path="/internal/notify" element={<NotificationsPage />} />
          <Route path="/internal/poll" element={<Placeholder title="Санал хураалт" />} />
          <Route path="/internal/work-report" element={<Placeholder title="Ажлын тайлан" />} />
          <Route path="/internal/safety" element={<WorkHeightSafetyPage />} />

          <Route path="/aux/survey" element={<Placeholder title="Дотоод судалгаа" />} />
          <Route path="/aux/exam" element={<Placeholder title="Онлайн шалгалт" />} />

          <Route path="/payroll/auto" element={<Placeholder title="Автомат тооцоолол" />} />
          <Route path="/payroll/payslip" element={<Placeholder title="Задаргаа илгээх" />} />

          <Route path="/more/settings" element={<BusinessSettingsPage />} />
          <Route path="/alerts" element={<OperationalAlertsPage />} />
          <Route path="/more/billing" element={<Placeholder title="Төлбөр" />} />
          <Route path="/more/market" element={<Placeholder title="Маркет" />} />
          <Route path="/stock-issues" element={<StockIssuesPage />} />
          <Route path="/outbound-sms" element={<OutboundSmsPage />} />
          <Route path="/admin/documents/acts" element={<ActsPage />} />
          <Route path="/admin/documents/acts/new" element={<ActEditorPage />} />
          <Route path="/admin/documents/acts/:id" element={<ActPreviewPage />} />
          <Route path="/admin/documents/acts/:id/edit" element={<ActEditorPage />} />
          <Route path="/admin/documents/acts/:id/preview" element={<ActPreviewPage />} />
          <Route path="/admin/settings/act-templates" element={<ActTemplatesPage />} />
          <Route path="/admin/documents/contracts" element={<ContractsPage />} />
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
