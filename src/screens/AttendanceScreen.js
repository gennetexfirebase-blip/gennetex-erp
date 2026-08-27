import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFaceDetection } from '../lib/faceDetection';
import * as faceCloud from '../services/faceCloudService';
import * as faceEdge from '../services/faceEdgeService';
import { friendlyError } from '../lib/erpMessages';
import * as deviceApi from '../services/deviceAuthService';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import { Card, Button, Field, SectionTitle, EmptyState } from '../components/ui';
import TimeSelect from '../components/TimeSelect';
import SelfieCamera from '../components/SelfieCamera';
import ProfileSetup from '../components/ProfileSetup';
import * as attApi from '../services/attendanceService';
import * as faceApi from '../services/faceService';
import * as shiftApi from '../services/shiftService';
import * as notifyApi from '../services/notificationService';
import * as notifyCenterApi from '../services/notificationCenterService';
import { playCheckInSound, playCheckOutSound } from '../services/attendanceSoundService';
import { dayKey, formatDuration, calculateDayWork } from '../lib/workHours';
import {
  WEEKDAYS,
  mergeRestDays,
  emptyRestDays,
  formatRestDaysSummary,
  weekdayLabel,
  isRestDay,
} from '../lib/breakSchedule';
import { distanceMeters } from '../lib/geo';
import { spacing, radius } from '../theme';
import { colors as employeeColors } from '../theme/attendanceLight';
import { colors as adminColors } from '../theme/attendanceDark';
import EmployeeAttendanceMap from '../components/EmployeeAttendanceMap';
import GeofenceStatusBanner from '../components/GeofenceStatusBanner';
import MapControlButton from '../components/MapControlButton';
import AttendanceActionButton from '../components/AttendanceActionButton';
import AttendanceBottomPanel from '../components/AttendanceBottomPanel';
import ChatAvatar from '../components/ChatAvatar';
import WorkHoursRing from '../components/WorkHoursRing';
import SummaryStatCards from '../components/SummaryStatCards';
import DateRangeFilterBar from '../components/DateRangeFilterBar';
import AttendanceFilterSheet from '../components/AttendanceFilterSheet';
import DateRangeSheet from '../components/DateRangeSheet';
import * as deptApi from '../services/departmentService';

/**
 * Царай таниулт бүтэлгүйтсэн ШАЛТГААНЫГ хэрэглэгчид тодорхой хэлнэ.
 *
 * ЯАГААД ЧУХАЛ ВЭ: өмнө нь бүх тохиолдолд "Царай таарсангүй" гэсэн нэг
 * мессеж гардаг байв. Гэтэл шалтгаанууд нь тэс өөр:
 *
 *   • царай бүртгүүлээгүй       → бүртгүүлэх хэрэгтэй
 *   • зураг дээр царай олдоогүй → гэрэл/өнцөг засах хэрэгтэй
 *   • ӨӨР ХҮНИЙ царай           → энэ хүн өөр хүний эрхээр
 *                                 ирцээ бүртгүүлэх гэж оролдож байна
 *
 * Сүүлийнх нь зөрчил тул "дахин оролдоно уу" гэж хэлэх нь БУРУУ —
 * дахин оролдоод ч болохгүй, эзэн нь өөрөө ирэх ёстой.
 */
function describeFaceFailure(result, ownerName) {
  const reason = result?.reason;

  if (reason === 'not_enrolled') {
    return {
      title: 'Царай бүртгэгдээгүй',
      message:
        'Таны царай бүртгэгдээгүй байна.\n\nПрофайл → Царай бүртгүүлэх хэсгээр орж эхлээд бүртгүүлнэ үү.',
    };
  }

  if (reason === 'no_face') {
    return {
      title: 'Царай олдсонгүй',
      message:
        result?.message ||
        'Зураг дээр царай олдсонгүй. Гэрэл сайтай газар, камер руу эгц харна уу.',
    };
  }

  // Царай олдсон, хэрэглэгч бүртгэлтэй, гэвч таарахгүй байна.
  return {
    title: 'Өөр хүний царай байна',
    message:
      `Энэ бол ${ownerName || 'энэ эрхийн эзэн'}-ийн царай биш байна.\n\n` +
      'Ажилтан бүр ЗӨВХӨН өөрийн эрхээр, өөрийн царайгаар ирцээ бүртгүүлнэ. ' +
      'Өөр хүнийг орлож бүртгүүлэх боломжгүй.\n\n' +
      'Хэрэв та эрхийнхээ эзэн мөн бол профайлаасаа царайгаа дахин бүртгүүлнэ үү.',
  };
}

/**
 * Админы удирдлагын карт — өнгөт дугуй icon, гарчиг/тайлбар, outline товч,
 * доор нь жагсаалт. Гурван хэсэг (хуваарь/амралт/байршил) ижил хэлбэртэй
 * байхын тулд тусад нь гаргав.
 */
function AdminSectionCard({
  colors,
  icon,
  iconBg,
  iconFg,
  title,
  subtitle,
  actionLabel,
  onAction,
  footer,
  children,
  style,
}) {
  return (
    <View style={[dashStyles.sectionCard, { backgroundColor: colors.surfaceContainer }, style]}>
      <View style={dashStyles.sectionHead}>
        <View style={[dashStyles.sectionIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={19} color={iconFg} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
          ) : null}
        </View>
        {actionLabel ? (
          <TouchableOpacity
            style={[dashStyles.outlineBtn, { borderColor: colors.primary }]}
            onPress={onAction}
            activeOpacity={0.75}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
      {footer ? (
        <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 10 }}>{footer}</Text>
      ) : null}
    </View>
  );
}

export default function AttendanceScreen() {
  const navigation = useNavigation();
  const faceDetector = useFaceDetection();
  // ⚠️ Энэ дэлгэц нь аппын Dark/Light СОНГОЛТООС ХАМААРАХГҮЙ:
  //   • ажилтны тал — үргэлж ЦАЙВАР (`employeeColors`)
  //   • админы тал  — үргэлж БАРААН (`adminColors`)
  // Доорх `styles`-ийг зөвхөн АДМИН тал өнгөтэйгөөр ашигладаг тул
  // `useTheme()`-ийн оронд бараан палитрыг шууд өгнө. Эс бөгөөс утас
  // цайвар горимд байхад админы modal-ууд цагаан болж, эргэн тойрны
  // бараан самбартай зөрчилдөнө.
  const colors = adminColors;
  const styles = useMemo(() => makeStyles({ colors: adminColors }), []);
  // Notch / Dynamic Island-тай зөрчилдөхгүй байхын тулд.
  // `SafeAreaView` нь `position: absolute` дотор inset-ээ зөв тооцдоггүй
  // тул шууд hook ашиглана.
  const insets = useSafeAreaInsets();
  const { currentUser, isCloud, isAdmin, fetchEmployees, shiftStatus, refreshShiftStatus } = useApp();
  const profile = currentUser;
  const developerEmail = String(process.env.EXPO_PUBLIC_DEVELOPER_EMAIL || '').trim().toLowerCase();
  const bypassDeviceApproval =
    profile?.role === 'superadmin' ||
    profile?.role === 'developer' ||
    (!!developerEmail && String(profile?.email || '').trim().toLowerCase() === developerEmail);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [pendingType, setPendingType] = useState('check_in');
  const [pendingRemote, setPendingRemote] = useState(false);
  const [pendingDistance, setPendingDistance] = useState(null);
  const [capturedLoc, setCapturedLoc] = useState({});
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState([]);
  const [pending, setPending] = useState([]);

  // Царайны бүртгэл
  const [enrolled, setEnrolled] = useState(true);
  const [faceTemplates, setFaceTemplates] = useState([]);
  const [enrollCount, setEnrollCount] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);
  const [livenessChallenge, setLivenessChallenge] = useState(null);
  const [facePreparing, setFacePreparing] = useState(false);
  /**
   * Царай таних ажиллах боломжтой эсэх.
   *
   *   null  — хараахан шалгаагүй
   *   true  — ажиллана (native эсвэл Edge Function)
   *   false — боломжгүй. Ирцийг ЗОГСООХГҮЙ: төхөөрөмж + байршил + selfie-гээр
   *           бүртгээд `pending` болгож админд шалгуулна.
   *
   * Expo Go дээр native модуль ачаалагдахгүй бөгөөд Edge Function ч бэлэн
   * биш байж болно. Тэр тохиолдолд ажилтныг гацаах нь буруу — ирц бол
   * өдөр тутмын үйл ажиллагаа.
   */
  const [faceBackendReady, setFaceBackendReady] = useState(null);
  const [faceBackendReason, setFaceBackendReason] = useState(null);

  // Зайнаас хүсэлтийн modal
  const [remoteModal, setRemoteModal] = useState(false);
  const [remoteReason, setRemoteReason] = useState('');
  // true = quickAttendance (камергүй) нээсэн remoteModal, false = startCheck (царайтай)
  const [quickFlow, setQuickFlow] = useState(false);
  // Байршил тохируулах modal (admin)
  const [locModal, setLocModal] = useState(false);
  const [locForm, setLocForm] = useState({ name: '', radius: '200'});

  // Хуваарь + ажилласан цаг
  const [myShift, setMyShift] = useState(null);
  const [myRestDays, setMyRestDays] = useState([]);
  const [myDayAttendance, setMyDayAttendance] = useState([]);
  const [hoursModal, setHoursModal] = useState(false);
  const [breakModal, setBreakModal] = useState(false);
  const [breakForm, setBreakForm] = useState({ userId: ''});
  const [restDays, setRestDays] = useState(emptyRestDays());
  const [breakScheduleList, setBreakScheduleList] = useState([]);
  const [migrationHint, setMigrationHint] = useState(null);
  const [todayShifts, setTodayShifts] = useState([]);
  const [shiftModal, setShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    userId: '',
    shiftDate: dayKey(),
    startTime: '09:00',
    endTime: '18:00',
    locationId: '',
    note: '',
  });
  const shiftAlertSent = useRef(false);
  const [employees, setEmployees] = useState([]);

  // ---- Admin dashboard (шинэ dark UI) ----
  const [dashboardDate, setDashboardDate] = useState(dayKey());
  const [dayRows, setDayRows] = useState([]);
  const [dayRowsLoading, setDayRowsLoading] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [dateSheetVisible, setDateSheetVisible] = useState(false);
  const [dashFilters, setDashFilters] = useState({
    departmentId: null,
    status: 'all',
    locationId: null,
    employeeQuery: '',
  });
  const [departments, setDepartments] = useState([]);

  const [dayRowsError, setDayRowsError] = useState(null);

  const loadDayRows = useCallback(async () => {
    if (!isCloud || !isAdmin) return;
    setDayRowsLoading(true);
    setDayRowsError(null);
    try {
      const data = await attApi.fetchDepartmentAttendanceToday(dashFilters.departmentId, dashboardDate);
      setDayRows(data || []);
    } catch (e) {
      // Алдааг ЧИМЭЭГҮЙ залгихгүй — өмнө нь залгидаг байсан тул жагсаалт
      // хоосон харагдахад шалтгаан нь ойлгомжгүй байв.
      setDayRows([]);
      setDayRowsError(e?.message || 'Ирцийн жагсаалт ачаалж чадсангүй');
    } finally {
      setDayRowsLoading(false);
    }
  }, [isCloud, isAdmin, dashFilters.departmentId, dashboardDate]);

  useEffect(() => {
    loadDayRows();
  }, [loadDayRows]);

  useEffect(() => {
    if (!isCloud || !isAdmin) return;
    deptApi.fetchDepartments({ kind: 'org' }).then(setDepartments).catch(() => {});
  }, [isCloud, isAdmin]);

  const filteredDayRows = dayRows.filter((r) => {
    if (dashFilters.status !== 'all' && r.status !== dashFilters.status) return false;
    if (
      dashFilters.employeeQuery &&
      !String(r.employee_name || '').toLowerCase().includes(dashFilters.employeeQuery.toLowerCase())
    )
      return false;
    return true;
  });

  // Нэг мөрөнд багтахаар 4 үндсэн үзүүлэлт (загварын дагуу).
  // "Ирсэн" нь цагтаа ирсэн + хоцорсон + эрт явсныг бүгдийг хамруулна —
  // ирц бүртгүүлсэн эсэх нь админд хамгийн чухал тоо.
  const dayStatCards = [
    { key: 'all', label: 'Бүгд', value: dayRows.length },
    { key: 'absent', label: 'Тасалсан', value: dayRows.filter((r) => r.status === 'absent').length },
    { key: 'late', label: 'Хоцорсон', value: dayRows.filter((r) => r.status === 'late').length },
    { key: 'on_time', label: 'Ирсэн', value: dayRows.filter((r) => r.check_in_at).length },
  ];

  const loadEmployees = useCallback(async () => {
    if (!isCloud || !isAdmin) return;
    try {
      setEmployees(await fetchEmployees());
    } catch (e) {}
  }, [isCloud, isAdmin, fetchEmployees]);

  const loadBreakSchedules = useCallback(async () => {
    if (!isCloud || !isAdmin) return;
    try {
      setBreakScheduleList(await shiftApi.fetchAllBreakSchedules());
    } catch (e) {
      if (shiftApi.isShiftTableMissing(e)) setMigrationHint(shiftApi.MIGRATION_HINT);
    }
  }, [isCloud, isAdmin]);

  const loadMyDay = useCallback(async () => {
    if (!isCloud || !profile?.id || isAdmin) return;
    try {
      const today = dayKey();
      const [shift, restDayRows, attendance] = await Promise.all([
        shiftApi.fetchMyShift(profile.id, today),
        shiftApi.fetchBreakScheduleForUser(profile.id),
        shiftApi.fetchAttendanceForUserDay(profile.id, today),
      ]);
      setMyShift(shift);
      setMyRestDays(mergeRestDays(restDayRows));
      setMyDayAttendance(attendance);
      setMigrationHint(null);
    } catch (e) {
      if (shiftApi.isShiftTableMissing(e)) setMigrationHint(shiftApi.MIGRATION_HINT);
    }
  }, [isCloud, profile?.id, isAdmin]);

  const loadTodayShifts = useCallback(async () => {
    if (!isCloud || !isAdmin) return;
    try {
      setTodayShifts(await shiftApi.fetchShiftsForDate(dayKey()));
      setMigrationHint(null);
    } catch (e) {
      if (shiftApi.isShiftTableMissing(e)) setMigrationHint(shiftApi.MIGRATION_HINT);
    }
  }, [isCloud, isAdmin]);

  const loadRecords = useCallback(async () => {
    if (!isCloud || !isAdmin) return;
    try {
      setPending(await attApi.fetchPendingAttendance());
      await loadTodayShifts();
      await loadBreakSchedules();
    } catch (e) {
      setError(e.message);
    }
  }, [isCloud, isAdmin, loadTodayShifts, loadBreakSchedules]);

  const loadLocations = useCallback(async () => {
    if (!isCloud) return;
    try {
      setLocations(await attApi.fetchAttendanceLocations());
    } catch (e) {
      // Байршил ачаалагдахгүй бол ажилтан хаана бүртгүүлэхээ мэдэхгүй тул
      // ЧИМЭЭГҮЙ залгихгүй — шалтгааныг дэлгэц дээр харуулна.
      setError(e?.message || 'Бүртгэлийн байршил ачаалж чадсангүй');
    }
  }, [isCloud]);

  /**
   * Царай таних боломжтой эсэхийг НЭГ УДАА тодорхойлно.
   * Дэлгэц нээгдэхэд шалгаснаар ажилтан зураг авч эхэлсний дараа биш,
   * урьдчилан мэдэж байх болно.
   */
  const probeFaceBackend = useCallback(async () => {
    if (!isCloud) {
      setFaceBackendReady(false);
      setFaceBackendReason('offline');
      return false;
    }
    if (faceApi.isNativeFaceAvailable()) {
      setFaceBackendReady(true);
      setFaceBackendReason(null);
      return true;
    }
    if (faceEdge.isEdgeFaceAvailable) {
      const health = await faceEdge.healthCheck();
      const ok = !!health.ok && health.modelsLoaded !== false;
      setFaceBackendReady(ok);
      setFaceBackendReason(ok ? null : health.error || health.hint || 'edge-unavailable');
      if (ok) return true;
    }
    if (faceCloud.isCloudFaceConfigured) {
      setFaceBackendReady(true);
      setFaceBackendReason(null);
      return true;
    }
    setFaceBackendReady(false);
    setFaceBackendReason((prev) => prev || 'no-backend');
    return false;
  }, [isCloud]);

  const loadFace = useCallback(async () => {
    if (!isCloud || !profile?.id) {
      setEnrolled(true);
      return;
    }
    try {
      if (faceApi.isNativeFaceAvailable()) {
        const templates = await faceApi.getFaceTemplates(profile.id);
        setFaceTemplates(templates);
        setEnrollCount(templates.length);
        setEnrolled(templates.length >= faceApi.ENROLL_TARGET);
      } else {
        const cloudCount = faceEdge.isEdgeFaceAvailable
          ? await faceEdge.countEnrollments(profile.id)
          : await faceCloud.countEnrollments(profile.id);
        setFaceTemplates([]);
        setEnrollCount(cloudCount);
        setEnrolled(cloudCount >= faceApi.ENROLL_TARGET);
      }
    } catch (e) {
      setFaceTemplates([]);
      setEnrollCount(0);
      setEnrolled(false);
    }
  }, [isCloud, profile?.id]);

  useEffect(() => {
    loadRecords();
    loadLocations();
    loadFace();
    probeFaceBackend();
    loadMyDay();
    loadEmployees();
  }, [loadRecords, loadLocations, loadFace, probeFaceBackend, loadMyDay, loadEmployees]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return {};
      const pos = await Location.getCurrentPositionAsync({});
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      return {};
    }
  };

  // Ажилтны Map дэлгэц дээр амьд байршил харуулах — check-in/out дээрх
  // нэг удаагийн `getLocation()`-оос ТУСДАА, зөвхөн ДЭЛГЭЦИЙН зурагт зориулав.
  // Одоо байгаа ирц бүртгэх логикт нөлөөлөхгүй.
  const [liveLocation, setLiveLocation] = useState(null);
  const mapRef = useRef(null);

  // 'granted' | 'denied' | null (хараахан шалгаагүй)
  const [locationPermission, setLocationPermission] = useState(null);

  // Header дээрх хонхны badge — уншаагүй мэдэгдлийн тоо.
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!isCloud || !profile?.id) return;
    let cancelled = false;
    const load = () =>
      notifyCenterApi
        .fetchUnreadCount(profile.id)
        .then((n) => !cancelled && setUnreadCount(n || 0))
        .catch(() => {});
    load();
    // Шинэ мэдэгдэл ирэхэд тоо шууд шинэчлэгдэнэ.
    const unsub = notifyCenterApi.subscribeNotifications?.(profile.id, load);
    return () => {
      cancelled = true;
      if (typeof unsub === 'function') unsub();
    };
  }, [isCloud, profile?.id]);

  useEffect(() => {
    // Админ ч өөрийн (ЗӨВХӨН ӨӨРИЙНХӨӨ, бусдын биш) байршлыг харна.
    if (!isCloud) return;
    let sub;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        setLocationPermission(status === 'granted' ? 'granted' : 'denied');
        if (status !== 'granted') return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 15 },
          (pos) => {
            if (cancelled) return;
            setLiveLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          }
        );
      } catch (e) {
        if (!cancelled) setLocationPermission('denied');
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [isCloud]);

  // Одоогийн байршлыг зөвшөөрөгдсөн цэгүүдтэй харьцуулна
  /**
   * Ирц бүртгэсэн байршлыг Google Maps дээр нээнэ.
   *
   * Апп дотор газрын зураг суулгахын оронд системийн Maps аппыг ашиглана —
   * ажилтан тэндээс замын заавар авах, дэлгэрүүлж харах боломжтой бөгөөд
   * аппын хэмжээ ч нэмэгдэхгүй.
   */
  const openOnMap = (record) => {
    const lat = Number(record?.latitude);
    const lng = Number(record?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert('Байршил алга', 'Энэ бүртгэлд байршлын мэдээлэл хадгалагдаагүй байна.');
      return;
    }
    const label = encodeURIComponent(
      `${record.staff_name || 'Ирц'} · ${record.type === 'check_in' ? 'Ирсэн' : 'Явсан'}`
    );
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${label}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Нээж чадсангүй', 'Газрын зургийн апп олдсонгүй.')
    );
  };

  const evaluateLocation = (loc) => {
    const near = attApi.nearestAttendanceLocation(loc, locations);

    // Ажлын цэг тохируулаагүй бол байршлыг ШАЛГАХ БОЛОМЖГҮЙ.
    //
    // Өмнө нь энэ тохиолдолд 'onsite' гэж буцаадаг байсан — өөрөөр хэлбэл
    // хаанаас ирц бүртгүүлсэн ч "ажлын байран дээр" гэж тооцогдож,
    // баталгаажуулалтгүй өнгөрдөг байв. Шалгаж чадахгүй байгааг
    // "зөв" гэж үзэх нь буруу — админд шалгуулна.
    if (!locations.length) {
      return { mode: 'remote', distance: null, locationName: null, reason: 'no-locations' };
    }
    if (loc.latitude == null) {
      return { mode: 'remote', distance: null, locationName: null, reason: 'no-gps' };
    }
    return {
      mode: near.within ? 'onsite' : 'remote',
      distance: near.distance,
      locationName: near.name,
      reason: near.within ? null : 'outside',
    };
  };

  const workSummary = calculateDayWork({
    attendance: myDayAttendance,
    dateKey: dayKey(),
  });
  const todayIsRest = isRestDay(myRestDays);

  const breakSchedulesByUser = breakScheduleList.reduce((acc, row) => {
    if (!acc[row.user_id]) {
      acc[row.user_id] = { user_id: row.user_id, user_name: row.user_name, days: [] };
    }
    acc[row.user_id].days.push(row.day_of_week);
    return acc;
  }, {});

  const pickEmployeeForBreak = async (userId) => {
    setBreakForm({ userId });
    if (!userId) {
      setRestDays(emptyRestDays());
      return;
    }
    try {
      const rows = await shiftApi.fetchBreakScheduleForUser(userId);
      setRestDays(mergeRestDays(rows));
    } catch (e) {
      setRestDays(emptyRestDays());
    }
  };

  const openBreakModal = () => {
    setBreakForm({ userId: ''});
    setRestDays(emptyRestDays());
    setBreakModal(true);
  };

  const toggleRestDay = (day) => {
    setRestDays((prev) =>
      prev.map((d) => (d.day_of_week === day ? { ...d, is_rest: !d.is_rest } : d))
    );
  };

  // Хуваарийн эхлэх цагт ажлын газарт байхгүй бол админд мэдэгдэл (өдөрт нэг удаа)
  useEffect(() => {
    if (!isCloud || isAdmin || !myShift || shiftAlertSent.current) return;
    const check = async () => {
      const [h, m] = (myShift.start_time || '09:00').split(':').map(Number);
      const start = new Date();
      start.setHours(h, m, 0, 0);
      const grace = new Date(start.getTime() + 10 * 60000);
      if (Date.now() < grace.getTime()) return;
      const hasCheckIn = myDayAttendance.some((a) => a.type === 'check_in');
      if (hasCheckIn) return;
      const loc = await getLocation();
      let offSite = true;
      if (myShift.location_id) {
        const shiftLoc = locations.find((l) => l.id === myShift.location_id);
        if (shiftLoc && loc.latitude != null) {
          const d = distanceMeters(loc, { latitude: shiftLoc.latitude, longitude: shiftLoc.longitude });
          offSite = d > (shiftLoc.radius_m || 200);
        }
      } else {
        const ev = evaluateLocation(loc);
        offSite = ev.mode === 'remote';
      }
      if (!offSite) return;
      shiftAlertSent.current = true;
      try {
        await notifyApi.notifyShiftMissed({
          staffName: profile?.name,
          shiftTime: myShift.start_time,
          locationName: myShift.location_name,
        });
      } catch (e) {}
    };
    check();
  }, [isCloud, isAdmin, myShift, myDayAttendance, locations, profile?.name]);

  const startCheck = async (type) => {
    if (facePreparing) return;

    // Өдөрт нэг удаа ирсэн, нэг удаа явсан.
    if (type === 'check_in' && shiftStatus.checkedIn) {
      Alert.alert('Аль хэдийн бүртгэгдсэн', 'Өнөөдөр та ирснээ бүртгүүлсэн байна.');
      return;
    }
    if (type === 'check_out') {
      if (!shiftStatus.checkedIn) {
        Alert.alert('Эхлээд ирснээ бүртгүүлнэ үү', 'Ирсэн бүртгэлгүйгээр явсан гэж бүртгэх боломжгүй.');
        return;
      }
      if (shiftStatus.checkedOut) {
        Alert.alert('Аль хэдийн бүртгэгдсэн', 'Өнөөдөр та явсанаа бүртгүүлсэн байна.');
        return;
      }
    }

    setError(null);
    setVerificationStep(0);
    setLivenessChallenge(null);
    const nativeFace = faceApi.isNativeFaceAvailable();
    // Expo Go дээр хоёр зам байна: өөрийн Edge Function (үнэгүй, эрхэмлэнэ)
    // эсвэл Luxand (гуравдагч тал). Аль нь ч байхгүй бол л зогсооно.
    if (isCloud && !nativeFace && !faceEdge.isEdgeFaceAvailable && !faceCloud.isCloudFaceConfigured) {
      Alert.alert('Царай таних тохиргоо дутуу', 'Царай таних үйлчилгээ тохируулаагүй байна. Админд хандана уу.');
      return;
    }

    // Expo Go дээр эхлэхийн өмнө Edge Function ажиллаж байгаа эсэхийг шалгана.
    // Эс бөгөөс ажилтан гурван зураг авсны эцэст л алдаа мэдэх болно.
    if (isCloud && !nativeFace && faceEdge.isEdgeFaceAvailable) {
      const health = await faceEdge.healthCheck();
      if (!health.ok || health.modelsLoaded === false) {
        Alert.alert(
          'Царай таних бэлэн бус байна',
          `${health.error || health.hint || 'Тодорхойгүй алдаа'}\n\n` +
            (health.stage ? `Үе шат: ${health.stage}\n` : '') +
            'Админд энэ мессежийг дамжуулна уу.'
        );
        return;
      }
    }
    setFacePreparing(true);
    try {
      const [loc] = await Promise.all([
        getLocation(),
        isCloud && nativeFace ? faceApi.prepareFaceModel() : Promise.resolve(),
      ]);
      const { mode, distance, locationName } = evaluateLocation(loc);
      setPendingType(type);
      setPendingDistance(distance);
      setCapturedLoc({ ...loc, locationName });

      // Царай таних боломжгүй бол ирцийг ЗОГСООХГҮЙ.
      //
      // Expo Go дээр native модуль ачаалагдахгүй, Edge Function ч бэлэн биш
      // байж болно. Ажилтныг гацаахын оронд төхөөрөмж + байршил + selfie-гээр
      // бүртгээд `pending` болгож админд шалгуулна. Хамгаалалт алдагдахгүй —
      // зөвхөн шалгах ажил хүнд шилжинэ.
      if (isCloud && faceBackendReady === false) {
        setEnrolling(false);
        setVerificationStep(0);
        setCameraVisible(true);
        return;
      }

      // Анхны бүртгэлийг зөвшөөрөгдсөн төхөөрөмж, ажлын цэг дээр хийнэ.
      if (isCloud && !enrolled) {
        const dev = bypassDeviceApproval
          ? { verified: true, deviceId: null, reason: null }
          : await deviceApi.verifyDeviceForAttendance(profile.id);
        if (!dev.verified && !bypassDeviceApproval) {
          Alert.alert(
            'Төхөөрөмж зөвшөөрөгдөөгүй',
            'Энэ төхөөрөмжийг эхлээд хөгжүүлэгчээр зөвшөөрүүлсний дараа царайгаа бүртгүүлнэ үү.'
          );
          return;
        }
        if (locations.length > 0 && mode === 'remote') {
          Alert.alert(
            'Ажлын байршилд очно уу',
            'Аюулгүй байдлын үүднээс анхны царай бүртгэлийг зөвхөн зөвшөөрөгдсөн ажлын цэг дээр хийнэ.'
          );
          return;
        }
        setEnrolling(true);
        setPendingRemote(false);
        setRemoteReason('');
        setCameraVisible(true);
        return;
      }

      setEnrolling(false);

      // ЯВСАН бүртгэлийг ХААНААС Ч хийж болно.
      //
      // Ажилтан ажлаа дуусгаад талбараас, замаас, эсвэл өөр газраас явсанаа
      // тэмдэглэх шаардлага гарна. Байршлаар хаах нь бодит ажилд саад болно.
      // Оронд нь: байршлыг тэмдэглээд `pending` болгож админ баталгаажуулна.
      if (type === 'check_out' && mode !== 'onsite') {
        setPendingRemote(true);
        setRemoteReason('');
        setCameraVisible(true);
        return;
      }

      if (mode === 'onsite') {
        setPendingRemote(false);
        setRemoteReason('');
        setCameraVisible(true);
      } else {
        setPendingRemote(true);
        setRemoteReason('');
        setQuickFlow(false);
        setRemoteModal(true);
      }
    } catch (e) {
      setError(e.message);
      Alert.alert('Царай таних AI бэлэн болсонгүй', e.message);
    } finally {
      setFacePreparing(false);
    }
  };

  const submitRemote = async () => {
    setRemoteModal(false);
    if (quickFlow) {
      setBusy(true);
      try {
        await finalizeQuickAttendance(pendingType, capturedLoc, true, pendingDistance, capturedLoc?.locationName, remoteReason.trim());
      } catch (e) {
        Alert.alert('Алдаа', friendlyError(e));
      } finally {
        setBusy(false);
      }
    } else {
      setCameraVisible(true);
    }
  };

  /**
   * Царайгүй, шууд ирц бүртгэх (Map screen-ийн том "Ирлээ/Явлаа" товч).
   *
   * Хэрэглэгчийн тусгай хүсэлтээр: энэ товч дарахад selfie/царай таних
   * АЛГА, шууд бүртгэнэ. Байршил, төхөөрөмжийн баталгаажуулалт хэвээр
   * хамгаалалт болно; зөвхөн камерын алхмыг л алгасна.
   */
  const finalizeQuickAttendance = async (type, loc, isRemote, distance, locationName, reason = null) => {
    const dev = bypassDeviceApproval
      ? { verified: true, deviceId: null, reason: null }
      : await deviceApi.verifyDeviceForAttendance(profile.id);
    const status = isRemote || !dev.verified ? 'pending' : 'approved';
    const deviceNote = dev.verified ? null : `Төхөөрөмж баталгаажаагүй (${dev.reason})`;
    await attApi.insertAttendance({
      staffId: profile.id,
      staffName: profile.name,
      type,
      photoUrl: null,
      status,
      isRemote,
      distanceM: distance,
      note: [reason, deviceNote].filter(Boolean).join(' · ') || null,
      locationName: locationName || null,
      latitude: loc?.latitude,
      longitude: loc?.longitude,
    });
    await loadMyDay();
    await refreshShiftStatus();
    if (isRemote) {
      Alert.alert('Хүсэлт илгээгдлээ', 'Зайнаас бүртгүүлэх хүсэлт админд илгээгдлээ. Зөвшөөрөхийг хүлээнэ үү.');
    } else {
      // "Ирц бүртгэл амжилттай" гэсэн бичвэрийн оронд дуу хоолойгоор мэдэгдэнэ.
      if (type === 'check_in') playCheckInSound();
      else playCheckOutSound();
    }
  };

  const quickAttendance = async (type) => {
    if (facePreparing || busy) return;
    if (type === 'check_in' && shiftStatus.checkedIn) {
      Alert.alert('Аль хэдийн бүртгэгдсэн', 'Өнөөдөр та ирснээ бүртгүүлсэн байна.');
      return;
    }
    if (type === 'check_out') {
      if (!shiftStatus.checkedIn) {
        Alert.alert('Эхлээд ирснээ бүртгүүлнэ үү', 'Ирсэн бүртгэлгүйгээр явсан гэж бүртгэх боломжгүй.');
        return;
      }
      if (shiftStatus.checkedOut) {
        Alert.alert('Аль хэдийн бүртгэгдсэн', 'Өнөөдөр та явсанаа бүртгүүлсэн байна.');
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const loc = await getLocation();
      const { mode, distance, locationName } = evaluateLocation(loc);
      setPendingType(type);
      setPendingDistance(distance);
      setCapturedLoc({ ...loc, locationName });

      if (type === 'check_in' && mode !== 'onsite') {
        setPendingRemote(true);
        setRemoteReason('');
        setQuickFlow(true);
        setRemoteModal(true);
        return;
      }

      await finalizeQuickAttendance(type, loc, mode !== 'onsite', distance, locationName);
    } catch (e) {
      setError(e.message);
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  // Царай бүртгэх — эгц, хажуу, инээмсэглэл гэсэн 3 чанартай template.
  const handleEnrollCapture = async (photo) => {
    setBusy(true);
    setError(null);
    try {
      const pose = faceApi.getEnrollmentPose(enrollCount);
      const nativeFace = faceApi.isNativeFaceAvailable();
      if (nativeFace) {
        const template = await faceApi.extractFaceTemplate(photo.uri, faceDetector, {
          expectedPose: pose.key,
          existingTemplates: faceTemplates,
        });
        await faceApi.insertEnrollment({
          userId: profile.id,
          userName: profile.name,
          pose: pose.key,
          template,
        });
        const savedTemplate = {
          pose: pose.key,
          embedding: template.embedding,
          quality: template.quality,
          yaw: template.metrics.yaw,
          pitch: template.metrics.pitch,
          roll: template.metrics.roll,
          model_version: template.modelVersion,
        };
        const nextTemplates = [...faceTemplates.filter((item) => item.pose !== pose.key), savedTemplate];
        setFaceTemplates(nextTemplates);
      } else {
        // Өөрийн Edge Function-ийг эрхэмлэнэ — үнэгүй, зураг гадагш гарахгүй,
        // мөн утсан дээрхтэй ижил SFace тул embedding нь нийцнэ.
        if (faceEdge.isEdgeFaceAvailable) {
          await faceEdge.enrollPhoto({ uri: photo.uri, pose: pose.key });
        } else {
          await faceCloud.enrollPhoto({
            userId: profile.id,
            userName: profile.name,
            uri: photo.uri,
            pose: pose.key,
          });
        }
      }
      const next = enrollCount + 1;
      setEnrollCount(next);

      if (next < faceApi.ENROLL_TARGET) {
        // Камер нээлттэй хэвээр — дараагийн зураг
        return;
      }

      // 3 template бүрдсэн — бүртгэл дуусч, тухайн ирцийг мөн бүртгэнэ.
      if (nativeFace) await faceApi.setFaceEnrolled(profile.id);
      else if (faceEdge.isEdgeFaceAvailable) await faceEdge.setFaceEnrolled(profile.id);
      else await faceCloud.setFaceEnrolled(profile.id);
      setEnrolled(true);
      setEnrolling(false);
      const photoUrl = await attApi.uploadSelfie(photo.uri, profile.id);
      // Төхөөрөмжийг баталгаажуулна. Батлагдаагүй бол зөвшөөрөхийн оронд
      // админд шалгуулна — ингэснээр өөр утаснаас бүртгүүлэх нь илэрнэ.
      const dev = bypassDeviceApproval
        ? { verified: true, deviceId: null, reason: null }
        : await deviceApi.verifyDeviceForAttendance(profile.id);
      const status = pendingRemote || !dev.verified ? 'pending' : 'approved';
      const deviceNote = dev.verified ? null : `Төхөөрөмж баталгаажаагүй (${dev.reason})`;
      await attApi.insertAttendance({
        staffId: profile.id,
        staffName: profile.name,
        type: pendingType,
        photoUrl,
        status,
        isRemote: pendingRemote,
        distanceM: pendingDistance,
        note: [pendingRemote ? remoteReason.trim() : null, deviceNote].filter(Boolean).join(' · ') || null,
        locationName: capturedLoc?.locationName || null,
        latitude: capturedLoc?.latitude,
        longitude: capturedLoc?.longitude,
      });
      await loadRecords();
      await loadMyDay();
      await refreshShiftStatus();
      setCameraVisible(false);
      Alert.alert(
        'Царай бүртгэгдлээ',
        '3 чанартай template амжилттай үүслээ. Дараагийн ирцэд эгц зураг болон санамсаргүй хөдөлгөөнөөр баталгаажуулна.'
      );
    } catch (e) {
      setError(e.message);
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCapture = async (photo) => {
    // Царай бүртгэх горим бол тусад нь боловсруулна
    if (enrolling) return handleEnrollCapture(photo);

    setBusy(true);
    setError(null);
    try {
      const loc = capturedLoc || {};
      // Төхөөрөмжийг баталгаажуулна. Батлагдаагүй бол зөвшөөрөхийн оронд
      // админд шалгуулна — ингэснээр өөр утаснаас бүртгүүлэх нь илэрнэ.
      const dev = bypassDeviceApproval
        ? { verified: true, deviceId: null, reason: null }
        : await deviceApi.verifyDeviceForAttendance(profile.id);
      const faceOff = isCloud && faceBackendReady === false;
      // Царайгүй бүртгэл нь заавал админы хяналтад орно.
      const status =
        pendingRemote || !dev.verified || faceOff ? 'pending' : 'approved';
      const deviceNote = dev.verified ? null : `Төхөөрөмж баталгаажаагүй (${dev.reason})`;
      const faceNote = faceOff ? 'Царай танилтгүй — админ шалгана' : null;

      if (isCloud && faceOff) {
        // Царай таних боломжгүй: selfie + байршил + төхөөрөмжөөр бүртгэнэ.
        const photoUrl = await attApi.uploadSelfie(photo.uri, profile.id);
        await attApi.insertAttendance({
          staffId: profile.id,
          staffName: profile.name,
          type: pendingType,
          photoUrl,
          status,
          isRemote: pendingRemote,
          distanceM: pendingDistance,
          note: [pendingRemote ? remoteReason.trim() : null, deviceNote, faceNote]
            .filter(Boolean)
            .join(' · ') || null,
          locationName: capturedLoc?.locationName || null,
          latitude: loc?.latitude,
          longitude: loc?.longitude,
        });
        await loadRecords();
        await loadMyDay();
        await refreshShiftStatus();
        setCameraVisible(false);
        Alert.alert(
          'Ирц бүртгэгдлээ',
          'Царай таних энэ төхөөрөмж дээр ажиллахгүй байгаа тул админ зургийг харж баталгаажуулна.'
        );
        return;
      }

      if (isCloud) {
        // 1-р зураг: эгц танилт. 2-р зураг: санамсаргүй хөдөлгөөнөөр active liveness.
        const expectedPose = verificationStep === 0
          ? 'liveness_center'
          : livenessChallenge?.key;
        const nativeFace = faceApi.isNativeFaceAvailable();
        const vr = nativeFace
          ? await faceApi.verifyFace(photo.uri, faceTemplates, faceDetector, { expectedPose })
          : faceEdge.isEdgeFaceAvailable
            ? await faceEdge.verifyFace(photo.uri)
            : await faceCloud.verifyFace(photo.uri, profile.id);
        if (!vr.match) {
          const failure = describeFaceFailure(vr, profile.name);
          Alert.alert(failure.title, failure.message);
          return;
        }
        if (verificationStep === 0) {
          setLivenessChallenge(faceApi.createLivenessChallenge());
          setVerificationStep(1);
          return;
        }
        const photoUrl = await attApi.uploadSelfie(photo.uri, profile.id);
        await attApi.insertAttendance({
          staffId: profile.id,
          staffName: profile.name,
          type: pendingType,
          photoUrl,
          status,
          isRemote: pendingRemote,
          distanceM: pendingDistance,
          note: [pendingRemote ? remoteReason.trim() : null, deviceNote].filter(Boolean).join(' · ') || null,
          locationName: capturedLoc?.locationName || loc.locationName || null,
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        await loadRecords();
        await loadMyDay();
        await refreshShiftStatus();
        setVerificationStep(0);
        setLivenessChallenge(null);
      } else {
        setRecords((prev) => [
          {
            id: Date.now().toString(),
            staff_name: profile.name,
            type: pendingType,
            photo_url: photo.uri,
            created_at: new Date().toISOString(),
            status,
            is_remote: pendingRemote,
            ...loc,
          },
          ...prev,
        ]);
      }
      setCameraVisible(false);
      Alert.alert(
        pendingRemote ? 'Хүсэлт илгээгдлээ' : 'Амжилттай',
        pendingRemote
          ? 'Зайнаас бүртгүүлэх хүсэлт админд илгээгдлээ. Зөвшөөрөхийг хүлээнэ үү.'
          : `${pendingType === 'check_in' ? 'Ирсэн' : 'Явсан'} ирц бүртгэгдлээ.`
      );
    } catch (e) {
      setError(e.message);
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  // ---- Admin: хүсэлт зөвшөөрөх/татгалзах ----
  const decide = async (id, status) => {
    try {
      await attApi.setAttendanceStatus(id, status);
      await loadRecords();
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    }
  };

  // ---- Admin: одоогийн байршлыг бүртгэлийн цэг болгох ----
  const saveLocation = async () => {
    if (!locForm.name.trim()) {
      Alert.alert('Нэр оруулна уу', 'Байршлын нэрийг бичнэ үү.');
      return;
    }
    const loc = await getLocation();
    if (loc.latitude == null) {
      Alert.alert('Байршил алга', 'GPS байршил авч чадсангүй.');
      return;
    }
    try {
      await attApi.insertAttendanceLocation({
        name: locForm.name.trim(),
        latitude: loc.latitude,
        longitude: loc.longitude,
        radius_m: Number(locForm.radius) || 200,
      });
      setLocModal(false);
      setLocForm({ name: '', radius: '200'});
      await loadLocations();
      Alert.alert('Хадгаллаа', 'Бүртгэлийн байршил нэмэгдлээ.');
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    }
  };

  const saveBreakSchedule = async () => {
    if (!isAdmin) return;
    const worker = employees.find((s) => s.id === breakForm.userId);
    if (!breakForm.userId || !worker) {
      Alert.alert('Ажилтан', 'Ажилтан сонгоно уу');
      return;
    }
    try {
      await shiftApi.saveRestDays({
        userId: breakForm.userId,
        userName: worker.name,
        restDays,
        createdBy: profile?.id,
      });
      setBreakModal(false);
      await loadBreakSchedules();
      Alert.alert('Амжилттай', `${worker.name}-ийн амралтын өдөр хадгалагдлаа.`);
    } catch (e) {
      const msg = shiftApi.isShiftTableMissing(e) ? shiftApi.MIGRATION_HINT : e.message;
      Alert.alert('Алдаа', msg);
    }
  };

  const saveShift = async () => {
    const worker = employees.find((s) => s.id === shiftForm.userId);
    if (!shiftForm.userId || !worker) {
      Alert.alert('Ажилтан', 'Ажилтан сонгоно уу');
      return;
    }
    try {
      await shiftApi.upsertShift({
        userId: shiftForm.userId,
        userName: worker.name,
        shiftDate: shiftForm.shiftDate,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        locationId: shiftForm.locationId || null,
        note: shiftForm.note.trim(),
        createdBy: profile?.id,
      });
      setShiftModal(false);
      await loadTodayShifts();
      Alert.alert('Хадгаллаа', 'Хуваарь оноогдлоо');
    } catch (e) {
      const msg = shiftApi.isShiftTableMissing(e) ? shiftApi.MIGRATION_HINT : e.message;
      Alert.alert('Алдаа', msg);
    }
  };

  const removeLocation = (id, name) => {
    Alert.alert('Устгах', `${name} байршлыг устгах уу?`, [
      { text: 'Болих', style: 'cancel'},
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          await attApi.deleteAttendanceLocation(id);
          await loadLocations();
        },
      },
    ]);
  };

  const resetMyFace = () => {
    Alert.alert(
      'Царай дахин бүртгэх',
      'Одоогийн царайны template-ууд устаж, дараагийн ирц дээр шинээр 3 зураг авна. Үргэлжлүүлэх үү?',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Дахин бүртгэх',
          style: 'destructive',
          onPress: async () => {
            try {
              await faceApi.resetFaceEnrollment(profile.id);
              setFaceTemplates([]);
              setEnrollCount(0);
              setEnrolled(false);
              Alert.alert('Бэлэн', 'Дараагийн ирц дээр царайгаа шинээр бүртгүүлнэ үү.');
            } catch (e) {
              Alert.alert('Алдаа', friendlyError(e));
            }
          },
        },
      ]
    );
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ProfileSetup title="Ирц бүртгэх"/>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    // Ажлын байрны цэг: миний хуваарьт онооcон байршил байвал түүнийг,
    // үгүй бол хамгийн ойрхон тохируулсан цэгийг харуулна.
    const shiftLocation = myShift?.location_id
      ? locations.find((l) => l.id === myShift.location_id)
      : null;
    const nearest = attApi.nearestAttendanceLocation(liveLocation || {}, locations);
    const workplace = shiftLocation || nearest.location || locations[0] || null;

    let geofenceStatus = null;
    if (locations.length > 0 && liveLocation?.latitude != null) {
      geofenceStatus = nearest.within ? 'inside' : 'outside';
    }

    // Товчийг ХААХ нь зөвхөн "аль хэдийн бүртгүүлсэн" тохиолдолд.
    //
    // ⚠️ Байршил хараахан ирээгүй (`geofenceStatus === null`) байхад товчийг
    // хаах нь БУРУУ байсан: `quickAttendance()` өөрөө шинээр `getLocation()`
    // дуудаж, бүсээс гадуур бол хүсэлтийн цонх гаргадаг. Тиймээс GPS
    // хүлээж байхад ч дарж болно — эс бөгөөс апп нээгээд эхний хэдэн
    // секундэд товч ямар ч шалтгаангүй унтарсан харагдана.
    const canCheckIn = !shiftStatus.checkedIn;
    const canCheckOut = shiftStatus.checkedIn && !shiftStatus.checkedOut;
    const actionMode = shiftStatus.checkedIn && !shiftStatus.checkedOut ? 'check_out' : 'check_in';
    const actionEnabled = actionMode === 'check_in' ? canCheckIn : canCheckOut;

    const scheduleLabel = todayIsRest
      ? 'Хуваарьгүй · Амралт'
      : myShift
        ? `${myShift.start_time} – ${myShift.end_time}`
        : 'Хуваарьгүй';
    const weekdayLabels = ['Ням', 'Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям'];
    const dateLabel = `${dayKey()}(${weekdayLabels[new Date().getDay()]})`;

    return (
      <View style={{ flex: 1, backgroundColor: employeeColors.background }}>
        <EmployeeAttendanceMap
          mapRef={mapRef}
          employeeLocation={liveLocation}
          workplace={workplace}
          locations={locations}
          profileUri={profile?.avatar_url}
          profileName={profile?.name}
        />

        {/* ⚠️ Header нь MapView-ийн ДЭЭР байх ёстой.
            MapView бол NATIVE view бөгөөд Android дээр өөрөө бүх touch-ыг
            барьж авдаг тул `zIndex` + `elevation` ЗААВАЛ хэрэгтэй — эс
            бөгөөс товчнууд харагдах ч дарагдахгүй.
            `pointerEvents="box-none"` нь зөвхөн жинхэнэ товчнууд touch авч,
            бусад хэсгээр map-ыг чирэх боломжтой байлгана. */}
        <View
          style={[styles.mapTopBar, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <View style={[styles.headerCard, { backgroundColor: employeeColors.surface }]}>
            <ChatAvatar name={profile?.name} uri={profile?.avatar_url} size={46} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{ color: employeeColors.text, fontWeight: '800', fontSize: 16 }}
                numberOfLines={1}
              >
                {profile?.name}
              </Text>
              <Text style={{ color: employeeColors.textMuted, fontSize: 12, marginTop: 1 }}>
                ЖЕННЕТЕКС ХХК
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.headerBtn,
                { backgroundColor: employeeColors.surfaceAlt },
                pressed && { opacity: 0.6, transform: [{ scale: 0.96 }] },
              ]}
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Мэдэгдэл"
            >
              <Ionicons name="notifications-outline" size={21} color={employeeColors.text} />
              {unreadCount > 0 ? (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.headerBtn,
                { backgroundColor: employeeColors.surfaceAlt, marginLeft: 10 },
                pressed && { opacity: 0.6, transform: [{ scale: 0.96 }] },
              ]}
              onPress={() => navigation.navigate('MyShift')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Хуваарь, тохиргоо"
            >
              <Ionicons name="settings-outline" size={21} color={employeeColors.text} />
            </Pressable>
          </View>

          {locationPermission === 'denied' ? (
            <View style={[styles.permBanner, { backgroundColor: employeeColors.surface }]}>
              <Text style={{ color: employeeColors.danger, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                Ирц бүртгэхийн тулд байршлын зөвшөөрөл шаардлагатай
              </Text>
              <TouchableOpacity
                style={[styles.permBtn, { backgroundColor: employeeColors.primary }]}
                onPress={() => Linking.openSettings()}
              >
                <Text style={{ color: employeeColors.onPrimary, fontWeight: '700', fontSize: 13 }}>
                  Тохиргоо нээх
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <GeofenceStatusBanner
              status={geofenceStatus}
              colors={employeeColors}
              style={{ marginTop: 10, alignSelf: 'center' }}
            />
          )}
        </View>

        <View style={styles.mapControls} pointerEvents="box-none">
          <MapControlButton
            icon="navigate"
            colors={employeeColors}
            accessibilityLabel="Миний байршил руу төвлөрөх"
            onPress={() =>
              liveLocation?.latitude != null &&
              mapRef.current?.animateToRegion(
                { ...liveLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 },
                400
              )
            }
          />
          <MapControlButton
            icon="business"
            colors={employeeColors}
            accessibilityLabel="Ажлын байршил руу төвлөрөх"
            onPress={() =>
              workplace?.latitude != null &&
              mapRef.current?.animateToRegion(
                { latitude: workplace.latitude, longitude: workplace.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
                400
              )
            }
          />
          <MapControlButton
            icon="time-outline"
            colors={employeeColors}
            accessibilityLabel="Өдрийн түүх"
            onPress={() => navigation.navigate('AttendanceHistory')}
          />
        </View>

        <View style={styles.actionBtnWrap} pointerEvents="box-none">
          <AttendanceActionButton
            mode={actionMode}
            enabled={actionEnabled}
            loading={busy}
            colors={employeeColors}
            onPress={() => quickAttendance(actionMode)}
          />
        </View>

        <AttendanceBottomPanel
          colors={employeeColors}
          dateLabel={dateLabel}
          scheduleLabel={scheduleLabel}
          locations={locations}
          activeLocationId={workplace?.id}
          onPressLocation={(l) =>
            mapRef.current?.animateToRegion(
              {
                latitude: Number(l.latitude),
                longitude: Number(l.longitude),
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              },
              400
            )
          }
          onPressSummary={() => navigation.navigate('AttendanceMonthlySummary')}
          onPressRequest={() => navigation.navigate('AttendanceRequestForm')}
        />

        <SelfieCamera
          visible={cameraVisible}
          busy={busy}
          auto
          autoDelayMs={enrolling ? 1200 : 2000}
          progressText={
            enrolling
              ? `Царай бүртгэж байна: ${enrollCount}/${faceApi.ENROLL_TARGET}`
              : verificationStep === 1
              ? 'Амьд хөдөлгөөн шалгаж байна: 2/2'
              : 'Царай таньж байна: 1/2'
          }
          hint={
            enrolling
              ? faceApi.getEnrollmentPose(enrollCount).label
              : verificationStep === 1
              ? livenessChallenge?.label
              : 'Камер руу эгц харна уу'
          }
          onClose={() => {
            setCameraVisible(false);
            setEnrolling(false);
            setVerificationStep(0);
            setLivenessChallenge(null);
          }}
          onCapture={handleCapture}
          profileUri={profile?.avatar_url || null}
          profileName={profile?.name || null}
        />

        <Modal visible={remoteModal} transparent animationType="fade">
          <View style={styles.warnOverlay}>
            <View style={[styles.warnModal, { backgroundColor: employeeColors.surface }]}>
              <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>⚠️</Text>
              <Text style={[styles.warnTitle, { color: employeeColors.text }]}>Анхааруулга</Text>
              <Text style={[styles.warnMessage, { color: employeeColors.textMuted }]}>
                Та цаг бүртгэх байршилд ороогүй байна
                {pendingDistance != null ? ` (~${pendingDistance}м зайд)` : ''}.{'\n'}
                Шалтгаанаа бичээд хүсэлт илгээнэ үү.
              </Text>
              <Field
                placeholder="Шалтгаан бичнэ үү"
                value={remoteReason}
                onChangeText={setRemoteReason}
              />
              <View style={styles.btnRow}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setRemoteModal(false)} />
                <Button title="Хүсэлт илгээх" style={{ flex: 1 }} onPress={submitRemote} />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ---- Админы өөрийн ирцийн товч үзүүлэлтүүд ----
  const fmtHM = (iso) =>
    iso ? new Date(iso).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  /** Хуваарийн нийт минут (эхлэх→дуусах). Хуваарьгүй бол 8 цаг. */
  const shiftMinutes = (s) => {
    if (!s?.start_time || !s?.end_time) return 480;
    const [sh, sm] = String(s.start_time).split(':').map(Number);
    const [eh, em] = String(s.end_time).split(':').map(Number);
    return Math.max(60, eh * 60 + em - (sh * 60 + sm));
  };

  const myWorkedMinutes = (() => {
    if (!shiftStatus.checkInAt) return 0;
    const end = shiftStatus.checkOutAt ? new Date(shiftStatus.checkOutAt) : new Date();
    return Math.max(0, Math.round((end - new Date(shiftStatus.checkInAt)) / 60000));
  })();

  const myStatus = shiftStatus.checkedOut
    ? { label: 'Ажил дууссан', icon: 'checkmark-circle', bg: 'rgba(63,207,142,0.16)', fg: '#3fcf8e' }
    : shiftStatus.checkedIn
      ? { label: 'Ажил дээр', icon: 'ellipse', bg: 'rgba(0,153,219,0.16)', fg: adminColors.primary }
      : { label: 'Бүртгүүлээгүй', icon: 'alert-circle-outline', bg: 'rgba(245,181,68,0.16)', fg: '#f5b544' };

  // Админы ӨӨРИЙНХ нь одоогийн байршил — бусад ажилтны байршлыг энд ХАРУУЛАХГҮЙ.
  const adminNearest = attApi.nearestAttendanceLocation(liveLocation || {}, locations);
  const adminLocationLabel =
    liveLocation?.latitude == null
      ? 'Байршил тодорхойгүй байна'
      : locations.length === 0
        ? 'Байршил тохируулаагүй байна'
        : adminNearest.within
          ? `Таны байршил: ${adminNearest.name} цэгийн ойролцоо`
          : `Таны байршил: ${adminNearest.name || 'бүртгэлтэй цэг'}-ээс ~${adminNearest.distance}м зайд`;

  // ---- Admin dark dashboard header (dashboard-only, dashFilters/dayRows-той) ----
  const adminHeader = (
    <View>
      <View style={dashStyles.topRow}>
        <ChatAvatar name={profile?.name} uri={profile?.avatar_url} size={48} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={{ color: adminColors.text, fontSize: 19, fontWeight: '800' }} numberOfLines={1}>
            {profile?.name}
          </Text>
          <Text style={{ color: adminColors.textMuted, fontSize: 12, marginTop: 1 }}>ЖЕННЕТЕКС ХХК</Text>
        </View>
        <TouchableOpacity
          style={[dashStyles.bellBtn, { backgroundColor: adminColors.surfaceContainer, marginRight: 8 }]}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="Мэдэгдэл"
        >
          <Ionicons name="notifications-outline" size={19} color={adminColors.text} />
          {pending.length > 0 ? (
            <View style={dashStyles.badgeDot}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{pending.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[dashStyles.bellBtn, { backgroundColor: adminColors.surfaceContainer }]}
          onPress={() => navigation.navigate('AttendanceSettings')}
          accessibilityLabel="Ирцийн тохиргоо"
        >
          <Ionicons name="settings-outline" size={19} color={adminColors.text} />
        </TouchableOpacity>
      </View>

      {/* ── МИНИЙ ИРЦ ─────────────────────────────────────────────────
          Админ ч ажилтан адил ирцээ бүртгүүлнэ. Ажилтны талтай ИЖИЛ
          `quickAttendance` урсгалыг ашиглана — царай таниулахгүй, шууд
          бүртгэнэ (байршил + төхөөрөмжийн шалгалт хэвээр). */}
      <View style={[dashStyles.heroCard, { backgroundColor: adminColors.surfaceContainer }]}>
        <View style={dashStyles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: adminColors.textMuted, fontSize: 12 }}>Өнөөдрийн ирц</Text>
            <Text style={{ color: adminColors.text, fontSize: 30, fontWeight: '800', marginTop: 2 }}>
              {shiftStatus.checkedOut
                ? fmtHM(shiftStatus.checkOutAt)
                : shiftStatus.checkedIn
                  ? fmtHM(shiftStatus.checkInAt)
                  : '--:--'}
            </Text>
            <View style={[dashStyles.statusChip, { backgroundColor: myStatus.bg }]}>
              <Ionicons name={myStatus.icon} size={14} color={myStatus.fg} />
              <Text style={{ color: myStatus.fg, fontSize: 13, fontWeight: '700' }}>
                {myStatus.label}
              </Text>
            </View>
          </View>
          <WorkHoursRing
            workedMinutes={myWorkedMinutes}
            targetMinutes={myShift ? shiftMinutes(myShift) : 480}
            colors={adminColors}
          />
        </View>

        {/* Ирсэн / Явсан хоёр багана */}
        <View style={dashStyles.inOutRow}>
          <View style={dashStyles.inOutCell}>
            <View style={[dashStyles.inOutIcon, { borderColor: adminColors.primary }]}>
              <Ionicons name="arrow-forward" size={15} color={adminColors.primary} />
            </View>
            <View>
              <Text style={{ color: adminColors.textMuted, fontSize: 12 }}>Ирсэн</Text>
              <Text style={{ color: adminColors.text, fontSize: 17, fontWeight: '800' }}>
                {fmtHM(shiftStatus.checkInAt)}
              </Text>
            </View>
          </View>
          <View style={[dashStyles.inOutDivider, { backgroundColor: adminColors.outlineVariant }]} />
          <View style={dashStyles.inOutCell}>
            <View style={[dashStyles.inOutIcon, { borderColor: adminColors.primary }]}>
              <Ionicons name="arrow-forward" size={15} color={adminColors.primary} />
            </View>
            <View>
              <Text style={{ color: adminColors.textMuted, fontSize: 12 }}>Явсан</Text>
              <Text style={{ color: adminColors.text, fontSize: 17, fontWeight: '800' }}>
                {fmtHM(shiftStatus.checkOutAt)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
          <Ionicons name="location-outline" size={14} color={adminColors.textFaint} />
          <Text style={{ color: adminColors.textFaint, fontSize: 12, flex: 1 }} numberOfLines={1}>
            {adminLocationLabel}
          </Text>
        </View>

        {/* Ирлээ / Явлаа */}
        {!shiftStatus.checkedOut ? (
          <View style={dashStyles.heroBtnRow}>
            {!shiftStatus.checkedIn ? (
              <TouchableOpacity
                style={[dashStyles.heroBtn, { backgroundColor: adminColors.primary, opacity: busy ? 0.55 : 1 }]}
                disabled={busy}
                onPress={() => quickAttendance('check_in')}
                activeOpacity={0.85}
              >
                <Text style={{ color: adminColors.onPrimary, fontWeight: '800', fontSize: 15 }}>Ирлээ</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[dashStyles.heroBtn, { backgroundColor: '#ff6b60', opacity: busy ? 0.55 : 1 }]}
                disabled={busy}
                onPress={() => quickAttendance('check_out')}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Явлаа</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      {/* Хурдан холбоос — доод хөвөгч цэсийг орлоно */}
      <View style={dashStyles.quickRow}>
        {[
          { icon: 'paper-plane-outline', label: 'Хүсэлт', to: 'AttendanceRequests', badge: pending.length },
          { icon: 'people-outline', label: 'Ажилтан', to: 'Employees' },
          { icon: 'map-outline', label: 'Байршил', to: 'AttendanceLocationSubmissions' },
        ].map((q) => (
          <TouchableOpacity
            key={q.to}
            style={[dashStyles.quickBtn, { backgroundColor: adminColors.surfaceContainer }]}
            onPress={() => navigation.navigate(q.to)}
            activeOpacity={0.8}
          >
            <Ionicons name={q.icon} size={19} color={adminColors.primary} />
            <Text style={{ color: adminColors.text, fontSize: 12, fontWeight: '600', marginTop: 5 }}>
              {q.label}
            </Text>
            {q.badge > 0 ? (
              <View style={dashStyles.quickBadge}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{q.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SummaryStatCards
          items={dayStatCards}
          colors={adminColors}
          activeKey={dashFilters.status}
          onSelect={(key) => setDashFilters((f) => ({ ...f, status: key }))}
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <DateRangeFilterBar
          fromLabel={dashboardDate}
          colors={adminColors}
          onChangeDate={setDashboardDate}
          onPressCalendar={() => setDateSheetVisible(true)}
          onPressFilter={() => setFilterSheetVisible(true)}
        />
      </View>

      {migrationHint ? (
        <Card style={{ marginTop: spacing.sm, borderColor: colors.warning, borderWidth: 1 }}>
          <Text style={styles.note}>{migrationHint}</Text>
        </Card>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isCloud ? (
        <Text style={styles.note}> Supabase холбогдоогүй тул ирц зөвхөн энэ утсанд хадгалагдана.</Text>
      ) : null}

      {/* Зайнаас бүртгүүлэх хүсэлтүүд */}
      {pending.length > 0 ? (
        <View>
          <SectionTitle style={{ marginTop: spacing.md, color: adminColors.text }}>
             Зайнаас бүртгүүлэх хүсэлт ({pending.length})
          </SectionTitle>
          {pending.map((item) => (
            <Card key={item.id} style={[styles.pendCard, { backgroundColor: adminColors.surfaceContainer }]}>
              <View style={styles.recordRow}>
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Text style={{ fontSize: 22 }}></Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recordName, { color: adminColors.text }]}>{item.staff_name}</Text>
                  <Text style={[styles.recordDate, { color: adminColors.textMuted }]}>
                    {item.type === 'check_in' ? 'Ирсэн' : 'Явсан'} ·{' '}
                    {new Date(item.created_at).toLocaleString('mn-MN')}
                  </Text>
                  {item.distance_m != null ? (
                    <Text style={[styles.recordDate, { color: adminColors.textMuted }]}> Цэгээс ~{item.distance_m}м зайд</Text>
                  ) : null}
                  {item.note ? <Text style={styles.noteText}>{item.note}</Text> : null}
                </View>
              </View>
              <View style={styles.btnRow}>
                <Button title="Зөвшөөрөх" variant="success" size="sm" style={{ flex: 1 }} onPress={() => decide(item.id, 'approved')} />
                <Button title="Татгалзах" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => decide(item.id, 'rejected')} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {/* ── Удирдлагын картууд (загварын дагуу: өнгөт дугуй icon + outline товч) ── */}
      <AdminSectionCard
        colors={adminColors}
        icon="calendar"
        iconBg="rgba(0,153,219,0.16)"
        iconFg="#2f9fe0"
        title="Ажилтны хуваарь"
        subtitle={todayShifts.length === 0 ? 'Өнөөдрийн хуваарь алга.' : `${todayShifts.length} ажилтанд хуваарьтай`}
        actionLabel="Хуваарь оноох"
        onAction={() => setShiftModal(true)}
        style={{ marginTop: spacing.md }}
      >
        {todayShifts.map((s) => (
          <View key={s.id} style={dashStyles.itemRow}>
            <View style={[dashStyles.itemDot, { backgroundColor: adminColors.primary }]} />
            <Text style={[dashStyles.itemName, { color: adminColors.text }]} numberOfLines={1}>
              {s.user_name}
            </Text>
            <Text style={{ color: adminColors.textMuted, fontSize: 13 }}>
              {s.start_time}–{s.end_time}
            </Text>
          </View>
        ))}
      </AdminSectionCard>

      <AdminSectionCard
        colors={adminColors}
        icon="bed"
        iconBg="rgba(155,109,255,0.16)"
        iconFg="#9b6dff"
        title="Амралтын өдөр"
        subtitle={
          Object.keys(breakSchedulesByUser).length === 0
            ? 'Даваа–Ням гаригт амралтын өдөр тохируулаагүй.'
            : `${Object.keys(breakSchedulesByUser).length} ажилтанд тохируулсан`
        }
        actionLabel="Өдөр сонгох"
        onAction={openBreakModal}
      >
        {Object.values(breakSchedulesByUser).map((item) => (
          <View key={item.user_id} style={dashStyles.itemRow}>
            <View style={[dashStyles.itemDot, { backgroundColor: '#9b6dff' }]} />
            <Text style={[dashStyles.itemName, { color: adminColors.text }]} numberOfLines={1}>
              {item.user_name}
            </Text>
            <Text style={{ color: adminColors.textMuted, fontSize: 13 }}>
              {item.days.map((d) => weekdayLabel(d)).join(', ')}
            </Text>
          </View>
        ))}
      </AdminSectionCard>

      <AdminSectionCard
        colors={adminColors}
        icon="location"
        iconBg="rgba(0,153,219,0.16)"
        iconFg="#2f9fe0"
        title="Бүртгэлийн байршил"
        subtitle={locations.length === 0 ? 'Байршил тохируулаагүй бол хаанаас ч бүртгэнэ.' : null}
        actionLabel="Байршил нэмэх"
        onAction={() => setLocModal(true)}
        footer={locations.length > 0 ? 'Бүртгэл хийх боломжтой цэгүүд' : null}
      >
        {locations.map((l) => (
          <View key={l.id} style={dashStyles.itemRow}>
            <View style={[dashStyles.itemDot, { backgroundColor: adminColors.primary }]} />
            <Text style={[dashStyles.itemName, { color: adminColors.text }]} numberOfLines={1}>
              {l.name}
            </Text>
            <Text style={{ color: adminColors.textMuted, fontSize: 13, marginRight: 12 }}>{l.radius_m}м</Text>
            <TouchableOpacity onPress={() => removeLocation(l.id, l.name)} hitSlop={10}>
              <Ionicons name="trash-outline" size={17} color="#ff6b60" />
            </TouchableOpacity>
          </View>
        ))}
      </AdminSectionCard>

      {dayRowsError ? (
        <View style={[dashStyles.errorBox, { backgroundColor: 'rgba(255,107,96,0.12)' }]}>
          <Text style={{ color: '#ff6b60', fontSize: 12, lineHeight: 17 }}>{dayRowsError}</Text>
        </View>
      ) : null}

      <View style={dashStyles.listHeadRow}>
        <Text style={{ color: adminColors.text, fontSize: 15, fontWeight: '800' }}>
          Өнөөдөр   {dashboardDate}
        </Text>
        <Text style={{ color: adminColors.textMuted, fontSize: 12 }}>
          {dayRowsLoading ? 'ачаалж байна…' : `${filteredDayRows.length} ажилтан`}
        </Text>
      </View>
      <View style={dashStyles.tableHeadRow}>
        <Text style={[dashStyles.tableHeadCell, { flex: 2, color: adminColors.textMuted }]}>Ажилтан</Text>
        <Text style={[dashStyles.tableHeadCell, { color: adminColors.textMuted }]}>Ирсэн</Text>
        <Text style={[dashStyles.tableHeadCell, { color: adminColors.textMuted }]}>Явсан</Text>
        <Text style={[dashStyles.tableHeadCell, { color: adminColors.textMuted }]}>Хоц/Эрт</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: adminColors.background }}>
      <FlatList
        data={filteredDayRows}
        keyExtractor={(r) => r.employee_id}
        ListHeaderComponent={adminHeader}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={dayRowsLoading}
            onRefresh={() => {
              loadDayRows();
              loadRecords();
            }}
            tintColor={adminColors.primary}
          />
        }
        ListEmptyComponent={!dayRowsLoading ? <EmptyState text="Ирцийн бүртгэл олдсонгүй" /> : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[dashStyles.tableRow, { backgroundColor: adminColors.surfaceContainer }]}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate('AttendanceDetail', {
                employeeId: item.employee_id,
                employeeName: item.employee_name,
                avatarUrl: item.avatar_url,
                date: dashboardDate,
                row: item,
              })
            }
          >
            {/* Зүүн ирмэг дээрх өнгөт зурвас — төлөвийг нэг харцаар таниулна */}
            <View
              style={[
                dashStyles.statusStripe,
                {
                  backgroundColor:
                    item.status === 'late'
                      ? '#ff6b60'
                      : item.status === 'absent'
                        ? '#5c5c64'
                        : item.status === 'leave' || item.status === 'rest'
                          ? '#8fd3f2'
                          : item.check_in_at
                            ? '#3fcf8e'
                            : 'transparent',
                },
              ]}
            />
            <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ChatAvatar name={item.employee_name} uri={item.avatar_url} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminColors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                  {item.employee_name}
                </Text>
                {item.is_remote ? (
                  <Text style={{ color: adminColors.primary, fontSize: 10, marginTop: 1 }}>Зайнаас</Text>
                ) : null}
              </View>
            </View>
            <Text style={{ flex: 1, color: adminColors.text, fontSize: 13 }}>
              {item.check_in_at ? new Date(item.check_in_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </Text>
            <Text style={{ flex: 1, color: adminColors.text, fontSize: 13 }}>
              {item.check_out_at ? new Date(item.check_out_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </Text>
            <Text
              style={{
                flex: 1,
                color: item.late_minutes > 0 ? '#ff6b60' : adminColors.textMuted,
                fontSize: 13,
                fontWeight: item.late_minutes > 0 ? '700' : '400',
              }}
            >
              {item.late_minutes > 0 ? `${item.late_minutes}м` : item.early_leave_minutes > 0 ? `-${item.early_leave_minutes}м` : '--'}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ⚠️ Доод хөвөгч дэд цэсийг АРИЛГАВ: аппын үндсэн Tab.Navigator мөн
          доод талд байдаг тул хоёулаа давхцаж, дарагдаж болдоггүй байв.
          Хүсэлт/Ажилтан руу орох замыг header доторх хурдан товчоор
          гаргасан (adminHeader доторх quickRow). */}

      <DateRangeSheet
        visible={dateSheetVisible}
        current={dashboardDate}
        colors={adminColors}
        onClose={() => setDateSheetVisible(false)}
        onSelect={(d) => setDashboardDate(d)}
      />

      <AttendanceFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        onApply={(f) => {
          setDashFilters(f);
          setFilterSheetVisible(false);
        }}
        departments={departments}
        locations={locations}
        colors={adminColors}
        initial={dashFilters}
      />
      <SelfieCamera
        visible={cameraVisible}
        busy={busy}
        auto
        autoDelayMs={enrolling ? 1200 : 2000}
        progressText={
          enrolling
            ? `Царай бүртгэж байна: ${enrollCount}/${faceApi.ENROLL_TARGET}`
            : verificationStep === 1
            ? 'Амьд хөдөлгөөн шалгаж байна: 2/2'
            : 'Царай таньж байна: 1/2'
        }
        hint={
          enrolling
            ? faceApi.getEnrollmentPose(enrollCount).label
            : verificationStep === 1
            ? livenessChallenge?.label
            : 'Камер руу эгц харна уу'
        }
        onClose={() => {
          setCameraVisible(false);
          setEnrolling(false);
          setVerificationStep(0);
          setLivenessChallenge(null);
        }}
        onCapture={handleCapture}
        profileUri={profile?.avatar_url || null}
        profileName={profile?.name || null}
      />

      {/* Зайнаас бүртгүүлэх хүсэлт */}
      <Modal visible={remoteModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: adminColors.surface }]}>
            <View style={styles.handle} />
            <Text style={[styles.sheetTitle, { color: adminColors.text }]}> Зайнаас бүртгүүлэх</Text>
            <Text style={[styles.sheetSub, { color: adminColors.textMuted }]}>
              Та бүртгэлтэй байршлаас
              {pendingDistance != null ? ` ~${pendingDistance}м` : ''} гадуур байна. Шалтгаанаа бичээд selfie
              авснаар админд хүсэлт илгээгдэнэ.
            </Text>
            <Field
              label="Шалтгаан"
              placeholder="Ж: Талбай дээр ажиллаж байна"
              value={remoteReason}
              onChangeText={setRemoteReason}
            />
            <View style={styles.btnRow}>
              <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setRemoteModal(false)} />
              <Button title="Үргэлжлүүлэх" style={{ flex: 1 }} onPress={submitRemote} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Админ: байршил нэмэх */}
      <Modal visible={locModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: adminColors.surface }]}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, { color: adminColors.text }]}> Бүртгэлийн байршил нэмэх</Text>
              <Text style={[styles.sheetSub, { color: adminColors.textMuted }]}>Таны одоо байгаа GPS цэгийг хадгална.</Text>
              <Field
                label="Нэр"
                placeholder="Ж: Төв оффис"
                value={locForm.name}
                onChangeText={(t) => setLocForm({ ...locForm, name: t })}
              />
              <Field
                label="Радиус (метр)"
                placeholder="200"
                keyboardType="numeric"
                value={locForm.radius}
                onChangeText={(t) => setLocForm({ ...locForm, radius: t })}
              />
              <View style={styles.btnRow}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setLocModal(false)} />
                <Button title="Хадгалах" style={{ flex: 1 }} onPress={saveLocation} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ажилласан цагийн дэлгэрэнгүй */}
      <Modal visible={hoursModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: adminColors.surface }]}>
            <Text style={[styles.sheetTitle, { color: adminColors.text }]}>Нийт ажилласан цаг</Text>
            <Text style={[styles.sheetSub, { color: adminColors.textMuted }]}>{dayKey()} · {profile?.name}</Text>
            {todayIsRest ? (
              <Text style={styles.restBadge}> Өнөөдөр амралтын өдөр</Text>
            ) : null}
            {workSummary.pairs.length === 0 ? (
              <Text style={styles.privacyText}>Өнөөдөр ирц бүртгэгдээгүй.</Text>
            ) : (
              workSummary.pairs.map((p, i) => (
                <View key={i} style={styles.hoursRow}>
                  <Text style={styles.hoursRowText}>
                    {new Date(p.checkIn.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit'})}
                    {' – '}
                    {new Date(p.checkOut.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit'})}
                  </Text>
                  <Text style={styles.hoursRowDur}>{formatDuration(p.ms)}</Text>
                </View>
              ))
            )}
            <View style={styles.hoursTotalBox}>
              <Text style={styles.hoursTotalLine}>Нийт: {formatDuration(workSummary.grossMs)}</Text>
              <Text style={styles.hoursTotalNet}>
                {todayIsRest ? 'Амралтын өдөр' : `Цэвэр: ${formatDuration(workSummary.netMs)}`}
              </Text>
            </View>
            <Button title="Хаах" onPress={() => setHoursModal(false)} />
          </View>
        </View>
      </Modal>

      {/* Админ: амралтын өдөр */}
      {isAdmin ? (
      <Modal visible={breakModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: adminColors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, { color: adminColors.text }]}> Амралтын өдөр</Text>
              <Text style={[styles.sheetSub, { color: adminColors.textMuted }]}>
                Даваа гарагаас Ням гариг хүртэл аль өдөр амралттайг сонгоно.
              </Text>
              <Text style={styles.fieldLabel}>Ажилтан</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {employees.filter((w) => w.role !== 'admin').map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.chip, breakForm.userId === w.id && styles.chipOn]}
                    onPress={() => pickEmployeeForBreak(w.id)}
                  >
                    <Text style={[styles.chipText, breakForm.userId === w.id && styles.chipTextOn]}>{w.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {WEEKDAYS.map((day) => {
                const slot = restDays.find((s) => s.day_of_week === day.day);
                const on = slot?.is_rest;
                return (
                  <TouchableOpacity
                    key={day.day}
                    style={[styles.restRow, on && styles.restRowOn]}
                    onPress={() => toggleRestDay(day.day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.restDayLabel, on && styles.restDayLabelOn]}>{day.label}</Text>
                    <Text style={[styles.restStatus, on && styles.restStatusOn]}>
                      {on ? 'Амралт' : 'Ажиллана'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.btnRow}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setBreakModal(false)} />
                <Button title="Хадгалах" style={{ flex: 1 }} onPress={saveBreakSchedule} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      ) : null}

      {/* Админ: хуваарь оноох */}
      <Modal visible={shiftModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: adminColors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, { color: adminColors.text }]}> Хуваарь оноох</Text>
              <Text style={[styles.sheetSub, { color: adminColors.textMuted }]}>Ажилтанд өдрийн эхлэх/дуусах цаг болон байршил онооно.</Text>
              <Field
                label="Огноо (YYYY-MM-DD)"
                value={shiftForm.shiftDate}
                onChangeText={(t) => setShiftForm({ ...shiftForm, shiftDate: t })}
              />
              <Text style={styles.fieldLabel}>Ажилтан</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {employees.filter((w) => w.role !== 'admin').map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.chip, shiftForm.userId === w.id && styles.chipOn]}
                    onPress={() => setShiftForm({ ...shiftForm, userId: w.id })}
                  >
                    <Text style={[styles.chipText, shiftForm.userId === w.id && styles.chipTextOn]}>{w.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.timeRow}>
                <TimeSelect
                  label="Эхлэх цаг"
                  value={shiftForm.startTime}
                  onChange={(t) => setShiftForm({ ...shiftForm, startTime: t })}
                  allowClear={false}
                />
                <TimeSelect
                  label="Дуусах цаг"
                  value={shiftForm.endTime}
                  onChange={(t) => setShiftForm({ ...shiftForm, endTime: t })}
                  allowClear={false}
                />
              </View>
              <Text style={styles.fieldLabel}>Байршил</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                <TouchableOpacity
                  style={[styles.chip, !shiftForm.locationId && styles.chipOn]}
                  onPress={() => setShiftForm({ ...shiftForm, locationId: ''})}
                >
                  <Text style={[styles.chipText, !shiftForm.locationId && styles.chipTextOn]}>Сонгохгүй</Text>
                </TouchableOpacity>
                {locations.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.chip, shiftForm.locationId === l.id && styles.chipOn]}
                    onPress={() => setShiftForm({ ...shiftForm, locationId: l.id })}
                  >
                    <Text style={[styles.chipText, shiftForm.locationId === l.id && styles.chipTextOn]}>{l.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Field
                label="Тайлбар"
                value={shiftForm.note}
                onChangeText={(t) => setShiftForm({ ...shiftForm, note: t })}
              />
              <View style={styles.btnRow}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setShiftModal(false)} />
                <Button title="Хадгалах" style={{ flex: 1 }} onPress={saveShift} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const dashStyles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff6b60',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  selfCard: { borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm },
  heroCard: {
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,153,219,0.28)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 10,
  },
  heroBtnRow: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  heroBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  inOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  inOutCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  inOutIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inOutDivider: { width: StyleSheet.hairlineWidth, height: 34, marginHorizontal: spacing.sm },
  sectionCard: { borderRadius: 18, padding: spacing.lg, marginTop: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center' },
  sectionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  outlineBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  itemDot: { width: 7, height: 7, borderRadius: 4 },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: spacing.sm },
  quickBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBadge: {
    position: 'absolute',
    top: 8,
    right: 14,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff6b60',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  errorBox: { borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  listHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: 8,
  },
  tableHeadRow: { flexDirection: 'row', paddingHorizontal: 4, marginBottom: 6 },
  tableHeadCell: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 14,
    marginBottom: 6,
    overflow: 'hidden',
  },
  statusStripe: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
});

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ---- Ажилтны map-first Ирц дэлгэц ----
  // ⚠️ zIndex + elevation ЗААВАЛ: MapView бол native view бөгөөд эдгээргүй
  // бол товчнууд харагдах ч ДАРАГДАХГҮЙ (touch нь map руу унана).
  mapTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    zIndex: 100,
    elevation: 100,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
  },
  headerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  mapTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  orgPill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  permBanner: {
    marginTop: 10,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  permBtn: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 18 },
  mapControls: { position: 'absolute', right: spacing.lg, top: '32%', zIndex: 90, elevation: 90 },
  actionBtnWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 210,
    alignItems: 'center',
    zIndex: 90,
    elevation: 90,
  },
  warnOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23,23,23,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  warnModal: { width: '100%', borderRadius: 22, padding: spacing.xl },
  warnTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  warnMessage: { fontSize: 14, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },

  heroCard: { marginTop: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  faceCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800'},
  cardSub: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: spacing.md },
  // Байршил хянах төлөв — ажилтанд ил тод байх ёстой
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  trackDot: { width: 8, height: 8, borderRadius: 4 },
  mapLink: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 3 },
  trackText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center'},
  recordName: { color: colors.text, fontSize: 15, fontWeight: '800'},
  recordDate: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  error: { color: colors.danger, marginBottom: spacing.sm },
  note: { color: colors.warning, fontSize: 12, marginBottom: spacing.sm },
  privacyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  geoHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, lineHeight: 17 },
  enrollHint: { color: colors.primary, fontSize: 12, marginTop: spacing.sm, lineHeight: 17, fontWeight: '600'},
  blockTitle: { color: colors.text, fontSize: 15, fontWeight: '800'},
  locHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  locName: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 14 },
  locRadius: { color: colors.textMuted, fontSize: 13 },
  delete: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  pendCard: { marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.accent + '55'},
  noteText: { color: colors.text, fontSize: 13, marginTop: 2 },
  tagRow: { flexDirection: 'row', gap: spacing.xs, marginTop: 4 },
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderHi,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginBottom: spacing.xs },
  sheetSub: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  shiftLine: { color: colors.text, fontSize: 14, marginTop: spacing.sm, lineHeight: 20 },
  hoursTap: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hoursLabel: { color: colors.textMuted, fontSize: 12 },
  hoursValue: { color: colors.primary, fontSize: 28, fontWeight: '800', marginTop: 4 },
  hoursHint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hoursRowText: { color: colors.text, fontSize: 14 },
  hoursRowDur: { color: colors.textMuted, fontSize: 13, fontWeight: '700'},
  hoursTotalBox: { marginVertical: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  hoursTotalLine: { color: colors.textMuted, fontSize: 13 },
  hoursTotalNet: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600'},
  chipTextOn: { color: colors.primary },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  weekDay: { width: 56, color: colors.text, fontWeight: '800', fontSize: 13, paddingTop: spacing.lg },
  timeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  restBadge: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  restRowOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '18',
  },
  restDayLabel: { color: colors.text, fontSize: 15, fontWeight: '700'},
  restDayLabelOn: { color: colors.accent },
  restStatus: { color: colors.textMuted, fontSize: 13, fontWeight: '600'},
  restStatusOn: { color: colors.accent, fontWeight: '800' },
});
