import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { uploadAvatar } from '../services/attendanceService';
import {
  getPushDiagnostics,
  enablePushForUser,
  sendPushToUser,
} from '../services/notificationService';
import {
  getIncomingCallDiagnostics,
  showNativeIncomingCall,
  openFullScreenIntentSettings,
  openPhoneAccountSettings,
  refreshPhoneAccountState,
} from '../services/nativeIncomingCallService';
import {
  getLocationDiagnostics,
  openAppSettings,
  startTracking,
  trackingProblemText,
} from '../services/backgroundLocationService';
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
import { DEVELOPER_LABEL, SUPERADMIN_EMAIL, HAS_DEVELOPER_EMAIL } from '../lib/developerConfig';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

const THEME_OPTIONS = [
  { key: 'light', label: 'Цайвар', icon: '☀' },
  { key: 'dark', label: 'Бараан', icon: '☾' },
  { key: 'system', label: 'Систем', icon: '⚙' },
];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { colors, gradients, mode, setMode } = useTheme();
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
        channelId: 'default',
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
    await refreshPhoneAccountState();
    const d = getIncomingCallDiagnostics();
    const lines = [
      `Платформ: ${d.platform}${d.androidVersion ? ` (API ${d.androidVersion})` : ''}`,
      `Системийн дуудлага: ${d.systemCall ? (d.systemCallReady ? 'бэлэн' : 'тохируулагдаагүй') : 'алга'}`,
      `Дуудлагын данс: ${
        d.phoneAccountEnabled === true
          ? 'идэвхтэй'
          : d.phoneAccountEnabled === false
          ? 'УНТРААЛТТАЙ'
          : 'тодорхойгүй'
      }`,
      `Нөөц дэлгэц: ${d.canDisplay ? 'боломжтой' : 'боломжгүй'}`,
      `Сонсогч бэлэн: ${d.listenersReady ? 'тийм' : 'үгүй'}`,
    ];
    if (d.systemCallError) lines.push(`⚠️ Систем: ${d.systemCallError}`);
    if (d.error) lines.push('', `⚠️ ${d.error}`);

    if (d.phoneAccountEnabled === false) {
      lines.push('', '⚠️ Дуудлагын данс унтраалттай тул системийн дуудлагын дэлгэц гарахгүй.');
    }
    if (Number(d.androidVersion) >= 34) {
      lines.push(
        '',
        'ℹ️ Android 14+ дээр "Бүтэн дэлгэцийн мэдэгдэл" зөвшөөрөл ХААЛТТАЙ ирдэг. ' +
          'Хаалттай үед дуудлага бүтэн дэлгэцийн оронд энгийн мэдэгдэл болж харагдана.'
      );
    }

    const buttons = [
      { text: 'Хаах', style: 'cancel' },
      { text: 'Бүтэн дэлгэц', onPress: () => openFullScreenIntentSettings() },
    ];
    if (d.phoneAccountEnabled === false) {
      buttons.push({ text: 'Дуудлагын данс', onPress: () => openPhoneAccountSettings() });
    }
    if (d.canDisplay || d.systemCall) {
      buttons.push({
        text: 'Тест (3 сек)',
        onPress: () => {
          setTimeout(() => {
            showNativeIncomingCall({
              id: `test_${Date.now()}`,
              caller_name: 'Тест дуудлага',
              type: 'audio',
            });
          }, 3000);
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
    const lines = [
      `Байршлын үйлчилгээ: ${d.servicesEnabled ? 'асаалттай' : 'унтраалттай'}`,
      `Апп ашиглаж байхад: ${d.foreground}`,
      `Байнга (арын): ${d.background}`,
      `Хяналт идэвхтэй: ${d.tracking ? 'тийм' : 'үгүй'}`,
    ];
    if (!bgOk) {
      lines.push('', `⚠️ ${trackingProblemText('no-background-permission')}`);
    } else if (!d.tracking) {
      lines.push('', '⚠️ Зөвшөөрөл бий ч хяналт эхлээгүй байна.');
    } else {
      lines.push('', '✅ Апп хаалттай үед ч байршил илгээгдэнэ.');
    }

    Alert.alert('Байршлын шалгалт', lines.join('\n'), [
      { text: 'Хаах', style: 'cancel' },
      ...(bgOk
        ? [{ text: 'Дахин эхлүүлэх', onPress: () => startTracking(authProfile).catch(() => {}) }]
        : [{ text: 'Тохиргоо нээх', onPress: () => openAppSettings() }]),
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
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
      {/* --- Брэнд өнгөт толгой --- */}
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={changeAvatar}
              disabled={uploading || !canEditAvatar}
              accessibilityRole={canEditAvatar ? 'button' : undefined}
              accessibilityLabel={canEditAvatar ? 'Профайл зураг солих' : undefined}
            >
              <View style={styles.avatar}>
                {uploading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              {canEditAvatar && !uploading ? (
                <View style={styles.camBadge}>
                  <Text style={styles.camIcon}>✎</Text>
                </View>
              ) : null}
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
              <Text style={styles.headerEmail} numberOfLines={1}>{email}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>
                  {roleLabel(authProfile?.role || 'employee')}
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* --- Идэвхтэй аялал --- */}
        {withDriver ? (
          <>
            <GroupLabel>Хамт яваа аялал</GroupLabel>
            <ListGroup>
              <ListRow icon="◉" label="Жолооч" value={withDriver.driver_name || '—'} chevron={false} />
              <ListRow
                icon="▤"
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
              <ListGroup>
                <ListRow icon="◧" label="Нэр" value={authProfile.name || '—'} chevron={false} />
                <ListRow icon="▣" label="Албан тушаал" value={authProfile.position || '—'} chevron={false} />
                <ListRow icon="✆" label="Утас" value={authProfile.phone || '—'} chevron={false} />
                <ListRow
                  icon="◆"
                  label="Эрх"
                  value={roleLabel(authProfile?.role || 'employee')}
                  chevron={false}
                />
                {canEdit ? <ListRow icon="✎" label="Мэдээлэл засах" onPress={startEdit} /> : null}
              </ListGroup>
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

        {/* --- QR --- */}
        {authProfile && !isAdmin ? (
          <>
            <GroupLabel>Мэдэгдэл</GroupLabel>
            <ListGroup>
              <ListRow
                icon="🔔"
                label={pushChecking ? 'Шалгаж байна…' : 'Мэдэгдэл ирэхгүй бол шалгах'}
                onPress={pushChecking ? undefined : checkPush}
              />
              <ListRow
                icon="📨"
                label={pushTesting ? 'Илгээж байна…' : 'Тест мэдэгдэл илгээх'}
                onPress={pushTesting ? undefined : testPush}
              />
              <ListRow
                icon="📞"
                label="Ирэх дуудлагын дэлгэц шалгах"
                onPress={testIncomingCall}
              />
              <ListRow
                icon="📍"
                label="Байршил хяналт шалгах"
                onPress={checkLocation}
              />
            </ListGroup>

            <GroupLabel>Гүйцэтгэл</GroupLabel>
            <ListGroup>
              {MODE_OPTIONS.map((opt) => (
                <ListRow
                  key={opt.key}
                  icon={perf.mode === opt.key ? '◉' : '○'}
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
                icon="▦"
                label={showQr ? 'QR-ыг нуух' : 'QR-ыг харуулах'}
                onPress={() => setShowQr((v) => !v)}
                chevron={false}
                right={<Text style={styles.toggleCaret}>{showQr ? '⌃' : '⌄'}</Text>}
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

        {/* --- Харагдац --- */}
        <GroupLabel>Харагдац</GroupLabel>
        <View style={styles.themeCard}>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = mode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    styles.themeOption,
                    active && styles.themeOptionActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setMode(opt.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={opt.label}
                >
                  <Text style={[styles.themeIcon, active && styles.themeIconActive]}>{opt.icon}</Text>
                  <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* --- Тусламж --- */}
        {authProfile ? (
          <>
            <GroupLabel>{DEVELOPER_LABEL}тэй холбогдох</GroupLabel>
            <ListGroup>
              <ListRow
                icon="✉"
                label="Холбоо барих"
                value={HAS_DEVELOPER_EMAIL ? SUPERADMIN_EMAIL : 'Тохируулаагүй'}
                chevron={false}
              />
              <ListRow
                icon="➤"
                label="Мэдээ илгээх"
                onPress={() => navigation.navigate('DeveloperContact')}
              />
              {isSuperAdmin ? (
                <ListRow
                  icon="▼"
                  label="Над руу ирсэн мэдээ"
                  onPress={() => navigation.navigate('DeveloperInbox')}
                />
              ) : null}
            </ListGroup>
          </>
        ) : null}

        {/* --- Гарах --- */}
        <View style={{ marginTop: spacing.xl }}>
          <ListGroup>
            <ListRow icon="⏻" label="Системээс гарах" danger onPress={confirmSignOut} chevron={false} />
          </ListGroup>
        </View>

        <Text style={styles.connNote}>
          {isCloud ? 'Supabase холбогдсон' : 'Локал горим'}
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  // Брэнд градиент дээрх текст — хоёр горимд ижил тул цагаан тогтмол.
  avatarLetter: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  camBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  camIcon: { fontSize: 13, color: '#201e1f' },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { ...type.h2, color: '#ffffff' },
  headerEmail: { ...type.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  rolePillText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

  body: { padding: spacing.lg, paddingBottom: 120 },

  editCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  editActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },

  lockedNote: {
    ...type.caption,
    color: colors.textFaint,
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
    lineHeight: 17,
  },

  toggleCaret: { color: colors.textFaint, fontSize: 14 },
  qrBox: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  perfHint: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  qrHint: {
    ...type.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 17,
  },

  themeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  themeOptionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary + '55' },
  themeIcon: { fontSize: 18, color: colors.textMuted },
  themeIconActive: { color: colors.primary },
  themeLabel: { ...type.caption, color: colors.textMuted },
  themeLabelActive: { color: colors.primary, fontWeight: '700' },

  connNote: {
    ...type.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
