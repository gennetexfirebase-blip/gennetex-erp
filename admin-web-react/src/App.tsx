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

/** Бүх route — timely_clone_prompt.md §7-ийн навигацийн модтой 1:1 таарна. */
export default function App() {
  return (
    <BrowserRouter basename="/gennetex/admin">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/report/daily" element={<AttendancePage />} />
          <Route path="/report/employee" element={<Placeholder title="Тайлан — Ажилтнаар" />} />
          <Route path="/report/general" element={<AttendancePage />} />

          <Route path="/request" element={<RequestsPage />} />
          <Route path="/employee" element={<EmployeesPage />} />
          <Route path="/department" element={<DepartmentsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/location" element={<LocationsPage />} />

          <Route path="/internal/notify" element={<Placeholder title="Мэдэгдэл илгээх" />} />
          <Route path="/internal/news" element={<Placeholder title="Мэдээ" />} />
          <Route path="/internal/poll" element={<Placeholder title="Санал хураалт" />} />
          <Route path="/internal/work-report" element={<Placeholder title="Ажлын тайлан" />} />
          <Route path="/internal/sent-locations" element={<Placeholder title="Илгээсэн байршил" />} />
          <Route path="/internal/feedback" element={<Placeholder title="Санал хүсэлт" />} />
          <Route path="/internal/safety" element={<Placeholder title="ХАБ" />} />

          <Route path="/aux/survey" element={<Placeholder title="Дотоод судалгаа" />} />
          <Route path="/aux/exam" element={<Placeholder title="Онлайн шалгалт" />} />

          <Route path="/payroll/auto" element={<Placeholder title="Автомат тооцоолол" />} />
          <Route path="/payroll/payslip" element={<Placeholder title="Задаргаа илгээх" />} />

          <Route path="/more/settings" element={<Placeholder title="Тохиргоо" />} />
          <Route path="/more/billing" element={<Placeholder title="Төлбөр" />} />
          <Route path="/more/market" element={<Placeholder title="Маркет" />} />
          <Route path="/more/help" element={<Placeholder title="Тусламж" />} />

          <Route path="*" element={<Placeholder title="Хуудас олдсонгүй" note="Хаяг буруу байна." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
