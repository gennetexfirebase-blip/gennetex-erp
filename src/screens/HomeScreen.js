import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, Easing, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import NavIcon from '../components/NavIcon';
import { spacing, radius, colors as C } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { roleLabel, canTakeServiceCalls } from '../lib/roles';
import * as tracking from '../services/trackingService';
import * as vehicleApi from '../services/vehicleService';
import { countTodayCheckIns } from '../services/attendanceService';
import * as ohaabApi from '../services/ohaabService';
import * as meetingApi from '../services/meetingService';
import { formatTime, formatDate } from '../lib/formatTime';
import TodayDashboard from '../components/enhancements/TodayDashboard';

const EMPLOYEE_MODULES = [
  { key: 'Ohaab', label: 'ХААБ заавар', icon: 'attendance', color: '#b45309' },
  { key: 'Inventory', label: 'Бараа авах', icon: 'inventory', color: C.primary },
  { key: 'MyStock', label: 'Миний үлдэгдэл', icon: 'allocation', color: '#16a34a'},
  { key: 'Tools', label: 'Багаж авах', icon: 'tools', color: '#ea580c'},
  { key: 'MyTools', label: 'Миний багаж', icon: 'allocation', color: '#ca8a04'},
  { key: 'SiteWork', label: 'Ажлын байр', icon: 'location', color: '#059669'},
  { key: 'MyContract', label: 'Миний гэрээ', icon: 'report', color: '#0f766e'},
  { key: 'EmployeeDirectory', label: 'Ажилтны мэдээлэл', icon: 'employees', color: '#0d9488'},
  { key: 'Vehicle', label: 'Машин (код)', icon: 'vehicle', color: C.warning },
  { key: 'Fuel', label: 'Бензин тооцоо', icon: 'fuel', color: C.success },
  { key: 'FleetFuel', label: 'Бензин зарцуулалт', icon: 'fuel', color: '#d97706' },
  { key: 'TelegramChat', label: 'Telegram чат', icon: 'chat', color: '#229ED9' },
  { key: 'MyTelegram', label: 'Миний Telegram', icon: 'chat', color: '#0088cc' },
  { key: 'Calls', label: 'Дуудлага', icon: 'calls', color: '#0891b2'},
  { key: 'Meeting', label: 'Хурал', icon: 'chat', color: '#0F766E'},
  { key: 'Attendance', label: 'Ирц', icon: 'attendance', color: '#db2777'},
  { key: 'MyShift', label: 'Хуваарь харах', icon: 'clock', color: '#2563eb'},
  { key: 'EmployeeReport', label: 'Ажилтан тайлан', icon: 'report', color: '#1e3a5f'},
  { key: 'Feedback', label: 'Санал гомдол', icon: 'report', color: '#dc2626'},
  { key: 'Chat', label: 'Чат', icon: 'chat', color: '#7c3aed'},
  // --- Enhancements (additive) ---
  { key: 'RouteOptimize', label: 'Зам оновчлох', icon: 'location', color: '#0ea5e9' },
  { key: 'KnowledgeBase', label: 'Мэдлэгийн сан', icon: 'report', color: '#6366f1' },
  { key: 'ToolCheckIn', label: 'Багаж нөхцөл', icon: 'tools', color: '#ea580c' },
  { key: 'BarcodeMode', label: 'Barcode горим', icon: 'qr', color: '#64748b' },
  { key: 'OfflineQueue', label: 'Оффлайн queue', icon: 'clock', color: '#7c3aed' },
];

const ADMIN_MODULES = [
  { key: 'AdminOhaab', label: 'ХААБ заавар', icon: 'attendance', color: '#b45309' },
  { key: 'Employees', label: 'Ажилтан бүртгэх', icon: 'employees', color: C.primary },
  { key: 'AdminApplications', label: 'Ажлын байрны анкет', icon: 'employees', color: '#0369a1'},
  { key: 'AdminContracts', label: 'Хөдөлмөрийн гэрээ', icon: 'report', color: '#0f766e'},
  { key: 'AdminReports', label: 'Тайлан', icon: 'report', color: '#1e3a5f'},
  { key: 'AdminFeedback', label: 'Санал гомдол', icon: 'report', color: '#dc2626'},
  { key: 'EmployeeDirectory', label: 'Ажилтны мэдээлэл', icon: 'employees', color: '#0d9488'},
  { key: 'SiteWork', label: 'Ажлын байр / баг', icon: 'location', color: '#059669'},
  { key: 'AdminCalls', label: 'Бүх дуудлага', icon: 'calls', color: '#0891b2'},
  { key: 'AdminVisits', label: 'Очсон лог', icon: 'location', color: '#0d9488'},
  { key: 'Requisition', label: 'Шаардах хуудас', icon: 'report', color: '#0369a1'},
  { key: 'VehiclesAdmin', label: 'Машины мэдээлэл солих', icon: 'qr', color: C.warning },
  { key: 'VehicleSpecs', label: 'Машины оншилгоо', icon: 'vehicle', color: '#2563eb' },
  { key: 'FleetFuel', label: 'Бензин зарцуулалт', icon: 'fuel', color: '#d97706' },
  { key: 'Live', label: 'Байршил хяналт', icon: 'location', color: C.success },
  { key: 'Inventory', label: 'Бараа материал', icon: 'inventory', color: C.primary },
  { key: 'Tools', label: 'Багаж', icon: 'tools', color: '#ea580c'},
  { key: 'ToolAllocation', label: 'Ажилтны үлдэгдэл', icon: 'allocation', color: C.accent },
  // --- Enhancements (additive) ---
  { key: 'LiveOps', label: 'Live Ops', icon: 'location', color: '#ef4444' },
  { key: 'SlaReport', label: 'SLA & KPI', icon: 'report', color: '#f59e0b' },
  { key: 'AutoDispatch', label: 'Автомат оноолт', icon: 'calls', color: '#8b5cf6' },
  { key: 'LowStock', label: 'Бага үлдэгдэл', icon: 'inventory', color: '#dc2626' },
  { key: 'CallCost', label: 'Дуудлагын өртөг', icon: 'report', color: '#0d9488' },
  { key: 'PayrollExport', label: 'Цалин export', icon: 'report', color: '#1e3a5f' },
  { key: 'Predictive', label: 'Predictive', icon: 'location', color: '#db2777' },
  { key: 'PublicTickets', label: 'Public tickets', icon: 'chat', color: '#0369a1' },
  { key: 'BranchAdmin', label: 'Салбар', icon: 'location', color: '#64748b' },
  { key: 'FeatureFlags', label: 'Feature flags', icon: 'ai', color: '#4f46e5' },
];

// AI боломжуудыг тусад нь тод хэсэг болгож харуулна
const AI_MODULES_EMPLOYEE = [
  { key: 'GennetexAi', label: 'Gennetex AI', sub: 'Асуулт асууж чатлах', icon: 'chat', color: '#7c3aed' },
  { key: 'AiInventoryHome', label: 'AI тооллого', sub: 'Камераар бараа тоолох', icon: 'inventory', color: '#0d9488' },
];

const AI_MODULES_ADMIN = [
  { key: 'AiAdmin', label: 'AI Админ туслах', sub: 'Хянах · ажил хуваарилах · Excel', icon: 'ai', color: '#4f46e5' },
  { key: 'GennetexAi', label: 'Gennetex AI', sub: 'Асуулт асууж чатлах', icon: 'chat', color: '#7c3aed' },
  { key: 'AiInventoryHome', label: 'AI тооллого', sub: 'Камераар бараа тоолох', icon: 'inventory', color: '#0d9488' },
  { key: 'AdminPerformance', label: 'AI гүйцэтгэл', sub: 'Ажилтны дүн шинжилгээ', icon: 'report', color: '#6366f1' },
  { key: 'AdminAppUsage', label: 'Апп ашиглалт', sub: 'AI хэрэглээний тайлан', icon: 'report', color: '#8b5cf6' },
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
  const { colors } = useTheme();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const styles = useStyles(makeStyles);
  const { authProfile, profile, isAdmin, isSuperAdmin, isCloud, fetchEmployees, currentUser } = useApp();
  const name = authProfile?.name || profile?.name || 'Ажилтан';

  const [stats, setStats] = useState({ employees: 0, online: 0, vehicles: 0, checkins: 0 });
  const [now, setNow] = useState(() => new Date());
  const [ohaabSignedToday, setOhaabSignedToday] = useState(true);

  // Динамик хэмжээ тооцоолох (flex wrap болон gap тохируулахад багтахгүй байхаас сэргийлнэ)
  const bodyPadding = 16; // spacing.lg
  const tileGap = 12; // spacing.md
  const availableWidth = SCREEN_WIDTH - bodyPadding * 2;
  const tileWidth = Math.floor((availableWidth - tileGap * 2) - 1) / 3;
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
    }, [isAdmin, isCloud, fetchEmployees, currentUser?.id])
  );

  const dateStr = formatDate(now);

  // Админ дуудлагаар явах эрхтэй эсэх (superadmin эрх өгсөн үед)
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

  const aiModules = isAdmin ? AI_MODULES_ADMIN : AI_MODULES_EMPLOYEE;
  const adminModules = useMemo(
    () =>
      isSuperAdmin
        ? [...ADMIN_MODULES, { key: 'AdminDevices', label: 'Төхөөрөмж зөвшөөрөл', icon: 'employees', color: '#b45309' }]
        : ADMIN_MODULES,
    [isSuperAdmin]
  );

  const mountAnim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mountAnim, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [mountAnim, pulse]);
  const aiSlide = mountAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const badgeScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  const go = (m) => {
    if (m.key === 'Vehicle') {
      navigation.navigate('Vehicle', { autoScan: true });
      return;
    }
    navigation.navigate(m.key);
  };

  const renderTile = (m, i) => (
    <TouchableOpacity
      key={`${m.key}-${i}`}
      style={[styles.tile, { width: tileWidth }]}
      activeOpacity={0.82}
      onPress={() => go(m)}
    >
      <View style={[styles.tileIcon, { backgroundColor: m.color + '14'}]}>
        <NavIcon name={m.icon} size={24} color={m.color} />
      </View>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {m.label}
      </Text>
    </TouchableOpacity>
  );

  const renderAiCard = (m, i) => (
    <AiCard key={`${m.key}-${i}`} m={m} styles={styles} width={aiCardWidth} onPress={() => go(m)} />
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{name}</Text>
            <View style={[styles.roleChip, isAdmin && styles.roleChipAdmin]}>
              <Text style={[styles.roleChipText, isAdmin && styles.roleChipTextAdmin]}>
                {roleLabel(authProfile?.role || (isAdmin ? 'admin' : 'employee'))}
              </Text>
            </View>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerClock}>{formatTime(now)}</Text>
            <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('Profile')}>
              {authProfile?.avatar_url ? (
                <Image source={{ uri: authProfile.avatar_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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

        <View style={styles.clockCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.clockLabel}>Өнөөдрийн ирц</Text>
            <Text style={styles.clockSub}>Цаг бүртгэл хийх</Text>
          </View>
          <TouchableOpacity style={styles.clockBtn} onPress={() => navigation.navigate('Attendance')} activeOpacity={0.85}>
            <NavIcon name="clock" size={18} color="#fff"/>
            <Text style={styles.clockBtnText}>Цаг бүртгэх</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{ opacity: mountAnim, transform: [{ translateY: aiSlide }] }}>
          <View style={styles.aiHeaderRow}>
            <View style={styles.aiTitleWrap}>
              <Animated.View style={[styles.aiBadge, { transform: [{ scale: badgeScale }] }]}>
                <NavIcon name="ai" size={16} color="#fff" />
              </Animated.View>
              <Text style={styles.sectionTitle}>AI туслах</Text>
            </View>
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>ШИНЭ</Text>
            </View>
          </View>
          <View style={styles.aiGrid}>{aiModules.map(renderAiCard)}</View>
        </Animated.View>

        {isAdmin ? (
          <>
            <View style={styles.adminHeaderRow}>
              <Text style={styles.sectionTitle}>Админ удирдлага</Text>
              <View style={styles.adminTag}>
                <Text style={styles.adminTagText}>{isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN'}</Text>
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

            <TouchableOpacity style={styles.adminCta} activeOpacity={0.85} onPress={() => navigation.navigate('Employees')}>
              <View style={styles.adminCtaIcon}>
                <NavIcon name="employees" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminCtaTitle}>Шинэ ажилтан бүртгэх</Text>
                <Text style={styles.adminCtaSub}>Имэйл + 1 удаагийн нууц үг үүсгэнэ</Text>
              </View>
              <Text style={styles.adminCtaArrow}>→</Text>
            </TouchableOpacity>

            <View style={styles.grid}>{adminModules.map(renderTile)}</View>
          </>
        ) : (
          <Text style={styles.welcomeSub}>Доорх үйлчилгээнүүдээс сонгон ажлаа үргэлжлүүлнэ үү.</Text>
        )}

        <Text style={styles.sectionTitle}>{isAdmin ? 'Ажилтны үйлчилгээ' : 'Үйлчилгээ'}</Text>
        <View style={styles.grid}>{serviceModules.map(renderTile)}</View>
      </ScrollView>
    </View>
  );
}

function AiCard({ m, styles, width, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  return (
    <Animated.View style={{ width, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.aiCard, { borderColor: m.color + '40', backgroundColor: m.color + '10' }]}
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <View style={[styles.aiCardIcon, { backgroundColor: m.color + '22' }]}>
          <NavIcon name={m.icon} size={22} color={m.color} />
        </View>
        <Text style={styles.aiCardTitle} numberOfLines={1}>{m.label}</Text>
        {m.sub ? <Text style={styles.aiCardSub} numberOfLines={2}>{m.sub}</Text> : null}
      </TouchableOpacity>
    </Animated.View>
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

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surfaceDim,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: spacing.sm },
  headerRight: { alignItems: 'flex-end', gap: spacing.sm },
  headerClock: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  greeting: { color: colors.textMuted, fontSize: 14 },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2, letterSpacing: -0.3 },
  date: { color: colors.textMuted, fontSize: 13, marginTop: 4, textTransform: 'capitalize'},
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 26 },
  avatarLetter: { color: colors.primary, fontSize: 22, fontWeight: '800'},
  body: { padding: spacing.lg, paddingBottom: 110 },
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
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.md, marginTop: spacing.sm },
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
  roleChipAdmin: { backgroundColor: colors.primarySoft, borderColor: '#dbe4ff'},
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
  tile: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tileLabel: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  aiTag: {
    backgroundColor: '#7c3aed22',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  aiTagText: { color: '#7c3aed', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
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
    backgroundColor: '#b45309',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  ohaabPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ohaabPillText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  ohaabTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ohaabSub: { color: 'rgba(255,255,255,0.92)', fontSize: 12, marginTop: 2, lineHeight: 16 },
  ohaabArrow: { color: '#fff', fontSize: 22, fontWeight: '800' },
});
