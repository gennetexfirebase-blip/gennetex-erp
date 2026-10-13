import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  DeviceEventEmitter,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { requestLibraryAccess } from '../lib/mediaLibraryAccess';
import Notifications from '../lib/notificationsCompat';
import { useApp } from '../context/AppContext';
import { uploadAvatar } from '../services/attendanceService';
import {
  getPushDiagnostics,
  enablePushForUser,
  sendPushToUser,
  DEFAULT_CHANNEL,
} from '../services/notificationService';
import {
  getIncomingCallDiagnostics,
  showNativeIncomingCall,
  openFullScreenIntentSettings,
} from '../services/nativeIncomingCallService';
import {
  getLocationDiagnostics,
  openAppSettings,
  startTracking,
  trackingProblemText,
  requestIgnoreBatteryOptimizations,
} from '../services/backgroundLocationService';
import * as locationQueue from '../services/locationQueue';
import {
  MODES,
  MODE_OPTIONS,
  getPerformanceState,
  setPerformanceMode,
  subscribePerformance,
} from '../lib/performanceMode';
import {
  Button,
  Field,
  GroupLabel,
  ListGroup,
  ListRow,
  StatusPill,
} from '../components/ui';
import QRCode from '../components/QRCode';
import { formatEmployeeBadge } from '../lib/employeeBadge';
import * as vehicleApi from '../services/vehicleService';
import { roleLabel } from '../lib/roles';
import { hasPermission } from '../lib/permissions';
import { DEVELOPER_LABEL, SUPERADMIN_EMAIL, HAS_DEVELOPER_EMAIL } from '../lib/developerConfig';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type, lightColors, darkColors } from '../theme';
import { Avatar, Chip, PillButton, RoundButton } from '../components/ds';
import { supabase } from '../lib/supabase';
import * as leaveApi from '../services/leaveRequestService';
import { useTheme, useStyles } from '../context/ThemeContext';

const THEME_OPTIONS = [
  { key: 'system', label: 'Систем' },
  { key: 'light', label: 'Цагаан' },
  { key: 'dark', label: 'Харанхуй' },
];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { colors, mode, setMode } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile, profile, isAdmin, isSuperAdmin, isCloud, signOut, updateMyProfile } = useApp();
  const canEdit = isAdmin;
  const canEditAvatar = !!authProfile;
  const [editing, setEditing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  // Гүйцэтгэлийн горим — сул утсанд аппыг хөнгөлнө
  const [perf, setPerf] = useState(() => getPerformanceState());
  const [pushChecking, setPushChecking] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);
  useEffect(() => subscribePerformance(setPerf), []);

  /**
   * Мэдэгдэл яагаад ирэхгүй байгааг шалгаж, ойлгомжтой хариу өгнө.
   * Алхам бүр (зөвшөөрөл -> Firebase -> token -> сан) тусад нь харагдана.
   */
  /**
   * Өөр рүүгээ ЖИНХЭНЭ push илгээж, бүх гинжийг шалгана:
   *   апп -> send-push функц -> Firebase -> утас
   *
   * Серверийн хариу нь хаана тасарсныг тоогоор хэлнэ:
   *   tokens: 0  -> энэ хэрэглэгчид бүртгэлтэй төхөөрөмж алга
   *   failed > 0 -> Firebase руу илгээх үед алдаа (ихэвчлэн серверийн
   *                 FIREBASE_* нууц утга дутуу)
   *   sent: 1    -> илгээгдсэн. Ирэхгүй бол утасны батарей/мэдэгдлийн
   *                 тохиргоог шалгана.
   */
  const testPush = async () => {
    if (!authProfile?.id) return;
    setPushTesting(true);
    try {
      const res = await sendPushToUser(authProfile.id, {
        title: 'Тест мэдэгдэл',
        body: 'Энэ мэдэгдэл ирсэн бол push бүрэн ажиллаж байна.',
        type: 'test',
        channelId: DEFAULT_CHANNEL,
      });
      const lines = [
        `Хүлээн авагч: ${res?.recipients ?? '—'}`,
        `Бүртгэлтэй төхөөрөмж: ${res?.tokens ?? '—'}`,
        `Илгээсэн: ${res?.sent ?? '—'}`,
        `Амжилтгүй: ${res?.failed ?? '—'}`,
      ];
      if (!res?.tokens) {
        lines.push('', '⚠️ Энэ хэрэглэгчид бүртгэлтэй төхөөрөмж алга. "Дахин бүртгүүлэх" дарна уу.');
      } else if (res?.failed) {
        lines.push('', '⚠️ Firebase руу илгээхэд алдаа. Серверийн FIREBASE_* нууц утгыг шалгана уу.');
      } else if (res?.sent) {
        lines.push('', '✅ Илгээгдлээ. Хэдэн секундын дотор мэдэгдэл ирэх ёстой.');
      }
      Alert.alert('Тест мэдэгдэл', lines.join('\n'));
    } catch (e) {
      Alert.alert(
        'Тест мэдэгдэл',
        `Илгээж чадсангүй: ${e?.message || e}\n\n`
          + 'Ихэвчлэн серверийн FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / '
          + 'FIREBASE_PRIVATE_KEY нууц утга тохируулаагүйгээс болно.'
      );
    } finally {
      setPushTesting(false);
    }
  };

  /**
   * Ирэх дуудлагын дэлгэцийг СЕРВЕРГҮЙГЭЭР шалгана.
   *
   * Push ирж байгаа ч дэлгэц гарахгүй байвал асуудал хоёрын аль нэгэнд:
   *   (а) native модуль/зөвшөөрөл  (б) push-ийн зам
   * Энэ товч (а)-г тусад нь шалгана — 3 секундын дараа дуудлага гаргана,
   * тэр хооронд утсаа түгжиж болно.
   */
  /**
   * Ирэх дуудлагын дэлгэцийн оношилгоо.
   *
   * Хамгийн түгээмэл ХОЁР шалтгаан нь ЗӨВШӨӨРӨЛ бөгөөд хоёулаа код
   * дотроос асаах боломжгүй — хэрэглэгч тохиргооноос гараар өгнө:
   *   1. Android 14+ — "Бүтэн дэлгэцийн мэдэгдэл". Хаалттай бол систем
   *      бүтэн дэлгэцийн оронд энгийн мэдэгдэл харуулна (алдаа гаргахгүй).
   *   2. Дуудлагын данс (Telecom) — унтраалттай бол системийн дуудлагын
   *      дэлгэц огт гарахгүй.
   */
  const testIncomingCall = async () => {
    const d = getIncomingCallDiagnostics();

    /**
     * ⚠️ МЭДЭГДЛИЙН ЗӨВШӨӨРӨЛ нь дуудлагын дэлгэцийн УРЬДЧИЛСАН НӨХЦӨЛ.
     *
     * Бүтэн дэлгэц нь мэдэгдлийн `fullScreenIntent`-ээр гардаг. Android
     * 13-аас хойш POST_NOTIFICATIONS олгогдоогүй бол апп ямар ч мэдэгдэл
     * гаргаж чадахгүй тул дуудлагын дэлгэц ч ГАРАХГҮЙ.
     *
     * Хэрэглэгч нэг удаа татгалзсан бол Android дахин асуудаггүй —
     * зөвхөн Тохиргооноос гараар асаана. Тиймээс энд тодорхой хэлж,
     * шууд тохиргоо руу аваачна.
     */
    let notifStatus = 'тодорхойгүй';
    try {
      notifStatus = (await Notifications.getPermissionsAsync()).status;
    } catch (e) {}
    const notifOk = notifStatus === 'granted';

    const lines = [
      `Платформ: ${d.platform}${d.androidVersion ? ` (API ${d.androidVersion})` : ''}`,
      `Мэдэгдлийн зөвшөөрөл: ${notifStatus}`,
      `Дуудлагын дэлгэц: ${d.canDisplay ? 'боломжтой' : 'боломжгүй'}`,
      `Сонсогч бэлэн: ${d.listenersReady ? 'тийм' : 'үгүй'}`,
    ];
    if (!notifOk) {
      lines.push(
        '',
        '⚠️ Мэдэгдлийн зөвшөөрөл ОЛГОГДООГҮЙ байна. Дуудлагын бүтэн '
          + 'дэлгэц нь мэдэгдлээр гардаг тул энэ зөвшөөрөлгүйгээр ГАРАХГҮЙ. '
          + 'Мөн апп хаалттай үед ямар ч мэдэгдэл ирэхгүй.'
      );
    }
    if (d.platform === 'ios') {
      lines.push(
        `CallKit: ${d.systemCall ? (d.systemCallReady ? 'бэлэн' : 'тохируулагдаагүй') : 'алга'}`
      );
    }
    if (d.systemCallError) lines.push(`⚠️ Систем: ${d.systemCallError}`);
    if (d.error) lines.push('', `⚠️ ${d.error}`);

    if (Number(d.androidVersion) >= 34) {
      lines.push(
        '',
        'ℹ️ Android 14+ дээр "Бүтэн дэлгэцийн мэдэгдэл" зөвшөөрөл ХААЛТТАЙ ирдэг. ' +
          'Хаалттай үед дуудлага бүтэн дэлгэцийн оронд энгийн мэдэгдэл болж харагдана.'
      );
    }

    const buttons = [
      { text: 'Хаах', style: 'cancel' },
    ];
    if (!notifOk) {
      buttons.push({ text: 'Мэдэгдэл асаах', onPress: () => openAppSettings() });
    }
    buttons.push({ text: 'Бүтэн дэлгэц', onPress: () => openFullScreenIntentSettings() });
    if (d.canDisplay || d.systemCall) {
      /**
       * Тест нь ШУУД ажиллана — хүлээгээд утсаа түгжих ЁСГҮЙ.
       *
       * ⚠️ Урьд нь 3 секунд хүлээж, "утсаа түгжиж үзээрэй" гэдэг байв.
       *    Гэтэл Android 12+ дээр апп ард байхад foreground service
       *    эхлүүлэхийг хориглодог тул тэр яг л бүтэлгүйтэх нөхцөлийг
       *    үүсгэж байсан — тест нь жинхэнэ дуудлагыг огт төлөөлөхгүй.
       *
       *    Жинхэнэ дуудлага нь өндөр ач холбогдолтой FCM мессежээр ирдэг
       *    бөгөөд Android тэр үед богино чөлөөлөлт өгдөг. Тиймээс
       *    түгжээтэй үеийн зан төлөвийг зөвхөн БОДИТ дуудлагаар шалгана.
       */
      buttons.push({
        text: 'Тест',
        onPress: () => {
          showNativeIncomingCall({
            id: `test_${Date.now()}`,
            caller_name: 'Тест дуудлага',
            type: 'audio',
          });
        },
      });
    }

    Alert.alert('Ирэх дуудлага', lines.join('\n'), buttons);
  };

  /**
   * Байршил зөвхөн апп дотор ажиллаж байгаа шалтгааныг харуулна.
   *
   * Android 11+ дээр "Байнга зөвшөөрөх"-ийг систем автоматаар асуудаггүй —
   * Тохиргооноос гараар сонгох ёстой. Тэрийг сонгоогүй бол апп хаагдмагц
   * байршил илгээхээ болино.
   */
  const checkLocation = async () => {
    const d = await getLocationDiagnostics();
    const bgOk = d.background === 'granted';

    // Хойшлогдсон (сүлжээгүй) цэгийн тоог мөн харуулна — "яагаад
    // админд байршил хоцорч харагдаж байна" гэдгийг тайлбарлана.
    let queued = 0;
    try {
      queued = await locationQueue.queueSize();
    } catch (e) {}

    const lines = [
      `Байршлын үйлчилгээ: ${d.servicesEnabled ? 'асаалттай' : 'унтраалттай'}`,
      `Апп ашиглаж байхад: ${d.foreground}`,
      `Байнга (арын): ${d.background}`,
      `Хяналт идэвхтэй: ${d.tracking ? 'тийм' : 'үгүй'}`,
      queued > 0 ? `Илгээгдээгүй цэг: ${queued} (сүлжээ ормогц илгээнэ)` : null,
    ].filter(Boolean);

    if (!bgOk) {
      lines.push('', `⚠️ ${trackingProblemText('no-background-permission')}`);
    } else if (!d.tracking) {
      lines.push('', '⚠️ Зөвшөөрөл бий ч хяналт эхлээгүй байна.');
    } else {
      lines.push('', '✅ Апп хаалттай үед ч байршил илгээгдэнэ.');
    }

    /**
     * ⚠️ БАТЕРЕЙН ХЭМНЭЛТ нь background байршил зогсох ХАМГИЙН
     *    ТҮГЭЭМЭЛ шалтгаан — Xiaomi, Huawei, Samsung, Oppo зэрэг нь
     *    зөвшөөрөл бүрэн байсан ч арын үйлчилгээг алдаг. Тиймээс
     *    "Байнга зөвшөөрөх" олгосон ч энэ товчийг үргэлж санал болгоно.
     */
    Alert.alert('Байршлын шалгалт', lines.join('\n'), [
      { text: 'Хаах', style: 'cancel' },
      { text: 'Батерей чөлөөлөх', onPress: () => requestIgnoreBatteryOptimizations() },
      {
        text: d.tracking ? 'Дахин эхлүүлэх' : 'Хяналт эхлүүлэх',
        onPress: async () => {
          const result = await startTracking(authProfile, { requestPermissions: true });
          if (result.ok) DeviceEventEmitter.emit('erp-location-consent');
        },
      },
    ]);
  };

  const checkPush = async () => {
    if (!authProfile?.id) return;
    setPushChecking(true);
    try {
      const d = await getPushDiagnostics(authProfile.id);
      const lines = [
        `Орчин: ${d.environment}`,
        `Зөвшөөрөл: ${d.permission}`,
        `Firebase модуль: ${d.firebaseModule ? 'байна' : 'алга'}`,
        `Token: ${d.token ? d.token.slice(0, 14) + '…' : 'алга'}`,
        `Санд хадгалагдсан: ${d.savedInDb ? 'тийм' : 'үгүй'}`,
      ];
      if (d.problem) lines.push('', `⚠️ ${d.problem}`);
      else lines.push('', '✅ Бүх шалгалт хэвийн. Апп хаалттай үед мэдэгдэл ирэх ёстой.');

      Alert.alert('Мэдэгдлийн шалгалт', lines.join('\n'), [
        { text: 'Хаах', style: 'cancel' },
        {
          text: 'Дахин бүртгүүлэх',
          onPress: async () => {
            const res = await enablePushForUser(authProfile.id);
            Alert.alert(
              'Мэдэгдэл',
              res?.ok ? 'Төхөөрөмж дахин бүртгэгдлээ.' : 'Бүртгэж чадсангүй. Зөвшөөрлөө шалгана уу.'
            );
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Мэдэгдлийн шалгалт', e?.message || 'Шалгахад алдаа гарлаа.');
    } finally {
      setPushChecking(false);
    }
  };
  const [form, setForm] = useState({
    name: authProfile?.name || '',
    position: authProfile?.position || '',
    phone: authProfile?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [withDriver, setWithDriver] = useState(null);
  // Prototype: Сарын ирц · Ажилласан өдөр · Чөлөө (энэ жил авсан)
  const [pstats, setPstats] = useState({ percent: null, days: null, leave: null });

  useEffect(() => {
    if (!isCloud || !authProfile?.id) return;
    let active = true;
    (async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const { data } = await supabase
          .from('attendance')
          .select('created_at,type,status')
          .eq('staff_id', String(authProfile.id))
          .eq('type', 'check_in')
          .gte('created_at', monthStart.toISOString());
        const days = new Set((data || []).filter((r) => r.status !== 'rejected').map((r) => new Date(r.created_at).toDateString())).size;
        let workdays = 0;
        for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
          if (d.getDay() !== 0 && d.getDay() !== 6) workdays += 1;
        }
        const leaves = await leaveApi.fetchMyLeaveRequests(authProfile.id, 100).catch(() => []);
        const leave = leaves
          .filter((r) => r.status === 'approved' && String(r.date_from || '').startsWith(String(now.getFullYear())))
          .reduce((sum, r) => sum + (leaveApi.countLeaveDays(r) || 0), 0);
        if (active) setPstats({ percent: workdays ? Math.min(100, Math.round((days / workdays) * 100)) : 0, days, leave });
      } catch (e) {}
    })();
    return () => {
      active = false;
    };
  }, [isCloud, authProfile?.id]);

  useEffect(() => {
    if (!isCloud || !authProfile?.id || isAdmin) return;
    let active = true;
    (async () => {
      try {
        const row = await vehicleApi.fetchMyActivePassengerTrip(authProfile.id);
        if (active) setWithDriver(row?.trips || null);
      } catch (e) {}
    })();
    return () => {
      active = false;
    };
  }, [isCloud, authProfile?.id, isAdmin]);

  const name = authProfile?.name || profile?.name || 'Ажилтан';
  const email = authProfile?.email || '—';
  const avatarUrl = authProfile?.avatar_url;

  const applyPickedImage = async (uri) => {
    if (!canEditAvatar) return;
    if (!isCloud || !authProfile) {
      Alert.alert('Боломжгүй', 'Профайл зураг хадгалахад Supabase холболт шаардлагатай.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(uri, authProfile.id);
      await updateMyProfile({ avatar_url: url });
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setUploading(false);
    }
  };

  const pickFromLibrary = async () => {
    const perm = await requestLibraryAccess();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Зургийн санд хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!res.canceled) applyPickedImage(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Зөвшөөрөл', 'Камерт хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!res.canceled) applyPickedImage(res.assets[0].uri);
  };

  const changeAvatar = () => {
    if (!canEditAvatar) return;
    Alert.alert('Профайл зураг', 'Зургаа хаанаас сонгох вэ?', [
      { text: 'Зургийн сангаас', onPress: pickFromLibrary },
      { text: 'Камераар авах', onPress: takePhoto },
      { text: 'Болих', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        name: form.name.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
      });
      setEditing(false);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    setForm({
      name: authProfile.name || '',
      position: authProfile.position || '',
      phone: authProfile.phone || '',
    });
    setEditing(true);
  };

  const confirmSignOut = () => {
    Alert.alert('Гарах', 'Та системээс гарахдаа итгэлтэй байна уу?', [
      { text: 'Болих', style: 'cancel' },
      { text: 'Гарах', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <RoundButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Буцах" />
        <Text style={styles.topTitle}>Профайл</Text>
        {canEdit && authProfile ? (
          <PillButton title="Засах" icon="create-outline" soft onPress={editing ? () => setEditing(false) : startEdit} />
        ) : null}
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* --- Том зураг, нэр, chip-үүд --- */}
        <View style={styles.phero}>
          <Pressable
            onPress={changeAvatar}
            disabled={uploading || !canEditAvatar}
            accessibilityRole={canEditAvatar ? 'button' : undefined}
            accessibilityLabel={canEditAvatar ? 'Профайл зураг солих' : undefined}
          >
            <View style={styles.pavRing}>
              {uploading ? (
                <View style={[styles.pavLoading]}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              ) : (
                <Avatar uri={avatarUrl} name={name} size={96} />
              )}
            </View>
            {canEditAvatar && !uploading ? (
              <View style={styles.camBadge}>
                <Ionicons name="camera" size={15} color={colors.bg} />
              </View>
            ) : null}
          </Pressable>
          <Text style={styles.pname} numberOfLines={1}>{name}</Text>
          <Text style={styles.pmeta} numberOfLines={1}>
            {['Женнетекс ХХК', authProfile?.department_name || authProfile?.position].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.chips2}>
            <Chip text={roleLabel(authProfile?.role || 'employee')} tone="blue" />
            {authProfile?.badge_code || authProfile?.employee_code ? <Chip text={authProfile.badge_code || authProfile.employee_code} tone="muted" /> : null}
            <Chip text={isCloud ? 'Онлайн' : 'Локал'} tone={isCloud ? 'ok' : 'muted'} icon={isCloud ? 'ellipse' : undefined} />
          </View>
        </View>

        {authProfile ? (
          <View style={styles.pstats}>
            {[
              [pstats.percent == null ? '—' : `${pstats.percent}%`, 'Сарын ирц'],
              [pstats.days == null ? '—' : String(pstats.days), 'Ажилласан өдөр'],
              [pstats.leave == null ? '—' : String(pstats.leave), 'Чөлөө авсан'],
            ].map(([v, l], i) => (
              <View key={l} style={[styles.pstat, i > 0 && styles.pstatBorder]}>
                <Text style={styles.pstatValue}>{v}</Text>
                <Text style={styles.pstatLabel}>{l}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* --- Идэвхтэй аялал --- */}
        {withDriver ? (
          <>
            <GroupLabel>Хамт яваа аялал</GroupLabel>
            <ListGroup>
              <ListRow icon="car-outline" label="Жолооч" value={withDriver.driver_name || '—'} chevron={false} />
              <ListRow
                icon="document-text-outline"
                label={withDriver.plate_number || 'Машин'}
                right={<StatusPill text="Идэвхтэй" tone="success" />}
                chevron={false}
              />
            </ListGroup>
          </>
        ) : null}

        {/* --- Хувийн мэдээлэл --- */}
        <GroupLabel>Хувийн мэдээлэл</GroupLabel>
        {authProfile ? (
          canEdit && editing ? (
            <View style={styles.editCard}>
              <Field label="Нэр" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
              <Field
                label="Албан тушаал"
                value={form.position}
                onChangeText={(t) => setForm({ ...form, position: t })}
              />
              <Field
                label="Утас"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(t) => setForm({ ...form, phone: t })}
              />
              <View style={styles.editActions}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setEditing(false)} />
                <Button
                  title="Хадгалах"
                  style={{ flex: 1 }}
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving}
                />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.infoCard}>
                {[
                  ['call-outline', 'Утас', authProfile.phone],
                  ['mail-outline', 'Имэйл', email],
                  ['business-outline', 'Хэлтэс', authProfile.department_name || authProfile.position],
                  ['calendar-outline', 'Ажилд орсон', authProfile.created_at ? String(authProfile.created_at).slice(0, 10).replace(/-/g, '.') : ''],
                ].map(([icon, label, value], i) => (
                  <View key={label} style={[styles.infoRow, i > 0 && styles.infoBorder]}>
                    <View style={styles.infoIcon}>
                      <Ionicons name={icon} size={19} color={colors.ink} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.infoLabel}>{label}</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {!canEdit ? (
                <Text style={styles.lockedNote}>
                  Нэр, утас, албан тушаалыг админ засна. Профайл зураг дээр дарж солино.
                </Text>
              ) : null}
            </>
          )
        ) : (
          <Text style={styles.lockedNote}>Нэвтэрсэн хэрэглэгчийн мэдээлэл энд харагдана.</Text>
        )}

        {/* --- Харагдах байдал: Систем / Цагаан / Харанхуй --- */}
        <GroupLabel>Харагдах байдал</GroupLabel>
        <View style={styles.themeCard}>
          <View style={styles.theme3}>
            {THEME_OPTIONS.map((opt) => {
              const active = mode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    styles.themeOption,
                    { borderColor: active ? colors.brand : colors.line },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setMode(opt.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={opt.label}
                >
                  <ThemeMock kind={opt.key} />
                  <Text style={styles.themeLabel}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* --- Удирдлага (админ): нүүрнээс шилжүүлсэн төвүүд --- */}
        {authProfile && hasPermission(authProfile, 'approve') ? (
          <>
            <GroupLabel>Удирдлага</GroupLabel>
            <ListGroup>
              <ListRow icon="alert-circle-outline" label="Анхааруулгын төв" onPress={() => navigation.navigate('OperationalAlerts')} />
              {isAdmin ? (
                <ListRow icon="settings-outline" label="Тохиргооны төв" onPress={() => navigation.navigate('BusinessSettings')} />
              ) : null}
            </ListGroup>
          </>
        ) : null}

        {/* --- Мэдэгдэл --- */}
        {authProfile ? (
          <>
            <GroupLabel>Мэдэгдэл</GroupLabel>
            <ListGroup>
              <ListRow icon="notifications-outline" label="Мэдэгдлийн тохиргоо" onPress={() => navigation.navigate('NotificationSettings')} />
              <ListRow icon="paper-plane-outline" label="Telegram" value="Миний Telegram" onPress={() => navigation.navigate('MyTelegram')} />
            </ListGroup>
          </>
        ) : null}

        {/* --- Оношилгоо (ажилтан) --- */}
        {authProfile && !isAdmin ? (
          <>
            <GroupLabel>Оношилгоо</GroupLabel>
            <ListGroup>
              <ListRow
                icon="pulse-outline"
                label={pushChecking ? 'Шалгаж байна…' : 'Мэдэгдэл ирэхгүй бол шалгах'}
                onPress={pushChecking ? undefined : checkPush}
              />
              <ListRow
                icon="mail-unread-outline"
                label={pushTesting ? 'Илгээж байна…' : 'Тест мэдэгдэл илгээх'}
                onPress={pushTesting ? undefined : testPush}
              />
              <ListRow
                icon="call-outline"
                label="Ирэх дуудлагын дэлгэц шалгах"
                onPress={testIncomingCall}
              />
              <ListRow
                icon="location-outline"
                label="Байршил хяналт шалгах"
                onPress={checkLocation}
              />
            </ListGroup>

            <GroupLabel>Гүйцэтгэл</GroupLabel>
            <ListGroup>
              {MODE_OPTIONS.map((opt) => (
                <ListRow
                  key={opt.key}
                  icon={perf.mode === opt.key ? 'radio-button-on' : 'radio-button-off'}
                  accent={perf.mode === opt.key ? colors.brand : undefined}
                  label={opt.label}
                  value={
                    opt.key === MODES.AUTO
                      ? perf.tier === 'low'
                        ? 'сул утас илэрсэн'
                        : 'хангалттай хүчтэй'
                      : opt.desc
                  }
                  chevron={false}
                  onPress={() => setPerformanceMode(opt.key)}
                />
              ))}
            </ListGroup>
            <Text style={styles.perfHint}>
              Хөнгөн горимд видео дуудлага 480p болж, жагсаалт, зураг, байршлын
              шинэчлэлт хөнгөрнө. Хуучин утсан дээр гацахаас сэргийлнэ.
            </Text>

            <GroupLabel>Миний QR</GroupLabel>
            <ListGroup>
              <ListRow
                icon="qr-code-outline"
                label={showQr ? 'QR-ыг нуух' : 'QR-ыг харуулах'}
                onPress={() => setShowQr((v) => !v)}
                chevron={false}
                right={<Ionicons name={showQr ? 'chevron-up' : 'chevron-down'} size={18} color={colors.faint} />}
              />
              {showQr ? (
                <View style={styles.qrBox}>
                  <QRCode value={formatEmployeeBadge(authProfile.id)} size={200} />
                  <Text style={styles.qrHint}>
                    Жолооч хамт яваа хүн болгох эсвэл аялал эхлүүлэхэд уншуулна
                  </Text>
                </View>
              ) : null}
            </ListGroup>
          </>
        ) : null}

        {/* --- Бусад --- */}
        {authProfile ? (
          <>
            <GroupLabel>Бусад</GroupLabel>
            <ListGroup>
              <ListRow
                icon="help-circle-outline"
                label={`Тусламж · ${DEVELOPER_LABEL}`}
                onPress={() => navigation.navigate('DeveloperContact')}
              />
              <ListRow
                icon="mail-outline"
                label="Холбоо барих"
                value={HAS_DEVELOPER_EMAIL ? SUPERADMIN_EMAIL : 'Тохируулаагүй'}
                chevron={false}
              />
              {isSuperAdmin ? (
                <ListRow
                  icon="file-tray-full-outline"
                  label="Над руу ирсэн мэдээ"
                  onPress={() => navigation.navigate('DeveloperInbox')}
                />
              ) : null}
              <ListRow icon="language-outline" label="Хэл" value="Монгол" chevron={false} />
              <ListRow
                icon="shield-checkmark-outline"
                label="Нууцлал, нөхцөл, бүртгэл устгах"
                onPress={() => navigation.navigate('Privacy')}
              />
            </ListGroup>
          </>
        ) : (
          <>
            <GroupLabel>Нууцлал ба өгөгдөл</GroupLabel>
            <ListGroup>
              <ListRow
                icon="shield-checkmark-outline"
                label="Нууцлал, нөхцөл, бүртгэл устгах"
                onPress={() => navigation.navigate('Privacy')}
              />
            </ListGroup>
          </>
        )}

        {/* --- Гарах --- */}
        <View style={{ marginTop: spacing.xl }}>
          <ListGroup>
            <ListRow icon="log-out-outline" label="Системээс гарах" danger onPress={confirmSignOut} chevron={false} />
          </ListGroup>
        </View>

        <Text style={styles.connNote}>
          Gennetex ERP v{Constants.expoConfig?.version || ''} · {isCloud ? 'Supabase холбогдсон' : 'Локал горим'}
        </Text>
      </ScrollView>
    </View>
  );
}

/** Харагдах байдлын жижиг preview (Систем = хагас цагаан, хагас харанхуй). */
function ThemeMock({ kind }) {
  const L = lightColors;
  const D = darkColors;
  const pane = (c) => (
    <View style={{ flex: 1, backgroundColor: c.ground, padding: 7, gap: 5 }}>
      <View style={{ height: 7, borderRadius: 4, width: '70%', backgroundColor: c.ink, opacity: 0.85 }} />
      <View style={{ height: 7, borderRadius: 4, backgroundColor: c.card }} />
      <View style={{ height: 7, borderRadius: 4, width: '50%', backgroundColor: c.brand }} />
    </View>
  );
  return (
    <View style={mockStyles.mock}>
      {kind === 'system' ? (
        <>
          {pane(L)}
          {pane(D)}
        </>
      ) : (
        pane(kind === 'dark' ? D : L)
      )}
    </View>
  );
}

const mockStyles = StyleSheet.create({
  mock: { width: '100%', height: 58, borderRadius: 9, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
});

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ground },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: 6, backgroundColor: colors.ground },
  topTitle: { flex: 1, color: colors.ink, fontSize: 21, fontWeight: '700', letterSpacing: -0.4, marginLeft: 12 },
  pstats: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 20, marginTop: 18, ...shadow.md },
  pstat: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6 },
  pstatBorder: { borderLeftWidth: 1, borderLeftColor: colors.line },
  pstatValue: { color: colors.ink, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pstatLabel: { color: colors.muted, fontSize: 12.5, marginTop: 2, textAlign: 'center' },
  infoCard: { backgroundColor: colors.card, borderRadius: 20, ...shadow.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  infoBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  infoIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.ink, fontSize: 15, fontWeight: '600', marginTop: 1 },

  body: { paddingHorizontal: spacing.lg, paddingBottom: 60 },

  phero: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  pavRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field },
  pavLoading: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  camBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.ground,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pname: { color: colors.ink, fontSize: 22, fontWeight: '700', marginTop: 14, marginBottom: 2 },
  pmeta: { color: colors.muted, fontSize: 14 },
  chips2: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },

  editCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadow.md,
  },
  editActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },

  lockedNote: {
    ...type.caption,
    color: colors.muted,
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
    lineHeight: 17,
  },

  qrBox: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  perfHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  qrHint: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 17,
  },

  themeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    ...shadow.md,
  },
  theme3: { flexDirection: 'row', gap: 8, padding: 16, paddingTop: 12 },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    padding: 8,
    paddingBottom: 10,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: colors.card,
  },
  themeLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' },

  connNote: {
    ...type.caption,
    color: colors.faint,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
