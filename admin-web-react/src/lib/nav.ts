import {
  Home,
  LayoutDashboard,
  ClipboardCheck,
  Clock,
  Users,
  Wallet,
  Building2,
  MapPin,
  MapPinned,
  ClipboardList,
  FileSignature,
  Smartphone,
  QrCode,
  Fuel,
  UsersRound,
  PhoneCall,
  Boxes,
  PackageOpen,
  Video,
  History,
  Table2,
  Send,
  Settings2,
  BellRing,
  ShieldCheck,
  GraduationCap,
  FileCheck2,
  type LucideIcon,
} from 'lucide-react';
import type { SiteKey } from './sites';

export type NavChild = { label: string; to: string; adminOnly?: boolean };

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
  /** Non-admin ERP users only see act-scoped navigation. */
  actsOnly?: boolean;
  /** Аль subdomain дээр харагдах (lib/sites.ts). Байхгүй бол admin.gennetex.com. */
  site?: SiteKey;
  /** Зөвхөн superadmin (sysadmin) харна. */
  superOnly?: boolean;
  /** Админ биш хүн ч (сервер эрх шалгана) — жишээ нь байршил харах эрх олгогдсон хүн. */
  openToAll?: boolean;
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
export const LEGACY_MODULES: { view: string; label: string; icon: LucideIcon; site?: SiteKey; superOnly?: boolean }[] = [
  { view: 'applications', label: 'Ажлын байрны анкет', icon: ClipboardList, site: 'hr' },
  { view: 'devices', label: 'Төхөөрөмж зөвшөөрөл', icon: Smartphone, superOnly: true },
  { view: 'vehicles', label: 'Машины мэдээлэл солих', icon: QrCode },
  { view: 'fuelconsumption', label: 'Бензин зарцуулалт', icon: Fuel, site: 'sanhuu' },
  { view: 'fuelrefill', label: 'Бензин нөхөж цэнэглэх', icon: Fuel, site: 'sanhuu' },
  { view: 'companions', label: 'Хамт яваа багууд', icon: UsersRound },
  { view: 'servicecalls', label: 'Дуудлага', icon: PhoneCall },
  { view: 'inventory', label: 'Агуулах', icon: Boxes, site: 'aguulah' },
  { view: 'usage', label: 'Барааны хэрэглээ', icon: PackageOpen, site: 'aguulah' },
  { view: 'meetings', label: 'Хурал', icon: Video, site: 'meet' },
];

/**
 * Sidebar-ийн бүрэн мод — бүх subdomain-ийнх. Sidebar нь одоогийн сайтынхыг
 * л шүүж харуулна (`site`).
 */
export const NAV: NavItem[] = [
  { label: 'Нүүр', to: '/home', icon: Home },
  { label: 'Хянах самбар', to: '/dashboard', icon: LayoutDashboard, isNew: true },
  { label: 'Анхааруулгын төв', to: '/alerts', icon: BellRing, isNew: true },
  { label: 'Хөдөлмөрийн гэрээ', to: '/admin/documents/contracts', icon: FileSignature, isNew: true },
  { label: 'SMS илгээх', to: '/outbound-sms', icon: Send, isNew: true },
  { label: 'Тохиргооны төв', to: '/more/settings', icon: Settings2, isNew: true },

  { label: 'Мэдэгдэл илгээх', to: '/internal/notify', icon: Send, site: 'notif' },
  { label: 'Өндөрт ажиллах ХАБЭА', to: '/internal/safety', icon: ShieldCheck, site: 'habea' },
  { label: 'Ирц бүртгэл', to: '/attendance', icon: ClipboardCheck, site: 'irts' },
  { label: 'Цагийн хүсэлт', to: '/request', icon: Clock, badgeKey: 'requests', badgeTone: 'brand', site: 'irts' },
  { label: 'Ажилтан', to: '/employee', icon: Users, badgeKey: 'employees', badgeTone: 'warning', site: 'hr' },
  { label: 'Алба, хэлтэс', to: '/department', icon: Building2, site: 'hr' },
  { label: 'Авсан сургалт', to: '/training', icon: GraduationCap, site: 'surgalt' },
  { label: 'Цалин', to: '/finance/payroll', icon: Wallet, site: 'sanhuu' },
  { label: 'Нийт лог', to: '/archive/logs', icon: History, site: 'arhiv' },
  { label: 'Excel архив', to: '/archive/excel', icon: Table2, site: 'arhiv' },
  { label: 'Ажилчдын байршил', to: '/location/staff', icon: MapPin, site: 'bairshil', openToAll: true },
  { label: 'Ирц бүртгэх цэг', to: '/location', icon: MapPinned, site: 'bairshil' },
  {
    label: 'Баримт бичиг',
    icon: FileCheck2,
    actsOnly: true,
    site: 'akt',
    children: [
      { label: 'Ажил гүйцэтгэлийн акт', to: '/admin/documents/acts' },
      { label: 'Актын загварууд', to: '/admin/settings/act-templates', adminOnly: true },
    ],
  },

  // Хуучин панелийн модулиуд — шууд үндсэн цэсэнд.
  ...LEGACY_MODULES.map((m) => ({
    label: m.label,
    to: `/legacy/${m.view}`,
    icon: m.icon,
    site: m.site,
    superOnly: m.superOnly,
  })),
];

/** Хаяг аль сайтад харьяалагдахыг цэснээс олно (хамгийн урт таарсан угтвар). */
export function siteOfPath(path: string): { site: SiteKey; superOnly: boolean; openToAll: boolean } | null {
  let best: { len: number; site: SiteKey; superOnly: boolean; openToAll: boolean } | null = null;
  for (const item of NAV) {
    const tos = [item.to, ...(item.children || []).map((c) => c.to)].filter(Boolean) as string[];
    for (const to of tos) {
      if ((path === to || path.startsWith(to + '/')) && (!best || to.length > best.len)) {
        best = { len: to.length, site: item.site || 'admin', superOnly: !!item.superOnly, openToAll: !!item.openToAll };
      }
    }
  }
  return best && { site: best.site, superOnly: best.superOnly, openToAll: best.openToAll };
}
