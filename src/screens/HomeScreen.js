import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import NavIcon from '../components/NavIcon';
import { spacing, radius } from '../theme';
import { accent, accentMap } from '../theme/accents';
import { useTheme, useStyles } from '../context/ThemeContext';
import { roleLabel, canTakeServiceCalls } from '../lib/roles';
import { effectivePermissions } from '../lib/permissions';
import DraggableTileGrid from '../components/DraggableTileGrid';
import { loadTileOrder, saveTileOrder, applyTileOrder } from '../lib/tileOrder';
import * as tracking from '../services/trackingService';
import * as vehicleApi from '../services/vehicleService';
import { countTodayCheckIns } from '../services/attendanceService';
import * as ohaabApi from '../services/ohaabService';
import * as meetingApi from '../services/meetingService';
import { formatDate } from '../lib/formatTime';
import TodayDashboard from '../components/enhancements/TodayDashboard';
import HomeAttendanceCard from '../components/HomeAttendanceCard';
import HeaderAccountActions from '../components/HeaderAccountActions';
import HomeLiveMap from '../components/HomeLiveMap';

const EMPLOYEE_MODULES = [
  { key: 'EmployeeTraining', label: 'Авсан сургалт', icon: 'attendance', accent: 'green' },
  { key: 'StoreReadiness', label: 'Store шалгалт', icon: 'report', accent: 'brand' },
  { key: 'WorkHeightRisk', label: 'Өндөрт ажиллах ХАБЭА', icon: 'attendance', accent: 'rose' },
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
  { key: 'Fuel', label: 'Бензиний баримт илгээх', icon: 'fuel', accent: 'amber' },
  { key: 'FleetFuel', label: 'Бензин зарцуулалт', icon: 'fuel', accent: 'amber' },
  { key: 'TelegramChat', label: 'Telegram чат', icon: 'chat', accent: 'teal' },
  { key: 'MyTelegram', label: 'Миний Telegram', icon: 'chat', accent: 'teal' },
  { key: 'Calls', label: 'Дуудлага', icon: 'calls', accent: 'teal'},
  { key: 'Meeting', label: 'Хурал', icon: 'chat', accent: 'teal'},
  { key: 'Attendance', label: 'Ирц', icon: 'attendance', accent: 'indigo'},
  { key: 'MyShift', label: 'Хуваарь харах', icon: 'clock', accent: 'indigo'},
  { key: 'MyPayroll', label: 'Миний цалин', icon: 'report', accent: 'indigo'},
  { key: 'EmployeeReport', label: 'Ажилтан тайлан', icon: 'report', accent: 'slate'},
  { key: 'Feedback', label: 'Санал гомдол', icon: 'report', accent: 'rose'},
  { key: 'Chat', label: 'Чат', icon: 'chat', accent: 'teal'},
  { key: 'CallHistory', label: 'Дуудлагын түүх', icon: 'calls', accent: 'brand'},
  // --- Enhancements (additive) ---
  { key: 'RouteOptimize', label: 'Зам оновчлох', icon: 'location', accent: 'green' },
  { key: 'KnowledgeBase', label: 'Мэдлэгийн сан', icon: 'report', accent: 'slate' },
  { key: 'ToolCheckIn', label: 'Багаж нөхцөл', icon: 'tools', accent: 'brand' },
  { key: 'BarcodeMode', label: 'Barcode горим', icon: 'qr', accent: 'brand' },
  { key: 'OfflineQueue', label: 'Оффлайн queue', icon: 'clock', accent: 'slate' },
];

const ADMIN_MODULES = [
  { key: 'OperationalAlerts', label: 'Анхааруулгын төв', icon: 'attendance', accent: 'rose', need: 'approve' },
  { key: 'BusinessSettings', label: 'Тохиргооны төв', icon: 'tools', accent: 'slate', need: 'approve', adminOnly: true },
  { key: 'AdminOhaab', label: 'ХААБ заавар', icon: 'attendance', accent: 'amber', need: 'approve' },
  { key: 'Employees', label: 'Ажилтан бүртгэх', icon: 'employees', accent: 'indigo', need: 'employees' },
  // ⚠️ "Хэлтэс" нь нүүр дэлгэцийн хавтан БИШ. Хэлтсийг ажилтан нэмэх
  //    хэсгээс (Ажилтан бүртгэх → Хэлтэс) сонгож, хөгжүүлэгч тэндээсээ
  //    шинээр үүсгэнэ. Ингэснээр "хаана хэлтэс нэмдэг билээ" гэсэн
  //    хоёр өөр зам үүсэхгүй.
  { key: 'AdminApplications', label: 'Ажлын байрны анкет', icon: 'employees', accent: 'indigo', need: 'employees'},
  { key: 'AdminContracts', label: 'Хөдөлмөрийн гэрээ', icon: 'report', accent: 'indigo', need: 'employees'},
  { key: 'AdminReports', label: 'Тайлан', icon: 'report', accent: 'slate', need: 'employees'},
  // Багийн ӨДРИЙН гүйцэтгэл: хэдэн баг · өдөрт хэдэн айл · хэр хугацаанд.
  // Компанийн хэмжээний дүн тул `adminOnly` — ахлах, менежерт харагдахгүй.
  { key: 'AdminWorkPerformance', label: 'Ажилчдын гүйцэтгэл', icon: 'report', accent: 'green', need: 'employees', adminOnly: true },
  { key: 'Payroll', label: 'Цалин тооцоо', icon: 'report', accent: 'indigo', need: 'payroll' },
  { key: 'AdminFeedback', label: 'Санал гомдол', icon: 'report', accent: 'rose', need: 'employees'},
  { key: 'EmployeeDirectory', label: 'Ажилтны мэдээлэл', icon: 'employees', accent: 'indigo', need: 'employees'},
  { key: 'SiteWork', label: 'Ажлын байр / баг', icon: 'location', accent: 'green', need: 'approve'},
  { key: 'AdminCalls', label: 'Бүх дуудлага', icon: 'calls', accent: 'teal', need: 'approve'},
  { key: 'AdminVisits', label: 'Очсон лог', icon: 'location', accent: 'green', need: 'approve'},
  { key: 'Requisition', label: 'Шаардах хуудас', icon: 'report', accent: 'brand', need: 'inventory'},
  { key: 'VehiclesAdmin', label: 'Машины мэдээлэл солих', icon: 'qr', accent: 'amber', need: 'employees' },
  { key: 'VehicleSpecs', label: 'Машины оношилгоо', icon: 'vehicle', accent: 'amber', need: 'employees' },
  { key: 'FleetFuel', label: 'Бензин зарцуулалт', icon: 'fuel', accent: 'amber', need: 'employees' },
  { key: 'Inventory', label: 'Бараа материал', icon: 'inventory', accent: 'brand', need: 'inventory' },
  // Багаж ба хангамж нэг хавтанд. Хоёул ажилтанд ОЛГОГДДОГ зүйл тул
  // хамт байрлана. Бараа материал нь агуулахын үлдэгдэл — тусдаа.
  { key: 'ToolsHub', label: 'Багаж, хангамж', icon: 'tools', accent: 'brand', need: 'inventory' },
  { key: 'ToolAllocation', label: 'Ажилтны үлдэгдэл', icon: 'allocation', accent: 'brand', need: 'inventory' },
  // --- Enhancements (additive) ---
  { key: 'LiveOps', label: 'Live Ops', icon: 'location', accent: 'green', need: 'approve' },
  { key: 'SlaReport', label: 'SLA & KPI', icon: 'report', accent: 'slate', need: 'employees' },
  { key: 'AutoDispatch', label: 'Автомат оноолт', icon: 'calls', accent: 'teal', need: 'approve' },
  { key: 'LowStock', label: 'Бага үлдэгдэл', icon: 'inventory', accent: 'rose', need: 'inventory' },
  { key: 'CallCost', label: 'Дуудлагын өртөг', icon: 'report', accent: 'slate', need: 'employees' },
  { key: 'PayrollExport', label: 'Цалин export', icon: 'report', accent: 'indigo', need: 'payroll' },
  { key: 'Predictive', label: 'Predictive', icon: 'location', accent: 'slate', need: 'employees' },
  { key: 'PublicTickets', label: 'Public tickets', icon: 'chat', accent: 'teal', need: 'employees' },
  { key: 'BranchAdmin', label: 'Салбар', icon: 'location', accent: 'slate', need: 'employees' },
  { key: 'FeatureFlags', label: 'Feature flags', icon: 'ai', accent: 'slate', need: 'employees' },
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
/** Админ инженер биш — энэ модуль зөвхөн ажилтанд */
const ADMIN_HIDDEN_KEYS = new Set(['Calls']);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Өглөөний мэнд';
  if (h < 18) return 'Өдрийн мэнд';
  return 'Оройн мэнд';
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { colors, isDark, gradients } = useTheme();
  const accents = useMemo(() => accentMap(isDark), [isDark]);
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const styles = useStyles(makeStyles);
  const { authProfile, profile, isAdmin, isSuperAdmin, isCloud, fetchEmployees, currentUser } = useApp();
  const name = authProfile?.name || profile?.name || 'Ажилтан';

  const [stats, setStats] = useState({ employees: 0, online: 0, vehicles: 0, checkins: 0 });
  const [now, setNow] = useState(() => new Date());
  const [ohaabSignedToday, setOhaabSignedToday] = useState(true);

  // Динамик хэмжээ тооцоолох (flex wrap болон gap тохируулахад багтахгүй байхаас сэргийлнэ)
  const bodyPadding = 16; // spacing.lg
  const tileGap = 14;
  const moduleColumns = SCREEN_WIDTH >= 520 ? 4 : 3;
  const availableWidth = SCREEN_WIDTH - bodyPadding * 2;
  const tileWidth = Math.floor((availableWidth - tileGap * (moduleColumns - 1)) / moduleColumns);
  const tileHeight = moduleColumns === 3
    ? Math.max(108, Math.round(tileWidth * 1.0))
    : Math.round(tileWidth * 1.1);
  const aiCardWidth = Math.floor((availableWidth - tileGap) - 1) / 2;

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

  const dateStr = formatDate(now);

  // Админ дуудлагаар явах эрхтэй эсэх (superadmin эрх өгсөн үед)
  const role = authProfile?.role;
  const canTakeCalls = canTakeServiceCalls(authProfile);
  const serviceModules = useMemo(
    () =>
      isAdmin
        ? EMPLOYEE_MODULES.filter(
            (m) =>
              !ADMIN_KEYS.has(m.key) &&
              (!ADMIN_HIDDEN_KEYS.has(m.key) || (m.key === 'Calls' && canTakeCalls))
          )
        : EMPLOYEE_MODULES,
    [isAdmin, canTakeCalls]
  );

  /**
   * Удирдлагын модулиудыг ЧАДВАРаар шүүнэ.
   *
   * Эрхийн нэрээр биш чадвараар шалгаснаар ахлах хэлтсээ, админ бүгдийг
   * харна — тус бүрд нь тусдаа жагсаалт зохиох шаардлагагүй.
   *
   * Чадвар нь ХОЁР эх сурвалжтай: эрхийн түвшний анхны утга, дээр нь
   * хөгжүүлэгчийн хүн тус бүрд тохируулсан тусгай зөвшөөрөл
   * (`src/lib/permissions.js`).
   */
  const capabilities = useMemo(() => effectivePermissions(authProfile), [authProfile]);

  /** Удирдлагын хэсэг харуулах эсэх — ядаж нэг чадвартай бол. */
  const hasAdminArea = useMemo(
    () => Object.values(capabilities).some(Boolean),
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

  // Чадвараар шүүнэ. `adminModules`-аас ХОЙШ байх ёстой — эс бөгөөс
  // тодорхойлогдохоос өмнө уншиж TDZ алдаа өгнө.
  //
  // `adminOnly` нь чадвараас ДЭЭГҮҮР: тухайн модуль компанийн хэмжээний
  // мэдээлэл харуулдаг тул зөвхөн админ, хөгжүүлэгчид нээгдэнэ (ахлах,
  // менежер нь `employees` чадвартай ч болохгүй).
  const adminVisibleModules = useMemo(
    () => adminModules.filter((m) => (!m.need || capabilities[m.need]) && (!m.adminOnly || isAdmin)),
    [adminModules, capabilities, isAdmin]
  );

  // ---------------------------------------------------------------------
  // Хавтангийн дараалал — хэрэглэгч өөрөө чирж зөөнө
  // ---------------------------------------------------------------------
  // Дараалал нь ХЭРЭГЛЭГЧ БҮРЭЭР төхөөрөмж дээр хадгалагдана. Эрхээс
  // үл хамааран (ажилтан, ахлах, админ, хөгжүүлэгч) бүгд зөөж чадна.
  const tileUserId = authProfile?.id || currentUser?.id || null;
  const [tileOrders, setTileOrders] = useState({ admin: null, service: null });

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

  /**
   * Хавтангийн хайлт.
   *
   * ⚠️ Эрхээс хамаараад 28 хүртэл хавтан гурван баганаар өрөгддөг тул
   *    хэрэгтэй зүйлээ нүдээрээ хайх нь удаан. Хайлт нь БҮХ хавтанг
   *    (удирдлага + үйлчилгээ) нэг дор шүүнэ — хэрэглэгч аль хэсэгт
   *    байгааг нь санах шаардлагагүй.
   */
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const searchHits = useMemo(() => {
    if (!q) return null;
    return [...orderedAdminModules, ...orderedServiceModules].filter((m) =>
      String(m.label || '').toLowerCase().includes(q)
    );
  }, [q, orderedAdminModules, orderedServiceModules]);

  const go = (m) => {
    navigation.navigate(m.key);
  };

  /**
   * Хавтангийн ДОТООД харагдац.
   *
   * Дарах/чирэх үйлдлийг гаднах `DraggableTileGrid` хариуцна — тиймээс
   * энд зөвхөн зураг, нэрийг зурна (өргөн, өндрийг нь мөн тэр өгнө).
   */
  const renderTileFace = (m, { dragging } = {}) => {
    const tint = accents[m.accent] || accents.brand;
    const ion = MODULE_ICONS[m.key];
    return (
      <View
        style={[
          styles.tile,
          { flex: 1 },
          dragging && styles.tileDragging,
        ]}
      >
        <View style={[styles.tileIcon, { backgroundColor: tint + '16' }]}>
          {ion ? <Ionicons name={ion} size={25} color={tint} /> : <NavIcon name={m.icon} size={24} color={tint} />}
        </View>
        <Text style={styles.tileLabel} numberOfLines={3}>
          {m.label}
        </Text>
      </View>
    );
  };

  const renderAiCard = (m, i) => (
    <AiCard key={`${m.key}-${i}`} m={m} styles={styles} width={aiCardWidth} onPress={() => go(m)} />
  );

  return (
    <View style={styles.container}>

      {/* Толгой контенттой ХАМТ гүйлгэгдэнэ — өмнө нь тогтмол байсан тул
          гүйлгэхэд контент дугуй булангийн завсраар ард нь харагддаг байв. */}
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
      {/* Брэндийн hero толгой — мэндчилгээ, огноо, мэдэгдэл нэг дор. */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBg}>
        <View style={styles.heroOrb} />
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandLockup}>
            <View style={styles.brandMarkCrop}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.brandMarkImage}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.brandWord}>GENNETEX</Text>
              <Text style={styles.brandTagline}>ERP АЖЛЫН НЭГДСЭН ОРЧИН</Text>
            </View>
          </View>
          <HeaderAccountActions onBrand />
        </View>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.welcomeLine}>Өнөөдрийн ажлаа эндээс үргэлжлүүлнэ үү.</Text>
          </View>
          <View style={styles.datePill}>
            <Ionicons name="calendar-outline" size={14} color="#fff" />
            <Text style={styles.date}>{dateStr}</Text>
          </View>
        </View>
      </SafeAreaView>
      </LinearGradient>
      <View style={styles.body}>
        {/* Ажилчдын байршил — дарахад «Байршил хяналт» нээгдэнэ (тусдаа хавтан нуугдсан). */}
        <HomeLiveMap onPress={() => navigation.navigate('LiveTracking')} />
        <QuickHomeModules
          styles={styles}
          isAdmin={isAdmin}
          stats={stats}
          onGo={(key) => navigation.navigate(key)}
        />
        <TodayDashboard />

        {isCloud && !ohaabSignedToday ? (
          <TouchableOpacity
            style={styles.ohaabBanner}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Ohaab')}
          >
            <View style={styles.ohaabPill}>
              <Text style={styles.ohaabPillText}>ХААБ</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ohaabTitle}>Өнөөдрийн заавар баталгаажуулаагүй</Text>
              <Text style={styles.ohaabSub}>Уншиж гарын үсэг зурна уу · бараа/багаж бүртгэхэд шаардлагатай</Text>
            </View>
            <Text style={styles.ohaabArrow}>→</Text>
          </TouchableOpacity>
        ) : null}

        {/* Ирцийн ТӨЛӨВ — хуучин "Цаг бүртгэх" товч нь ирсэн эсэхийг
            хэлдэггүй байсан тул Ирц дэлгэц рүү орж шалгах шаардлагатай
            байв. Одоо карт өөрөө хэлнэ. */}
        <HomeAttendanceCard />

        <View style={styles.searchBar}>
          <NavIcon name="qr" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Хайх — ирц, багаж, цалин…"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Хайлт идэвхтэй үед бусад бүх хэсгийг НУУНА — үр дүн
            хуудсын хаа нэгтээ нуугдвал хайлт өөрөө утгагүй болно. */}
        {searchHits ? (
          <View style={styles.searchWrap}>
            <Text style={styles.searchCount}>
              {searchHits.length ? `${searchHits.length} үр дүн` : 'Олдсонгүй'}
            </Text>
            {searchHits.length ? (
              <View style={styles.searchGrid}>
                {searchHits.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.searchTile, { width: tileWidth, height: tileWidth }]}
                    onPress={() => go(m)}
                    activeOpacity={0.85}
                  >
                    {renderTileFace(m)}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.searchEmpty}>
                Өөр үгээр хайж үзнэ үү — жишээ нь «ирц», «багаж», «цалин».
              </Text>
            )}
          </View>
        ) : null}

        <View style={{ display: searchHits ? 'none' : 'flex' }}>
          <View style={styles.aiHeaderRow}>
            <View style={styles.aiTitleWrap}>
              <View style={styles.aiBadge}>
                <NavIcon name="ai" size={16} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>AI туслах</Text>
            </View>
            <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>Шинэ</Text>
            </View>
          </View>
          <View style={styles.aiGrid}>{aiModules.map(renderAiCard)}</View>
        </View>

        {hasAdminArea && !searchHits ? (
          <>
            <View style={styles.adminHeaderRow}>
              <Text style={styles.sectionTitle}>Удирдлага</Text>
              <View style={styles.adminTag}>
                <Text style={styles.adminTagText}>{roleLabel(role).toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.statRow}>
              <Stat icon="employees" value={stats.employees} label="Ажилтан" color={colors.primary} />
              <Stat icon="online" value={stats.online} label="Online" color={colors.success} />
            </View>
            <View style={styles.statRow}>
              <Stat icon="attendance" value={stats.checkins} label="Өнөөдрийн ирц" color={colors.accent} />
              <Stat icon="vehicle" value={stats.vehicles} label="Машин" color={colors.warning} />
            </View>

            {capabilities.employees ? <TouchableOpacity style={styles.adminCta} activeOpacity={0.85} onPress={() => navigation.navigate('Employees')}>
              <View style={styles.adminCtaIcon}>
                <NavIcon name="employees" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminCtaTitle}>Шинэ ажилтан бүртгэх</Text>
                <Text style={styles.adminCtaSub}>Gmail хаягийг зөвшөөрч, ажилтан бүртгэнэ</Text>
              </View>
              <Text style={styles.adminCtaArrow}>→</Text>
            </TouchableOpacity> : null}

            <Text style={styles.dragHint}>Хавтанг удаан дараад чирж байрлалыг солино.</Text>
            <DraggableTileGrid
              items={orderedAdminModules}
              columns={moduleColumns}
              tileWidth={tileWidth}
              tileHeight={tileHeight}
              gap={tileGap}
              renderItem={renderTileFace}
              onPressItem={go}
              onOrderChange={(keys) => saveOrder('admin', keys)}
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : (
          <Text style={styles.welcomeSub}>Доорх үйлчилгээнүүдээс сонгон ажлаа үргэлжлүүлнэ үү.</Text>
        )}

        {searchHits ? null : (
          <>
            <Text style={styles.sectionTitle}>{isAdmin ? 'Ажилтны үйлчилгээ' : 'Үйлчилгээ'}</Text>
            <Text style={styles.dragHint}>Хавтанг удаан дараад чирж байрлалыг солино.</Text>
            <DraggableTileGrid
              items={orderedServiceModules}
              columns={moduleColumns}
              tileWidth={tileWidth}
              tileHeight={tileHeight}
              gap={tileGap}
              renderItem={renderTileFace}
              onPressItem={go}
              onOrderChange={(keys) => saveOrder('service', keys)}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

function QuickHomeModules({ styles, isAdmin, stats, onGo }) {
  const { colors } = useTheme();
  const cards = [
    { key: 'Attendance', title: 'Ирц', icon: 'calendar-outline', badge: stats.checkins || '' },
    { key: isAdmin ? 'Inventory' : 'MyStock', title: isAdmin ? 'Агуулах' : 'Миний бараа', icon: 'cube-outline', badge: isAdmin ? stats.employees || '' : '' },
    { key: isAdmin ? 'FleetFuel' : 'Fuel', title: 'Шатахуун', icon: 'car-sport-outline', badge: stats.vehicles || '' },
  ];
  return (
    <View style={styles.quickCards}>
      {cards.map((card, index) => (
        <TouchableOpacity key={card.key} style={styles.quickCard} onPress={() => onGo(card.key)} activeOpacity={0.86}>
          {index > 0 ? <View style={styles.quickDivider} /> : null}
          <View style={styles.quickCardIcon}>
            <Ionicons name={card.icon} size={22} color={colors.primary} />
          </View>
          {card.badge !== '' ? <Text style={styles.quickCardBadge}>{card.badge}</Text> : null}
          <Text style={styles.quickCardTitle} numberOfLines={1}>{card.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AiCard({ m, styles, width, onPress }) {
  const { isDark } = useTheme();
  const tint = accent(m.accent, isDark);
  return (
    <View style={{ width }}>
      <TouchableOpacity
        style={[styles.aiCard, { borderColor: tint + '40', backgroundColor: tint + '10' }]}
        activeOpacity={0.9}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={m.sub ? `${m.label}. ${m.sub}` : m.label}
      >
        <View style={[styles.aiCardIcon, { backgroundColor: tint + '22' }]}>
          <NavIcon name={m.icon} size={22} color={tint} />
        </View>
        <Text style={styles.aiCardTitle} numberOfLines={1}>{m.label}</Text>
        {m.sub ? <Text style={styles.aiCardSub} numberOfLines={2}>{m.sub}</Text> : null}
      </TouchableOpacity>
    </View>
  );
}

function Stat({ icon, value, label, color }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '14'}]}>
        <NavIcon name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const TILE_GAP = spacing.md;

// Модуль бүрт өөрийн утгатай дүрс. Өмнө нь NavIcon-ийн цөөн дүрс давтагдаж
// (календарь — сургалт, ХААБ, өндөрт ажиллах, анхааруулга; тайлан — 5 газар)
// аль нь аль модуль болохыг дүрсээр ялгах боломжгүй байв.
const MODULE_ICONS = {
  EmployeeTraining: 'school-outline', StoreReadiness: 'storefront-outline', WorkHeightRisk: 'warning-outline',
  Ohaab: 'shield-checkmark-outline', AdminOhaab: 'shield-checkmark-outline', MyStock: 'cube-outline',
  MyTools: 'hammer-outline', SiteWork: 'business-outline', MyContract: 'document-text-outline',
  EmployeeDirectory: 'id-card-outline', Vehicle: 'car-outline', Fuel: 'receipt-outline', FleetFuel: 'speedometer-outline',
  TelegramChat: 'paper-plane-outline', MyTelegram: 'at-outline', Calls: 'call-outline', Meeting: 'videocam-outline',
  Attendance: 'calendar-outline', MyShift: 'time-outline', MyPayroll: 'wallet-outline', EmployeeReport: 'clipboard-outline',
  Feedback: 'chatbox-ellipses-outline', AdminFeedback: 'chatbox-ellipses-outline', Chat: 'chatbubbles-outline',
  AdminApplications: 'reader-outline', AdminCalls: 'headset-outline', AdminContracts: 'documents-outline',
  AdminReports: 'bar-chart-outline', AdminVisits: 'footsteps-outline', AdminWorkPerformance: 'trophy-outline',
  AutoDispatch: 'git-network-outline', BarcodeMode: 'barcode-outline', BranchAdmin: 'git-branch-outline',
  BusinessSettings: 'settings-outline', CallCost: 'cash-outline', CallHistory: 'list-outline', Employees: 'person-add-outline',
  Inventory: 'archive-outline', KnowledgeBase: 'library-outline', LiveOps: 'pulse-outline', LowStock: 'alert-circle-outline',
  OfflineQueue: 'cloud-offline-outline', OperationalAlerts: 'notifications-circle-outline', Payroll: 'calculator-outline',
  PayrollExport: 'download-outline', Predictive: 'analytics-outline', PublicTickets: 'ticket-outline',
  Requisition: 'create-outline', RouteOptimize: 'map-outline', SlaReport: 'stats-chart-outline',
  ToolAllocation: 'layers-outline', ToolCheckIn: 'checkmark-done-outline', ToolsHub: 'construct-outline',
  VehicleSpecs: 'build-outline', VehiclesAdmin: 'car-sport-outline', AdminTeams: 'people-outline', Teams: 'people-outline',
};

const makeStyles = ({ colors, shadow, isDark }) => {
  const A = accentMap(isDark);
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroBg: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    top: -80, right: -60, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 58 },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 185 },
  brandMarkCrop: { width: 46, height: 46, overflow: 'hidden', borderRadius: 14, backgroundColor: '#fff' },
  brandMarkImage: { position: 'absolute', width: 80, height: 66, left: -17, top: -1 },
  brandWord: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.6 },
  brandTagline: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: spacing.md },
  headerRight: { alignItems: 'flex-end', gap: spacing.sm },
  // Цаг агаар: цагтай нэг мөрөнд зэрэгцүүлж, баруун талдаа зайтай.
  // `flex-start` тул доорх нэр, badge, огнооны байрлалд нөлөөлөхгүй.
  headerWeather: { alignSelf: 'flex-start', marginTop: 4, marginRight: spacing.md },
  headerClock: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18 },
  welcomeLine: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', marginLeft: spacing.sm },

  // Хавтангийн хайлт
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    padding: 0,
  },
  searchClear: { color: colors.textMuted, fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },

  searchWrap: { marginBottom: spacing.lg },
  searchCount: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  searchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  searchTile: { borderRadius: radius.lg, overflow: 'hidden' },
  searchEmpty: { color: colors.textFaint, fontSize: 13.5, lineHeight: 20 },
  name: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2, letterSpacing: -0.6 },
  date: { color: '#fff', fontSize: 11.5, fontWeight: '600', textTransform: 'capitalize'},
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 26 },
  avatarLetter: { color: colors.primary, fontSize: 22, fontWeight: '800'},
  body: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  homeHero: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: isDark ? colors.border : 'rgba(15,23,42,0.05)',
    ...(isDark ? shadow.sm : shadow.md),
  },
  heroCopy: { flex: 1, padding: spacing.lg },
  livePill: { alignSelf: 'flex-start', marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  livePillText: { color: colors.success, fontSize: 11, fontWeight: '700' },
  heroOnlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  heroTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3 },
  heroSub: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  heroAction: { width: 58, minHeight: 64, marginRight: spacing.md, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 4 },
  quickCards: { flexDirection: 'row', marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: isDark ? colors.border : 'rgba(15,23,42,0.05)', borderRadius: radius.xl, ...(isDark ? shadow.sm : shadow.md) },
  quickCard: { flex: 1, minHeight: 100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 12 },
  quickDivider: { position: 'absolute', left: 0, top: 14, bottom: 14, width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  quickCardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 7, backgroundColor: colors.primarySoft },
  quickCardBadge: { position: 'absolute', top: 8, right: 8, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: colors.primary, backgroundColor: colors.primarySoft, fontSize: 10, fontWeight: '700' },
  quickCardTitle: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  clockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  clockLabel: { color: colors.textMuted, fontSize: 13 },
  clockSub: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  clockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },
  clockBtnText: { color: '#fff', fontWeight: '800'},
  welcomeSub: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700', marginBottom: spacing.md, marginTop: spacing.sm },
  roleChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipAdmin: { backgroundColor: colors.primarySoft, borderColor: colors.primary + "55" },
  roleChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700'},
  roleChipTextAdmin: { color: colors.primary },
  adminHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  adminTag: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  adminTagText: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  statRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800'},
  statLabel: { color: colors.textMuted, fontSize: 12 },
  adminCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  adminCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminCtaTitle: { color: colors.text, fontSize: 16, fontWeight: '800'},
  adminCtaSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  adminCtaArrow: { color: colors.primary, fontSize: 22, fontWeight: '800'},
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
  // Хавтан DraggableTileGrid-ийн нүдэнд байрладаг тул нүдээ БҮТЭН дүүргэнэ.
  // (Өмнө нь width: '31%' байсан тул нүдний 31%-ийг л эзэлж, карт болгоход
  //  нарийхан дугуй болж текст тасардаг байв.)
  tile: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: isDark ? colors.border : 'rgba(15,23,42,0.05)',
    ...(isDark ? {} : shadow.sm),
  },
  tileIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
    alignSelf: 'center',
  },
  tileLabel: {
    width: '100%',
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15.5,
  },
  // Чирч байгаа хавтан — өргөгдсөн мэт харагдана
  tileDragging: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    ...shadow.lg,
  },
  dragHint: { color: colors.textFaint, fontSize: 11, marginTop: spacing.xs },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: A.violet,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  aiTag: {
    backgroundColor: A.violet + '22',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  aiTagText: { color: A.violet, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  aiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP, marginBottom: spacing.lg },
  aiCard: {
    width: '100%',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    ...shadow.sm,
  },
  aiCardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  aiCardTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  aiCardSub: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  ohaabBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: isDark ? 'rgba(245,181,68,0.12)' : '#fff7ed',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(245,181,68,0.35)' : '#fed7aa',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  ohaabPill: {
    backgroundColor: A.amber,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ohaabPillText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  ohaabTitle: { color: isDark ? '#fde68a' : '#9a3412', fontWeight: '800', fontSize: 15 },
  ohaabSub: { color: isDark ? 'rgba(253,230,138,0.8)' : '#c2410c', fontSize: 12, marginTop: 2, lineHeight: 16 },
  ohaabArrow: { color: isDark ? '#fde68a' : '#9a3412', fontSize: 22, fontWeight: '800' },
});
};
