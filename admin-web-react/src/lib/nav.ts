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
  ExternalLink,
  Activity,
  MessageSquare,
  ClipboardList,
  Globe,
  FileSignature,
  Smartphone,
  MonitorSmartphone,
  Sparkles,
  HomeIcon,
  QrCode,
  Fuel,
  Route,
  UsersRound,
  PhoneCall,
  HardHat,
  Boxes,
  PackageOpen,
  Newspaper,
  Video,
  Radio,
  History,
  Table2,
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

/**
 * Хуучин (v1.3.10) панелийн модулиуд.
 *
 * Эдгээр нь шинэ панелийн бүрхүүл дотор iframe-ээр ажиллана. Дэд цэсэнд
 * нуухгүй, ҮНДСЭН цэсэнд шууд байрлуулна — нэмэлт дарах шаардлагагүй.
 *
 * view нь хуучин панелийн data-view утга; /legacy/<view> route нь
 * /gennetex/admin-v1/?embed=1#<view> рүү хөрвөнө.
 */
export const LEGACY_MODULES: { view: string; label: string; icon: LucideIcon }[] = [
  { view: 'workperformance', label: 'Ажилчдын гүйцэтгэл', icon: Activity },
  { view: 'feedback', label: 'Санал гомдол', icon: MessageSquare },
  { view: 'applications', label: 'Ажлын байрны анкет', icon: ClipboardList },
  { view: 'publicsite', label: 'Вэб сайт', icon: Globe },
  { view: 'contracts', label: 'Хөдөлмөрийн гэрээ', icon: FileSignature },
  { view: 'devices', label: 'Төхөөрөмж зөвшөөрөл', icon: Smartphone },
  { view: 'aiappusage', label: 'AI апп хэрэглээ', icon: MonitorSmartphone },
  { view: 'aiperformance', label: 'AI гүйцэтгэл', icon: Sparkles },
  { view: 'visits', label: 'Очсон лог', icon: HomeIcon },
  { view: 'vehicles', label: 'Машины мэдээлэл солих', icon: QrCode },
  { view: 'fuelconsumption', label: 'Бензин зарцуулалт', icon: Fuel },
  { view: 'trips', label: 'Аялал', icon: Route },
  { view: 'companions', label: 'Хамт яваа багууд', icon: UsersRound },
  { view: 'servicecalls', label: 'Дуудлага', icon: PhoneCall },
  { view: 'sitework', label: 'Ажлын байр', icon: HardHat },
  { view: 'inventory', label: 'Агуулах', icon: Boxes },
  { view: 'usage', label: 'Барааны хэрэглээ', icon: PackageOpen },
  { view: 'feedposts', label: 'Gennetex Post', icon: Newspaper },
  { view: 'meetings', label: 'Хурал', icon: Video },
  { view: 'livestreams', label: 'Live stream хянах', icon: Radio },
  { view: 'activitylogs', label: 'Нийт лог', icon: History },
  { view: 'excelarchive', label: 'Excel архив', icon: Table2 },
];

/**
 * Sidebar-ийн бүрэн мод.
 *
 * Хуучин панелийн Хяналт / Ажилчид / Ирц / Байршил / Тайлан нь энд аль
 * хэдийн React хуудсаар байгаа тул давхардуулж нэмээгүй — доорх эхний
 * хэсэг нь яг тэдгээр.
 */
export const NAV: NavItem[] = [
  { label: 'Нүүр', to: '/home', icon: Home },
  { label: 'Хянах самбар', to: '/dashboard', icon: LayoutDashboard, isNew: true },
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

  // Хуучин панелийн модулиуд — шууд үндсэн цэсэнд.
  ...LEGACY_MODULES.map((m) => ({
    label: m.label,
    to: `/legacy/${m.view}`,
    icon: m.icon,
  })),

  { label: 'Анхны загвар (v1.3.10)', to: '/legacy-v1', icon: ExternalLink },
  { label: 'Хуучин панел (бүтнээр)', to: '/legacy', icon: ExternalLink },
];
