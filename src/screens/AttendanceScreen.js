import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFaceDetection } from '../lib/faceDetection';
import * as faceCloud from '../services/faceCloudService';
import * as faceEdge from '../services/faceEdgeService';
import * as deviceApi from '../services/deviceAuthService';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import { Card, Button, Field, Badge, ScreenHeader, SectionTitle, EmptyState } from '../components/ui';
import TimeSelect from '../components/TimeSelect';
import SelfieCamera from '../components/SelfieCamera';
import ProfileSetup from '../components/ProfileSetup';
import * as attApi from '../services/attendanceService';
import * as faceApi from '../services/faceService';
import * as shiftApi from '../services/shiftService';
import * as notifyApi from '../services/notificationService';
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
import { useTheme, useStyles } from '../context/ThemeContext';

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

export default function AttendanceScreen() {
  const navigation = useNavigation();
  const faceDetector = useFaceDetection();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
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
      setRecords(await attApi.fetchAttendance());
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
    } catch (e) {}
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
        setRemoteModal(true);
      }
    } catch (e) {
      setError(e.message);
      Alert.alert('Царай таних AI бэлэн болсонгүй', e.message);
    } finally {
      setFacePreparing(false);
    }
  };

  const submitRemote = () => {
    setRemoteModal(false);
    setCameraVisible(true);
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
      Alert.alert('Алдаа', e.message);
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
      Alert.alert('Алдаа', e.message);
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
      Alert.alert('Алдаа', e.message);
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
      Alert.alert('Алдаа', e.message);
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
              Alert.alert('Алдаа', e.message);
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

  const header = (
    <View>
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.faceCircle}>
            <Text style={{ fontSize: 30 }}></Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Царайгаар ирц бүртгэх</Text>
            <Text style={styles.cardSub}>Урд камераар selfie авч баталгаажуулна.</Text>
          </View>
        </View>
        <View style={styles.btnRow}>
          <Button
            title={shiftStatus.checkedIn ? 'Ирсэн ✓' : 'Ирсэн'}
            variant="success"
            style={{ flex: 1 }}
            loading={facePreparing}
            disabled={shiftStatus.checkedIn}
            onPress={() => startCheck('check_in')}
          />
          <Button
            title={shiftStatus.checkedOut ? 'Явсан ✓' : 'Явсан'}
            variant="danger"
            style={{ flex: 1 }}
            disabled={facePreparing || !shiftStatus.checkedIn || shiftStatus.checkedOut}
            onPress={() => startCheck('check_out')}
          />
        </View>
        {/* Байршил хянах төлөв — ажилтан юу болж байгааг мэдэж байх ёстой */}
        {isCloud && !isAdmin ? (
          <View style={styles.trackRow}>
            <View
              style={[
                styles.trackDot,
                { backgroundColor: shiftStatus.onShift ? colors.success : colors.textFaint },
              ]}
            />
            <Text style={styles.trackText}>
              {shiftStatus.onShift
                ? 'Ажил дээр · байршил хянагдаж байна'
                : shiftStatus.checkedOut
                  ? 'Ажил дууссан · байршил хянахыг зогсоов'
                  : 'Ирснээ бүртгүүлбэл байршил хянаж эхэлнэ'}
            </Text>
          </View>
        ) : null}
        {isCloud && locations.length > 0 ? (
          <Text style={styles.geoHint}>
             {locations.map((l) => l.name).join(', ')} цэгийн ойролцоо байх шаардлагатай. Гадуур бол зайнаас хүсэлт илгээнэ.
          </Text>
        ) : null}
        {isCloud && faceBackendReady === false ? (
          <Text style={styles.enrollHint}>
            Царай таних энэ төхөөрөмж дээр ажиллахгүй байна. Ирц нь байршил,
            төхөөрөмж, selfie-гээр бүртгэгдэж админы баталгаажуулалтад орно.
            {'\n'}Бүрэн ажиллуулах: development build (npx expo run:android) эсвэл APK.
          </Text>
        ) : isCloud && !enrolled ? (
          <Text style={styles.enrollHint}>
             Анх удаа: царайгаа 3 зааврын дагуу бүртгүүлнэ ({enrollCount}/
            {faceApi.ENROLL_TARGET}).
          </Text>
        ) : isCloud ? (
          <View>
            <Text style={styles.geoHint}> Царай бүртгэгдсэн. Эгц зураг + санамсаргүй хөдөлгөөнөөр ирцийг батална.</Text>
            {faceApi.isNativeFaceAvailable() ? (
              <Button title="Царай дахин бүртгэх" variant="ghost" size="sm" onPress={resetMyFace} />
            ) : null}
          </View>
        ) : null}
      </Card>

      {/* Ажилтан: хуваарь харах */}
      {!isAdmin && isCloud ? (
        <Card style={{ marginTop: spacing.sm }}>
          <Text style={styles.blockTitle}> Хуваарь харах</Text>
          <Text style={styles.privacyText}>
            Ажлын хуваарь, амралтын өдөр, нийт ажилласан цагаа харна.
          </Text>
          <TouchableOpacity
            style={styles.hoursTap}
            onPress={() => navigation.navigate('MyShift')}
            activeOpacity={0.7}
          >
            <Text style={styles.hoursLabel}>Өнөөдөр</Text>
            <Text style={styles.hoursValue}>
              {todayIsRest ? 'Амралт' : myShift ? `${myShift.start_time} – ${myShift.end_time}` : 'Хуваарьгүй'}
            </Text>
            <Text style={styles.hoursHint}>
              Ажилласан: {todayIsRest ? '—' : formatDuration(workSummary.netMs)} · Дэлгэрэнгүй →
            </Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {migrationHint ? (
        <Card style={{ marginTop: spacing.sm, borderColor: colors.warning, borderWidth: 1 }}>
          <Text style={styles.note}>{migrationHint}</Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isCloud ? (
        <Text style={styles.note}>
           Supabase холбогдоогүй тул ирц зөвхөн энэ утсанд хадгалагдана.
        </Text>
      ) : null}

      {/* Админ: хуваарь оноох */}
      {isAdmin && isCloud ? (
        <Card style={{ marginTop: spacing.sm }}>
          <View style={styles.locHead}>
            <Text style={styles.blockTitle}> Ажилтны хуваарь</Text>
            <Button title="Хуваарь оноох" size="sm" onPress={() => setShiftModal(true)} />
          </View>
          {todayShifts.length === 0 ? (
            <Text style={styles.privacyText}>Өнөөдрийн хуваарь алга.</Text>
          ) : (
            todayShifts.map((s) => (
              <View key={s.id} style={styles.locRow}>
                <Text style={styles.locName}>{s.user_name}</Text>
                <Text style={styles.locRadius}>
                  {s.start_time}–{s.end_time}
                  {s.location_name ? ` · ${s.location_name}` : ''}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {/* Админ: амралтын өдөр */}
      {isAdmin && isCloud ? (
        <Card style={{ marginTop: spacing.sm }}>
          <View style={styles.locHead}>
            <Text style={styles.blockTitle}> Амралтын өдөр</Text>
            <Button title="Өдөр сонгох" size="sm" onPress={openBreakModal} />
          </View>
          {Object.keys(breakSchedulesByUser).length === 0 ? (
            <Text style={styles.privacyText}>Даваа–Ням гаригт амралтын өдөр тохируулаагүй.</Text>
          ) : (
            Object.values(breakSchedulesByUser).map((item) => (
              <View key={item.user_id} style={styles.locRow}>
                <Text style={styles.locName}>{item.user_name}</Text>
                <Text style={styles.locRadius}>
                  {item.days.map((d) => weekdayLabel(d)).join(', ')}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {/* Админ: бүртгэлийн байршлын тохиргоо */}
      {isAdmin && isCloud ? (
        <Card style={{ marginTop: spacing.sm }}>
          <View style={styles.locHead}>
            <Text style={styles.blockTitle}> Бүртгэлийн байршил</Text>
            <Button title="Одоогийн газар нэмэх" size="sm" onPress={() => setLocModal(true)} />
          </View>
          {locations.length === 0 ? (
            <Text style={styles.privacyText}>Байршил тохируулаагүй бол хаанаас ч бүртгэнэ.</Text>
          ) : (
            locations.map((l) => (
              <View key={l.id} style={styles.locRow}>
                <Text style={styles.locName}>{l.name}</Text>
                <Text style={styles.locRadius}>{l.radius_m}м</Text>
                <TouchableOpacity onPress={() => removeLocation(l.id, l.name)} hitSlop={8}>
                  <Text style={styles.delete}>Устгах</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {/* Админ: зайнаас бүртгүүлэх хүсэлтүүд */}
      {isAdmin && pending.length > 0 ? (
        <View>
          <SectionTitle style={{ marginTop: spacing.md }}>
             Зайнаас бүртгүүлэх хүсэлт ({pending.length})
          </SectionTitle>
          {pending.map((item) => (
            <Card key={item.id} style={styles.pendCard}>
              <View style={styles.recordRow}>
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Text style={{ fontSize: 22 }}></Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordName}>{item.staff_name}</Text>
                  <Text style={styles.recordDate}>
                    {item.type === 'check_in' ? 'Ирсэн' : 'Явсан'} ·{' '}
                    {new Date(item.created_at).toLocaleString('mn-MN')}
                  </Text>
                  {item.distance_m != null ? (
                    <Text style={styles.recordDate}> Цэгээс ~{item.distance_m}м зайд</Text>
                  ) : null}
                  {item.location_name ? (
                    <Text style={styles.recordDate}> Бүртгсэн: {item.location_name}</Text>
                  ) : null}
                  {item.latitude != null && item.longitude != null ? (
                    <TouchableOpacity
                      onPress={() => openOnMap(item)}
                      accessibilityRole="link"
                      accessibilityLabel="Байршлыг газрын зураг дээр харах"
                    >
                      <Text style={styles.mapLink}>Газрын зураг дээр харах</Text>
                    </TouchableOpacity>
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

      {isAdmin ? (
        <SectionTitle style={{ marginTop: spacing.md }}> Бүх ажилчдын ирц</SectionTitle>
      ) : (
        <Card style={{ marginTop: spacing.sm }}>
          <Text style={styles.privacyText}>
             Таны ирцийн бүртгэлийг зөвхөн админ харна. Дээрх товчоор ирцээ бүртгүүлээрэй.
          </Text>
        </Card>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        back={false} title="Ирцийн бүртгэл"
        subtitle={`${isCloud ? 'Supabase' : 'Локал'} · ${profile?.name || ''}`}
      />
      <FlatList
        data={isAdmin ? records.filter((r) => r.status !== 'pending') : []}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.recordRow}>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={{ fontSize: 22 }}></Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.recordName}>{item.staff_name}</Text>
                <Text style={styles.recordDate}>
                  {new Date(item.created_at).toLocaleString('mn-MN')}
                </Text>
                {item.location_name ? (
                  <Text style={styles.recordDate}>{item.location_name}</Text>
                ) : item.is_remote && item.distance_m != null ? (
                  <Text style={styles.recordDate}> Цэгээс ~{item.distance_m}м зайд</Text>
                ) : null}
                {/* Ирц бүртгүүлсэн байршил — БҮХ ажилтанд харагдана.
                    Өмнө нь зөвхөн админы "зөвшөөрөх" жагсаалт дээр байсан
                    тул энгийн ажилтан өөрийнхөө ирц хаана бүртгэгдсэнийг
                    шалгах боломжгүй байв. */}
                {item.latitude != null && item.longitude != null ? (
                  <TouchableOpacity
                    onPress={() => openOnMap(item)}
                    accessibilityRole="link"
                    accessibilityLabel="Ирц бүртгүүлсэн байршлыг газрын зураг дээр харах"
                    hitSlop={6}
                  >
                    <Text style={styles.mapLink}>Газрын зураг дээр харах</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.tagRow}>
                  {item.is_remote ? <Badge text="Зайнаас" color={colors.accent} /> : null}
                  {item.status === 'rejected' ? <Badge text="Татгалзсан" color={colors.danger} /> : null}
                </View>
              </View>
              <Badge
                text={item.type === 'check_in' ? 'Ирсэн' : 'Явсан'}
                color={item.type === 'check_in' ? colors.success : colors.danger}
              />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          isAdmin ? <EmptyState text="Ирц бүртгэгдээгүй байна."/> : null
        }
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
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}> Зайнаас бүртгүүлэх</Text>
            <Text style={styles.sheetSub}>
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
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}> Бүртгэлийн байршил нэмэх</Text>
              <Text style={styles.sheetSub}>Таны одоо байгаа GPS цэгийг хадгална.</Text>
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
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Нийт ажилласан цаг</Text>
            <Text style={styles.sheetSub}>{dayKey()} · {profile?.name}</Text>
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
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}> Амралтын өдөр</Text>
              <Text style={styles.sheetSub}>
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
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}> Хуваарь оноох</Text>
              <Text style={styles.sheetSub}>Ажилтанд өдрийн эхлэх/дуусах цаг болон байршил онооно.</Text>
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

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
