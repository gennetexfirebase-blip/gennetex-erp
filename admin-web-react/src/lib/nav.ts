import {
  Home,
  LayoutDashboard,
  ClipboardCheck,
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
  ExternalLink,
  Package,
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


/** Хуучин панел дээр л байдаг модулиуд — шинэ панел дотор iframe-ээр ажиллана. */
export const LEGACY_MODULES: { view: string; label: string }[] = [
  { view: 'workperformance', label: 'Ажилчдын гүйцэтгэл' },
  { view: 'applications', label: 'Ажлын байрны анкет' },
  { view: 'contracts', label: 'Хөдөлмөрийн гэрээ' },
  { view: 'devices', label: 'Төхөөрөмж зөвшөөрөл' },
  { view: 'aiappusage', label: 'AI апп хэрэглээ' },
  { view: 'aiperformance', label: 'AI гүйцэтгэл' },
  { view: 'visits', label: 'Очсон лог' },
  { view: 'vehicles', label: 'Машины мэдээлэл солих' },
  { view: 'fuelconsumption', label: 'Бензин зарцуулалт' },
  { view: 'trips', label: 'Аялал' },
  { view: 'companions', label: 'Хамт яваа багууд' },
  { view: 'servicecalls', label: 'Дуудлага' },
  { view: 'sitework', label: 'Ажлын байр' },
  { view: 'inventory', label: 'Агуулах' },
  { view: 'usage', label: 'Барааны хэрэглээ' },
  { view: 'feedposts', label: 'Gennetex Post' },
  { view: 'meetings', label: 'Хурал' },
  { view: 'livestreams', label: 'Live stream хянах' },
  { view: 'activitylogs', label: 'Нийт лог' },
  { view: 'excelarchive', label: 'Excel архив' },
];

/** timely_clone_prompt.md §7 — sidebar навигацийн бүрэн мод. */
export const NAV: NavItem[] = [
  { label: 'Нүүр', to: '/home', icon: Home },
  { label: 'Хянах самбар', to: '/dashboard', icon: LayoutDashboard, isNew: true },
  // Ирц бүртгэл — өдөр тутам хамгийн их ашиглагддаг хэсэг тул
  // Тайлангийн дэд цэсэнд нуухгүй, үндсэн цэсэнд байрлуулав.
  { label: 'Ирц бүртгэл', to: '/attendance', icon: ClipboardCheck },
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
      { label: 'Вэбсайтын агуулга', to: '/site-content' },
      { label: 'Тохиргоо', to: '/more/settings' },
      { label: 'Төлбөр', to: '/more/billing' },
      { label: 'Маркет', to: '/more/market' },
      { label: 'Тусламж', to: '/more/help' },
    ],
  },
  // Хуучин панелд байгаа бөгөөд энд хараахан шилжүүлээгүй модулиуд
  // (агуулах, багаж, дуудлага, аялал, түлш, санал гомдол…).
  // Шинэ панел бэлэн болтол ажил зогсохгүй байхын тулд шууд холбоно.
  { label: 'Багаж олголт', to: '/stock-issues', icon: Package },
  {
    label: 'Хуучин модулиуд',
    icon: Boxes,
    children: LEGACY_MODULES.map((m) => ({ label: m.label, to: `/legacy/${m.view}` })),
  },
  { label: 'Анхны загвар (v1.3.10)', to: '/legacy-v1', icon: ExternalLink },
  { label: 'Хуучин панел (бүтнээр)', to: '/legacy', icon: ExternalLink },
];
