import {
  Home,
  LayoutDashboard,
  FileText,
  Clock,
  Users,
  Building2,
  CalendarDays,
  MapPin,
  Boxes,
  GraduationCap,
  Wallet,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';

export type NavChild = { label: string; to: string };

export type NavItem = {
  label: string;
  to?: string;
  icon: LucideIcon;
  /** Улбар шар NEW тэмдэг */
  isNew?: boolean;
  /** Тоон badge-ийн эх сурвалж (амьд өгөгдлөөс дүүргэнэ) */
  badgeKey?: 'requests' | 'employees';
  badgeTone?: 'brand' | 'warning';
  children?: NavChild[];
};

/** timely_clone_prompt.md §7 — sidebar навигацийн бүрэн мод. */
export const NAV: NavItem[] = [
  { label: 'Нүүр', to: '/home', icon: Home },
  { label: 'Хянах самбар', to: '/dashboard', icon: LayoutDashboard, isNew: true },
  {
    label: 'Тайлан',
    icon: FileText,
    children: [
      { label: 'Өдрөөр', to: '/report/daily' },
      { label: 'Ажилтнаар', to: '/report/employee' },
      { label: 'Ерөнхий', to: '/report/general' },
    ],
  },
  { label: 'Цагийн хүсэлт', to: '/request', icon: Clock, badgeKey: 'requests', badgeTone: 'brand' },
  { label: 'Ажилтан', to: '/employee', icon: Users, badgeKey: 'employees', badgeTone: 'warning' },
  { label: 'Хэлтэс', to: '/department', icon: Building2 },
  { label: 'Хуваарь', to: '/schedule', icon: CalendarDays },
  { label: 'Байршил', to: '/location', icon: MapPin },
  {
    label: 'Дотоод цэс',
    icon: Boxes,
    children: [
      { label: 'Мэдэгдэл илгээх', to: '/internal/notify' },
      { label: 'Мэдээ', to: '/internal/news' },
      { label: 'Санал хураалт', to: '/internal/poll' },
      { label: 'Ажлын тайлан', to: '/internal/work-report' },
      { label: 'Илгээсэн байршил', to: '/internal/sent-locations' },
      { label: 'Санал хүсэлт', to: '/internal/feedback' },
      { label: 'ХАБ', to: '/internal/safety' },
    ],
  },
  {
    label: 'Туслах цэс',
    icon: GraduationCap,
    children: [
      { label: 'Дотоод судалгаа', to: '/aux/survey' },
      { label: 'Онлайн шалгалт', to: '/aux/exam' },
    ],
  },
  {
    label: 'Цалин',
    icon: Wallet,
    children: [
      { label: 'Автомат тооцоолол', to: '/payroll/auto' },
      { label: 'Задаргаа илгээх', to: '/payroll/payslip' },
    ],
  },
  {
    label: '⋯ (+4)',
    icon: MoreHorizontal,
    children: [
      { label: 'Тохиргоо', to: '/more/settings' },
      { label: 'Төлбөр', to: '/more/billing' },
      { label: 'Маркет', to: '/more/market' },
      { label: 'Тусламж', to: '/more/help' },
    ],
  },
];
