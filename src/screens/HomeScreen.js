import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { spacing } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { roleLabel, canTakeServiceCalls } from '../lib/roles';
import { effectivePermissions } from '../lib/permissions';
import DraggableTileGrid from '../components/DraggableTileGrid';
import { loadTileOrder, saveTileOrder, applyTileOrder } from '../lib/tileOrder';
import * as tracking from '../services/trackingService';
import * as vehicleApi from '../services/vehicleService';
import { countTodayCheckIns } from '../services/attendanceService';
import * as ohaabApi from '../services/ohaabService';
import TodayDashboard from '../components/enhancements/TodayDashboard';
import HomeAttendanceCard from '../components/HomeAttendanceCard';
import HeaderAccountActions from '../components/HeaderAccountActions';
import HomeLiveMap from '../components/HomeLiveMap';
import {
  Badge,
  Box,
  Chip,
  ModuleTile,
  PhIcon,
  SectionHeader,
  Segmented,
  StatGrid,
  Wordmark,
} from '../components/ds';

// 2026-10-11: Нүүрнээс хассан — Store шалгалт, Telegram чат, Миний Telegram,
// Ирц (дээрх ирцийн карт, товчлол байгаа), Чат (доод цэсэнд), Зам оновчлох,
// Дуудлагын түүх, Мэдлэгийн сан, Оффлайн queue. «Авсан сургалт» удирдлага руу.
const EMPLOYEE_MODULES = [
  { key: 'WorkHeightRisk', label: 'Өндөрт ажиллах', icon: 'attendance', accent: 'rose' },
  { key: 'Ohaab', label: 'ХААБ заавар', icon: 'attendance', accent: 'amber' },
  // Бараа материал / багажийг ажилтан ӨӨРӨӨ авахгүй — зөвхөн админ олгоно.
  // Тиймээс агуулахын жагсаалт руу орох хавтас байхгүй, зөвхөн өөрт нь
  // олгогдсон үлдэгдлээ харна.
  { key: 'MyStock', label: 'Миний үлдэгдэл', icon: 'allocation', accent: 'brand'},
  { key: 'MyTools', label: 'Миний багаж', icon: 'allocation', accent: 'brand'},
  { key: 'SiteWork', label: 'Ажлын байр', icon: 'location', accent: 'green'},
  { key: 'MyContract', label: 'Миний гэрээ', icon: 'report', accent: 'indigo'},
  { key: 'EmployeeDirectory', label: 'Ажилтны мэдээлэл', icon: 'employees', accent: 'indigo'},
  { key: 'Vehicle', label: 'Машин сонгох', icon: 'vehicle', accent: 'amber' },
  { key: 'Fuel', label: 'Бензиний баримт', icon: 'fuel', accent: 'amber' },
  { key: 'FleetFuel', label: 'Бензин зарцуулалт', icon: 'fuel', accent: 'amber' },
  { key: 'Calls', label: 'Дуудлага', icon: 'calls', accent: 'teal'},
  // Талбайн ажил: өмнөх/дараах зураг + GPS автоматаар.
  { key: 'BoxTag', label: 'Боксны таг', route: 'FieldWork', params: { kind: 'box_tag' } },
  { key: 'Transfer', label: 'Шилжүүлэг', route: 'FieldWork', params: { kind: 'transfer' } },
  // Зураг авахад GPS хадгалагдаж, ойртсон ажилтанд зурагтай push очно.
  { key: 'BoxFull', label: 'Дүүрсэн бокс', route: 'FieldWork', params: { kind: 'box_full' } },
  { key: 'Meeting', label: 'Хурал', icon: 'chat', accent: 'teal'},
  { key: 'MyShift', label: 'Хуваарь харах', icon: 'clock', accent: 'indigo'},
  { key: 'MyPayroll', label: 'Миний цалин', icon: 'report', accent: 'indigo'},
  { key: 'EmployeeReport', label: 'Ажилтан тайлан', icon: 'report', accent: 'slate'},
  { key: 'Feedback', label: 'Санал гомдол', icon: 'report', accent: 'rose'},
  // --- Enhancements (additive) ---
  { key: 'ToolCheckIn', label: 'Багаж нөхцөл', icon: 'tools', accent: 'brand' },
  { key: 'BarcodeMode', label: 'Barcode горим', icon: 'qr', accent: 'brand' },
  // Акт бичих эрх олгогдсон ажилтанд л харагдана.
  { key: 'Acts', label: 'Акт бичих', icon: 'report', accent: 'green', need: 'acts.create' },
];

// 2026-10-11: Анхааруулгын төв, Тохиргооны төв → Профайл руу. Ажлын байр/баг,
// Очсон лог, Live Ops, Дуудлагын өртөг, Автомат оноолт, Predictive, Public
// tickets, Feature flags — нүүрнээс хассан.
const ADMIN_MODULES = [
  { key: 'AdminOhaab', label: 'ХААБ заавар', icon: 'attendance', accent: 'amber', need: 'approve' },
  // Сургалт, сертификатыг удирдлага бүртгэнэ (ажилтны цэснээс шилжүүлсэн).
  { key: 'EmployeeTraining', label: 'Авсан сургалт', icon: 'attendance', accent: 'green', need: 'employees' },
  { key: 'FieldWorkAdmin', label: 'Талбайн ажил', route: 'FieldWork', params: { kind: 'all' }, need: 'approve' },
  { key: 'Employees', label: 'Ажилтан бүртгэх', icon: 'employees', accent: 'indigo', need: 'employees' },
  // ⚠️ "Хэлтэс" нь нүүр дэлгэцийн хавтан БИШ. Хэлтсийг ажилтан нэмэх
  //    хэсгээс (Ажилтан бүртгэх → Хэлтэс) сонгож, хөгжүүлэгч тэндээсээ
  //    шинээр үүсгэнэ. Ингэснээр "хаана хэлтэс нэмдэг билээ" гэсэн
  //    хоёр өөр зам үүсэхгүй.
  { key: 'AdminApplications', label: 'Ажлын анкет', icon: 'employees', accent: 'indigo', need: 'employees'},
  { key: 'AdminContracts', label: 'Хөдөлмөрийн гэрээ', icon: 'report', accent: 'indigo', need: 'employees'},
  { key: 'AdminReports', label: 'Тайлан', icon: 'report', accent: 'slate', need: 'employees'},
  // Багийн ӨДРИЙН гүйцэтгэл: хэдэн баг · өдөрт хэдэн айл · хэр хугацаанд.
  // Компанийн хэмжээний дүн тул `adminOnly` — ахлах, менежерт харагдахгүй.
  { key: 'AdminWorkPerformance', label: 'Гүйцэтгэл', icon: 'report', accent: 'green', need: 'employees', adminOnly: true },
  { key: 'Payroll', label: 'Цалин тооцоо', icon: 'report', accent: 'indigo', need: 'payroll' },
  { key: 'AdminFeedback', label: 'Санал гомдол', icon: 'report', accent: 'rose', need: 'employees'},
  { key: 'EmployeeDirectory', label: 'Ажилтны мэдээлэл', icon: 'employees', accent: 'indigo', need: 'employees'},
  { key: 'AdminCalls', label: 'Бүх дуудлага', icon: 'calls', accent: 'teal', need: 'approve'},
  { key: 'Requisition', label: 'Шаардах хуудас', icon: 'report', accent: 'brand', need: 'inventory'},
  { key: 'VehiclesAdmin', label: 'Машины хяналт', icon: 'qr', accent: 'amber', need: 'employees' },
  { key: 'VehicleSpecs', label: 'Машины оношилгоо', icon: 'vehicle', accent: 'amber', need: 'employees' },
  { key: 'FleetFuel', label: 'Шатахуун зарцуулалт', icon: 'fuel', accent: 'amber', need: 'employees' },
  { key: 'Inventory', label: 'Бараа материал', icon: 'inventory', accent: 'brand', need: 'inventory' },
  // Багаж ба хангамж нэг хавтанд. Хоёул ажилтанд ОЛГОГДДОГ зүйл тул
  // хамт байрлана. Бараа материал нь агуулахын үлдэгдэл — тусдаа.
  { key: 'ToolsHub', label: 'Багаж, хангамж', icon: 'tools', accent: 'brand', need: 'inventory' },
  { key: 'ToolAllocation', label: 'Ажилтны үлдэгдэл', icon: 'allocation', accent: 'brand', need: 'inventory' },
  // --- Enhancements (additive) ---
  { key: 'SlaReport', label: 'SLA & KPI', icon: 'report', accent: 'slate', need: 'employees' },
  { key: 'LowStock', label: 'Бага үлдэгдэл', icon: 'inventory', accent: 'rose', need: 'inventory' },
  { key: 'PayrollExport', label: 'Цалин export', icon: 'report', accent: 'indigo', need: 'payroll' },
  // akt.gennetex.com — ажил гүйцэтгэлийн акт. Эрх олгогдсон хүн (админ ч гэсэн)
  // болон Захирал, sysadmin-д л харагдана.
  { key: 'Acts', label: 'Акт', icon: 'report', accent: 'green', need: 'acts.create' },
];

// AI боломжуудыг тусад нь тод хэсэг болгож харуулна
const AI_MODULES_EMPLOYEE = [
  { key: 'GennetexAi', label: 'Gennetex AI', sub: 'Асуулт асууж чатлах', icon: 'chat', accent: 'violet' },
  { key: 'AiInventoryHome', label: 'AI тооллого', sub: 'Камераар бараа тоолох', icon: 'inventory', accent: 'violet' },
];

const AI_MODULES_ADMIN = [
  { key: 'AiAdmin', label: 'AI Админ туслах', sub: 'Хянах · ажил хуваарилах · Excel', icon: 'ai', accent: 'violet' },
  { key: 'GennetexAi', label: 'Gennetex AI', sub: 'Асуулт асууж чатлах', icon: 'chat', accent: 'violet' },
  { key: 'AiInventoryHome', label: 'AI тооллого', sub: 'Камераар бараа тоолох', icon: 'inventory', accent: 'violet' },
  { key: 'AdminPerformance', label: 'AI гүйцэтгэл', sub: 'Ажилтны дүн шинжилгээ', icon: 'report', accent: 'violet' },
  { key: 'AdminAppUsage', label: 'Апп ашиглалт', sub: 'AI хэрэглээний тайлан', icon: 'report', accent: 'violet' },
];

const ADMIN_KEYS = new Set(ADMIN_MODULES.map((m) => m.key));
/** Админ инженер биш — энэ модуль зөвхөн ажилтанд. «Ажлын байр» нь
 *  удирдлагаас хасагдсан тул админы үйлчилгээний цэсэнд ч гарахгүй. */
const ADMIN_HIDDEN_KEYS = new Set(['Calls', 'SiteWork']);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Өглөөний мэнд';
  if (h < 18) return 'Өдрийн мэнд';
  return 'Оройн мэнд';
}

// ---------------------------------------------------------------------------
// Шинэ дизайн: модулийн бүлэг, Phosphor duotone icon, өнгө (design §4 Нүүр)
// ---------------------------------------------------------------------------

/** Модуль бүрийн [Phosphor icon, өнгө]. */
const MODULE_LOOK = {
  // Хүний нөөц
  Employees: ['user-plus', 'blue'],
  EmployeeDirectory: ['identification-card', 'indigo'],
  AdminApplications: ['identification-badge', 'teal'],
  AdminContracts: ['signature', 'purple'],
  SiteWork: ['buildings', 'slate'],
  AdminWorkPerformance: ['trophy', 'amber'],
  Payroll: ['calculator', 'green'],
  PayrollExport: ['download-simple', 'teal'],
  // Дуудлага ба үйл ажиллагаа
  AdminCalls: ['headset', 'blue'],
  AdminVisits: ['footprints', 'teal'],
  CallCost: ['money', 'green'],
  LiveOps: ['pulse', 'red'],
  SlaReport: ['gauge', 'amber'],
  AutoDispatch: ['shuffle', 'purple'],
  PublicTickets: ['ticket', 'pink'],
  Predictive: ['trend-up', 'indigo'],
  // Агуулах ба тээвэр
  Inventory: ['archive', 'amber'],
  ToolsHub: ['toolbox', 'red'],
  ToolAllocation: ['stack', 'indigo'],
  LowStock: ['package', 'pink'],
  Requisition: ['note-pencil', 'blue'],
  VehiclesAdmin: ['car-profile', 'teal'],
  VehicleSpecs: ['wrench', 'slate'],
  FleetFuel: ['gas-pump', 'green'],
  // Систем ба тайлан
  AdminReports: ['chart-bar', 'blue'],
  Acts: ['note-pencil', 'teal'],
  OperationalAlerts: ['bell-ringing', 'red'],
  BusinessSettings: ['gear-six', 'slate'],
  AdminOhaab: ['shield-check', 'green'],
  AdminFeedback: ['chat-centered-dots', 'pink'],
  FeatureFlags: ['toggle-right', 'purple'],
  AdminDevices: ['device-mobile', 'indigo'],
  // Ажилтан — Миний
  Attendance: ['calendar-check', 'green'],
  MyShift: ['clock', 'blue'],
  LeaveRequest: ['calendar-plus', 'teal'],
  MyPayroll: ['wallet', 'amber'],
  MyContract: ['file-text', 'indigo'],
  MyStock: ['package', 'pink'],
  MyTools: ['hammer', 'slate'],
  EmployeeReport: ['clipboard-text', 'purple'],
  // Ажил ба дуудлага
  Calls: ['phone-call', 'green'],
  BoxTag: ['archive', 'teal'],
  Transfer: ['repeat', 'indigo'],
  BoxFull: ['package', 'amber'],
  FieldWorkAdmin: ['map-pin', 'teal'],
  Vehicle: ['car', 'blue'],
  Fuel: ['receipt', 'amber'],
  BarcodeMode: ['barcode', 'slate'],
  ToolCheckIn: ['wrench', 'red'],
  // Аюулгүй ажиллагаа
  EmployeeTraining: ['graduation-cap', 'purple'],
  Ohaab: ['shield-check', 'green'],
  WorkHeightRisk: ['hard-hat', 'amber'],
  KnowledgeBase: ['books', 'indigo'],
  // Харилцаа
  Chat: ['chats-circle', 'blue'],
  TelegramChat: ['paper-plane-tilt', 'teal'],
  MyTelegram: ['at', 'indigo'],
  Meeting: ['video-camera', 'pink'],
  Feedback: ['chat-centered-dots', 'red'],
  // AI
  AiAdmin: ['sparkle', 'purple'],
  GennetexAi: ['chat-teardrop-dots', 'purple'],
  AiInventoryHome: ['scan', 'purple'],
  AdminPerformance: ['chart-line-up', 'purple'],
  AdminAppUsage: ['chart-pie-slice', 'purple'],
};

const ADMIN_GROUPS = [
  ['Хүний нөөц', ['Employees', 'EmployeeDirectory', 'AdminApplications', 'AdminContracts', 'EmployeeTraining', 'AdminWorkPerformance', 'Payroll', 'PayrollExport']],
  ['Дуудлага ба үйл ажиллагаа', ['AdminCalls', 'FieldWorkAdmin', 'SlaReport']],
  ['Агуулах ба тээвэр', ['Inventory', 'ToolsHub', 'ToolAllocation', 'LowStock', 'Requisition', 'VehiclesAdmin', 'VehicleSpecs', 'FleetFuel']],
  ['Систем ба тайлан', ['AdminReports', 'Acts', 'AdminOhaab', 'AdminFeedback', 'AdminDevices']],
];

const SERVICE_GROUPS = [
  ['Миний', ['MyShift', 'LeaveRequest', 'MyPayroll', 'MyContract', 'MyStock', 'MyTools', 'EmployeeReport']],
  ['Ажил ба дуудлага', ['Acts', 'Calls', 'BoxTag', 'BoxFull', 'Transfer', 'Vehicle', 'Fuel', 'BarcodeMode', 'ToolCheckIn', 'FleetFuel', 'SiteWork']],
  ['Аюулгүй ажиллагаа', ['Ohaab', 'WorkHeightRisk']],
  ['Харилцаа', ['Meeting', 'Feedback', 'EmployeeDirectory']],
];

/** «Чөлөөний хүсэлт» — тусдаа дэлгэц биш, Ирцийн хүсэлтийн маягт руу. */
const LEAVE_MODULE = { key: 'LeaveRequest', label: 'Чөлөөний хүсэлт', route: 'AttendanceRequestForm' };

/** Эрхээр шүүсэн модулиудыг бүлэгт хуваана; бүлэгт ороогүй нь «Бусад». */
function groupModules(modules, groups) {
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const used = new Set();
  const out = [];
  for (const [title, keys] of groups) {
    const items = keys.filter((k) => byKey.has(k) && !used.has(k)).map((k) => {
      used.add(k);
      return byKey.get(k);
    });
    if (items.length) out.push({ title, items });
  }
  const rest = modules.filter((m) => !used.has(m.key));
  if (rest.length) out.push({ title: 'Бусад', items: rest });
  return out;
}

/** Хэрэглэгчийн хадгалсан дарааллаар бүлэг доторх хавтангуудыг эрэмбэлнэ. */
function sortByOrder(items, ordered) {
  const idx = new Map(ordered.map((m, i) => [m.key, i]));
  return [...items].sort((a, b) => (idx.get(a.key) ?? 999) - (idx.get(b.key) ?? 999));
}

function firstName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  // «Б. Батболд» → «Батболд»
  return parts.length > 1 && parts[0].length <= 3 ? parts[parts.length - 1] : parts[0] || '';
}

const WEEKDAYS = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
function longDate(d) {
  return `${WEEKDAYS[d.getDay()]}, ${d.getMonth() + 1}-р сарын ${d.getDate()}`;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const styles = useStyles(makeStyles);
  const { authProfile, profile, isAdmin, isSuperAdmin, isCloud, fetchEmployees, currentUser } = useApp();
  const name = authProfile?.name || profile?.name || 'Ажилтан';

  const [stats, setStats] = useState({ employees: 0, online: 0, vehicles: 0, checkins: 0 });
  const [now, setNow] = useState(() => new Date());
  const [ohaabSignedToday, setOhaabSignedToday] = useState(true);

  // Модулийн сүлжээ: 4 багана, бүлгийн карт дотор (padding 8, gap 4).
  const moduleColumns = 4;
  const gridWidth = SCREEN_WIDTH - 32 - 16;
  const tileWidth = Math.floor((gridWidth - 4 * (moduleColumns - 1)) / moduleColumns);
  const tileHeight = 96;

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (isCloud && currentUser?.id) {
          try {
            const signed = await ohaabApi.hasTodayAck(currentUser.id);
            if (active) setOhaabSignedToday(signed);
          } catch (e) {
            if (active) setOhaabSignedToday(true);
          }
        }
        if (!isAdmin || !isCloud) return;
        try {
          const [emps, workers, vehicles, checkins] = await Promise.all([
            fetchEmployees().catch(() => []),
            tracking.fetchWorkers().catch(() => []),
            vehicleApi.fetchVehicles().catch(() => []),
            countTodayCheckIns().catch(() => 0),
          ]);
          if (!active) return;
          const fiveMinAgo = Date.now() - 5 * 60 * 1000;
          const online = workers.filter(
            (w) => w.latitude != null && w.last_seen && new Date(w.last_seen).getTime() > fiveMinAgo
          ).length;
          setStats({ employees: emps.length, online, vehicles: vehicles.length, checkins });
        } catch (e) {}
      })();
      return () => {
        active = false;
      };
    }, [isAdmin, isCloud, fetchEmployees, currentUser])
  );

  // Админ дуудлагаар явах эрхтэй эсэх (superadmin эрх өгсөн үед)
  const role = authProfile?.role;
  const canTakeCalls = canTakeServiceCalls(authProfile);
  /** Эрхийн чадвар (src/lib/permissions.js) — модулийн 
eed-ээр шүүнэ. */
  const capabilities = useMemo(() => effectivePermissions(authProfile), [authProfile]);
  const serviceModules = useMemo(() => {
    const base = isAdmin
      ? EMPLOYEE_MODULES.filter(
          (m) =>
            !ADMIN_KEYS.has(m.key) &&
            (!ADMIN_HIDDEN_KEYS.has(m.key) || (m.key === 'Calls' && canTakeCalls))
        )
      : EMPLOYEE_MODULES;
    return [...base.filter((m) => !m.need || capabilities[m.need]), LEAVE_MODULE];
  }, [isAdmin, canTakeCalls, capabilities]);

  /**
   * Удирдлагын модулиудыг ЧАДВАРаар шүүнэ (`src/lib/permissions.js`).
   */
  // «Акт бичих» нь удирдлагын эрх биш — энгийн ажилтанд удирдлагын цэс нээхгүй.
  const hasAdminArea = useMemo(
    () => Object.entries(capabilities).some(([k, v]) => v && k !== 'acts.create'),
    [capabilities]
  );

  const aiModules = isAdmin ? AI_MODULES_ADMIN : AI_MODULES_EMPLOYEE;

  const adminModules = useMemo(
    () =>
      isSuperAdmin
        ? [...ADMIN_MODULES, { key: 'AdminDevices', label: 'Төхөөрөмж зөвшөөрөл', icon: 'employees', accent: 'slate', need: 'employees' }]
        : ADMIN_MODULES,
    [isSuperAdmin]
  );

  // `adminOnly` нь чадвараас ДЭЭГҮҮР — зөвхөн админ, хөгжүүлэгчид.
  const adminVisibleModules = useMemo(
    () => adminModules.filter((m) => (!m.need || capabilities[m.need]) && (!m.adminOnly || isAdmin)),
    [adminModules, capabilities, isAdmin]
  );

  // ---------------------------------------------------------------------
  // Хавтангийн дараалал — хэрэглэгч өөрөө чирж зөөнө (төхөөрөмж дээр).
  // ---------------------------------------------------------------------
  const tileUserId = authProfile?.id || currentUser?.id || null;
  const [tileOrders, setTileOrders] = useState({ admin: null, service: null });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [admin, service] = await Promise.all([
        loadTileOrder('admin', tileUserId),
        loadTileOrder('service', tileUserId),
      ]);
      if (alive) setTileOrders({ admin, service });
    })();
    return () => {
      alive = false;
    };
  }, [tileUserId]);

  const saveOrder = useCallback(
    (section, keys) => {
      setTileOrders((previous) => ({ ...previous, [section]: keys }));
      saveTileOrder(section, tileUserId, keys);
    },
    [tileUserId]
  );

  const orderedAdminModules = useMemo(
    () => applyTileOrder(adminVisibleModules, tileOrders.admin),
    [adminVisibleModules, tileOrders.admin]
  );
  const orderedServiceModules = useMemo(
    () => applyTileOrder(serviceModules, tileOrders.service),
    [serviceModules, tileOrders.service]
  );

  const showAdminMenu = hasAdminArea && orderedAdminModules.length > 0;
  const [menu, setMenu] = useState('admin');
  const section = showAdminMenu ? menu : 'service';
  const sectionModules = section === 'admin' ? orderedAdminModules : orderedServiceModules;
  const groups = useMemo(
    () =>
      groupModules(sectionModules, section === 'admin' ? ADMIN_GROUPS : SERVICE_GROUPS).map((g) => ({
        ...g,
        items: sortByOrder(g.items, sectionModules),
      })),
    [sectionModules, section]
  );

  /** Хайлт — БҮХ хавтанг (удирдлага + үйлчилгээ) нэг дор шүүнэ. */
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!q) return null;
    const seen = new Set();
    return [...orderedAdminModules, ...orderedServiceModules].filter((m) => {
      if (seen.has(m.key) || !String(m.label || '').toLowerCase().includes(q)) return false;
      seen.add(m.key);
      return true;
    });
  }, [q, orderedAdminModules, orderedServiceModules]);

  const go = (m) => {
    navigation.navigate(m.route || m.key, m.params);
  };

  /** Хавтангийн харагдац: duotone icon хавтан + 2 мөр шошго. */
  const renderTileFace = (m, { dragging } = {}) => {
    const [icon, tone] = MODULE_LOOK[m.key] || [null, 'slate'];
    return (
      <View style={[styles.mod, dragging && styles.modDragging]}>
        <ModuleTile icon={icon || MODULE_ICONS[m.key]} tone={tone} size={54} radius={17} iconSize={26} />
        <Text style={styles.modLabel} numberOfLines={2}>
          {m.label}
        </Text>
      </View>
    );
  };

  const renderGrid = (items) => (
    <View style={styles.grid}>
      {items.map((m) => (
        <Pressable
          key={m.key}
          style={({ pressed }) => [{ width: tileWidth, borderRadius: 14 }, pressed && { backgroundColor: colors.field }]}
          onPress={() => go(m)}
          accessibilityRole="button"
          accessibilityLabel={m.label}
        >
          {renderTileFace(m)}
        </Pressable>
      ))}
    </View>
  );

  const shortcuts = isAdmin
    ? [
        { key: 'Attendance', label: 'Ирц', icon: 'calendar-check', tone: 'green', badge: stats.checkins },
        { key: 'Inventory', label: 'Агуулах', icon: 'warehouse', tone: 'amber' },
        { key: 'FleetFuel', label: 'Шатахуун', icon: 'gas-pump', tone: 'red', badge: stats.vehicles },
        { key: 'AdminCalls', label: 'Дуудлага', icon: 'phone-call', tone: 'blue' },
      ]
    : [
        { key: 'Attendance', label: 'Ирц', icon: 'calendar-check', tone: 'green' },
        { key: 'Calls', label: 'Дуудлага', icon: 'phone-call', tone: 'blue' },
        { key: 'MyPayroll', label: 'Цалин', icon: 'wallet', tone: 'amber' },
        { key: 'MyShift', label: 'Хуваарь', icon: 'clock', tone: 'indigo' },
      ];

  const extraAlerts =
    isCloud && !ohaabSignedToday
      ? [{ key: 'ohaab', icon: 'shield-half-outline', tone: 'amber', title: 'Өнөөдрийн ХААБ заавар', sub: 'Уншиж гарын үсэг зурна уу', onPress: () => navigation.navigate('Ohaab') }]
      : [];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Толгой: лого + Gennetex ERP, мэдэгдэл, зураг → Профайл */}
          <View style={styles.apphead}>
            <Wordmark sub="Ажлын нэгдсэн орчин" />
            <HeaderAccountActions />
          </View>

          <View style={styles.greet}>
            <Text style={styles.greetDate}>{longDate(now)}</Text>
            <Text style={styles.greetTitle} numberOfLines={2}>
              {greeting()}, {firstName(name)}
            </Text>
          </View>

          <HomeAttendanceCard />

          <View style={styles.search}>
            <Ionicons name="search" size={19} color={colors.faint} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={isAdmin ? 'Ирц, багаж, цалин хайх…' : 'Цалин, багаж, сургалт хайх…'}
              placeholderTextColor={colors.faint}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Цэвэрлэх">
                <Ionicons name="close-circle" size={19} color={colors.faint} />
              </Pressable>
            ) : (
              <Pressable onPress={() => navigation.navigate('BarcodeMode')} hitSlop={10} accessibilityLabel="Barcode уншуулах">
                <Ionicons name="barcode-outline" size={21} color={colors.faint} />
              </Pressable>
            )}
          </View>

          {searchHits ? (
            <Box style={styles.group}>
              <Text style={styles.groupTitle}>
                {searchHits.length ? `${searchHits.length} үр дүн` : 'Олдсонгүй'}
              </Text>
              {searchHits.length ? (
                renderGrid(searchHits)
              ) : (
                <Text style={styles.searchEmpty}>Өөр үгээр хайж үзнэ үү — жишээ нь «ирц», «багаж», «цалин».</Text>
              )}
            </Box>
          ) : (
            <>
              <View style={styles.shorts}>
                {shortcuts.map((s) => (
                  <Pressable
                    key={s.key}
                    style={({ pressed }) => [styles.short, pressed && { opacity: 0.8 }]}
                    onPress={() => navigation.navigate(s.key)}
                    accessibilityRole="button"
                    accessibilityLabel={s.label}
                  >
                    <ModuleTile icon={s.icon} tone={s.tone} size={46} radius={15} iconSize={24} />
                    <Text style={styles.shortLabel} numberOfLines={1}>
                      {s.label}
                    </Text>
                    {s.badge ? <Badge value={s.badge} tone="ink" style={styles.shortBadge} /> : null}
                  </Pressable>
                ))}
              </View>

              <TodayDashboard alerts={extraAlerts} title={isAdmin ? 'Өнөөдөр' : 'Миний өнөөдөр'} />

              {isAdmin ? (
                <>
                  <SectionHeader title="Шууд байршил" action="Бүгд" onAction={() => navigation.navigate('LiveTracking')} />
                  <HomeLiveMap onPress={() => navigation.navigate('LiveTracking')} />
                </>
              ) : null}

              <SectionHeader title="AI туслах" chip="Шинэ" chipTone="ai" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hsWrap} contentContainerStyle={styles.hs}>
                {aiModules.map((m, i) => (
                  <AiCard key={m.key} m={m} hero={i === 0} styles={styles} onPress={() => go(m)} />
                ))}
              </ScrollView>

              {showAdminMenu ? (
                <>
                  <SectionHeader title="Удирдлага" right={<Chip text={roleLabel(role)} tone="blue" />} />
                  <Box>
                    <StatGrid
                      size={22}
                      items={[
                        { label: 'Ажилтан', value: String(stats.employees), onPress: capabilities.employees ? () => navigation.navigate('Employees') : undefined },
                        { label: 'Онлайн', value: String(stats.online), live: true, onPress: () => navigation.navigate('LiveTracking') },
                        { label: 'Өнөөдрийн ирц', value: String(stats.checkins), onPress: () => navigation.navigate('Attendance') },
                        { label: 'Машин', value: String(stats.vehicles), onPress: () => navigation.navigate('VehiclesAdmin') },
                      ]}
                    />
                  </Box>
                </>
              ) : null}

              <SectionHeader title={showAdminMenu ? 'Бүх цэс' : 'Ажилтны үйлчилгээ'} />
              {showAdminMenu ? (
                <Segmented
                  style={{ marginBottom: 12 }}
                  value={menu}
                  onChange={(k) => {
                    setMenu(k);
                    setEditing(false);
                  }}
                  options={[
                    { key: 'admin', label: 'Удирдлага' },
                    { key: 'service', label: 'Ажилтны үйлчилгээ' },
                  ]}
                />
              ) : null}

              {editing ? (
                <Box style={styles.group}>
                  <Text style={styles.groupTitle}>Хавтанг удаан дараад чирж байрлалыг солино</Text>
                  <DraggableTileGrid
                    items={sectionModules}
                    columns={moduleColumns}
                    tileWidth={tileWidth}
                    tileHeight={tileHeight}
                    gap={4}
                    renderItem={renderTileFace}
                    onPressItem={go}
                    onOrderChange={(keys) => saveOrder(section, keys)}
                  />
                </Box>
              ) : (
                groups.map((g) => (
                  <Box key={g.title} style={styles.group}>
                    <View style={styles.groupHead}>
                      <Text style={styles.groupTitle}>{g.title}</Text>
                      <Text style={styles.groupTitle}>{g.items.length}</Text>
                    </View>
                    {renderGrid(g.items)}
                  </Box>
                ))
              )}

              <Pressable style={styles.edit} onPress={() => setEditing((v) => !v)} accessibilityRole="button">
                <Ionicons name={editing ? 'checkmark' : 'apps-outline'} size={16} color={colors.muted} />
                <Text style={styles.editText}>{editing ? 'Болсон' : 'Цэсийн дарааллыг засах'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** AI туслахын хэвтээ карт. Эхнийх нь онцлох (ai дэвсгэр). */
function AiCard({ m, hero, styles, onPress }) {
  const { colors } = useTheme();
  const [icon] = MODULE_LOOK[m.key] || ['sparkle'];
  return (
    <Pressable
      style={({ pressed }) => [styles.aic, hero && { backgroundColor: colors.ai }, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={m.sub ? `${m.label}. ${m.sub}` : m.label}
    >
      {hero ? (
        <View style={[styles.aicHeroTile]}>
          <PhIcon name={icon} size={22} color="#FFFFFF" />
        </View>
      ) : (
        <ModuleTile icon={icon} tone="purple" size={40} radius={12} iconSize={22} />
      )}
      <Text style={[styles.aicTitle, hero && { color: '#FFFFFF' }]} numberOfLines={2}>
        {m.label}
      </Text>
      {m.sub ? (
        <Text style={[styles.aicSub, hero && { color: 'rgba(255,255,255,0.78)' }]} numberOfLines={2}>
          {m.sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

// Хуучин Ionicons дүрс — MODULE_LOOK-д ороогүй шинэ модульд нөөц болно.
const MODULE_ICONS = {
  OfflineQueue: 'cloud-offline-outline', AdminTeams: 'people-outline', Teams: 'people-outline',
};

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    scroll: { paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 120 },

    apphead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6 },
    greet: { marginTop: 22, marginBottom: 16 },
    greetDate: { color: colors.muted, fontSize: 14, fontWeight: '500' },
    greetTitle: { color: colors.ink, fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },

    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.card,
      marginBottom: 12,
      ...shadow.md,
    },
    searchInput: { flex: 1, color: colors.ink, fontSize: 15, padding: 0 },
    searchEmpty: { color: colors.muted, fontSize: 13.5, lineHeight: 20, marginHorizontal: 8, marginBottom: 8 },

    shorts: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    short: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingTop: 14,
      paddingBottom: 12,
      paddingHorizontal: 4,
      alignItems: 'center',
      gap: 8,
      ...shadow.md,
    },
    shortLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    shortBadge: { position: 'absolute', top: 8, right: 10, borderWidth: 0 },

    hsWrap: { marginHorizontal: -spacing.lg, flexGrow: 0 },
    hs: { gap: 10, paddingHorizontal: spacing.lg, paddingBottom: 4 },
    aic: {
      width: 152,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 14,
      gap: 10,
      ...shadow.md,
    },
    aicHeroTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    aicTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 19 },
    aicSub: { color: colors.muted, fontSize: 12.5, lineHeight: 17, marginTop: -4 },

    group: { paddingTop: 14, paddingHorizontal: 8, paddingBottom: 8 },
    groupHead: { flexDirection: 'row', justifyContent: 'space-between' },
    groupTitle: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.2, marginHorizontal: 8, marginBottom: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    mod: { alignItems: 'center', gap: 7, paddingTop: 6, paddingBottom: 10, paddingHorizontal: 2 },
    modDragging: { backgroundColor: colors.field, borderRadius: 14 },
    modLabel: { color: colors.ink, fontSize: 11.5, fontWeight: '500', lineHeight: 14.5, textAlign: 'center', minHeight: 29 },

    edit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', height: 36, paddingHorizontal: 14, marginTop: 6 },
    editText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  });
