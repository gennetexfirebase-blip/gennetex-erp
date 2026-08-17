import { Platform } from 'react-native';
import { isExpoGo } from '../lib/runtimeEnv';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import * as deviceTokens from './deviceTokenService';

/**
 * Сүүлийн бүртгэлийн алдаа — оношилгооны дэлгэц уншина.
 *
 * ⚠️ Урьд нь бүртгэл амжилтгүй болоход хаана ч мэдэгддэггүй байсан
 *    (дуудагч тал `try/catch`-аар нууж байв). Тиймээс "token яагаад
 *    үүсэхгүй байна вэ" гэдэг харагдахгүй байлаа.
 */
let lastPushError = null;

export function getLastPushError() {
  return lastPushError;
}

export const CALLS_CHANNEL = 'calls';
const TOKEN_KEY = '@gennetex_fcm_token_v1';
const DEVICE_KEY = '@gennetex_push_device_v1';

/**
 * Firebase Messaging — МОДУЛЬ (modular) API.
 *
 * ⚠️ ЭНЭ БАЙСАН ГОЛ АЛДАА:
 *   Урьд нь `require('@react-native-firebase/messaging').default()` гэж
 *   дууддаг байв. React Native Firebase v22-оос эхлэн нэрийн зайн
 *   (namespaced) API-г хассан бөгөөд v26 дээр `default` export
 *   БҮРМӨСӨН БАЙХГҮЙ. Тиймээс `.default` нь `undefined` болж, дуудахад
 *   TypeError шидэж, catch дотор "модуль байхгүй" гэж дүгнэгдэж байлаа.
 *
 *   Үр дагавар: FCM token ХЭЗЭЭ Ч үүсдэггүй → `push_tokens` хоосон →
 *   апп хаалттай үед мэдэгдэл, дуудлага огт ирдэггүй байв.
 *
 * Одоо зөв API-г ашиглана: `getMessaging()` + чөлөөт функцүүд.
 */
let messagingCache;

function nativeMessaging() {
  if (isExpoGo) return null;
  if (messagingCache !== undefined) return messagingCache;
  try {
    const mod = require('@react-native-firebase/messaging');
    const instance = mod.getMessaging();
    messagingCache = {
      instance,
      registerDeviceForRemoteMessages: () => mod.registerDeviceForRemoteMessages(instance),
      requestPermission: () => mod.requestPermission(instance),
      getToken: () => mod.getToken(instance),
      onTokenRefresh: (fn) => mod.onTokenRefresh(instance, fn),
      onMessage: (fn) => mod.onMessage(instance, fn),
    };
  } catch (error) {
    lastPushError = `Firebase Messaging ачаалагдсангүй: ${error?.message || error}`;
    console.warn('[push] Firebase Messaging native module unavailable:', error?.message || error);
    messagingCache = null;
  }
  return messagingCache;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type;
    const isCall = type === 'call';
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: isCall ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

export async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  const channels = [
    ['default', 'Ерөнхий мэдэгдэл', Notifications.AndroidImportance.DEFAULT],
    ['messages', 'Мессеж', Notifications.AndroidImportance.HIGH],
    ['chat', 'Чат мессеж', Notifications.AndroidImportance.HIGH],
    ['orders', 'Захиалга', Notifications.AndroidImportance.HIGH],
    ['payments', 'Төлбөр', Notifications.AndroidImportance.HIGH],
    ['urgent', 'Яаралтай', Notifications.AndroidImportance.MAX],
    ['feed', 'Пост / сэтгэгдэл', Notifications.AndroidImportance.HIGH],
  ];
  await Promise.all(channels.map(([id, name, importance]) => Notifications.setNotificationChannelAsync(id, {
    name,
    importance,
    vibrationPattern: importance === Notifications.AndroidImportance.MAX ? [0, 500, 180, 500] : [0, 200, 120, 200],
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  })));
  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Видео дуудлага',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 800, 400, 800, 400, 800],
    sound: 'incoming_call.wav',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function getDeviceId() {
  try {
    if (Platform.OS === 'android') return Application.getAndroidId();
    if (Platform.OS === 'ios') return await Application.getIosIdForVendorAsync();
  } catch (error) {
    console.warn('[push] device id unavailable:', error?.message || error);
  }
  return null;
}

// Firebase Cloud Messaging token — Expo Go биш, Development/Production build дээр.
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  if (isExpoGo) {
    console.info('[push] Expo Go remote push дэмжихгүй. Development Build ашиглана уу.');
    return null;
  }

  await ensureChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const messaging = nativeMessaging();
  if (!messaging) return null;
  try {
    await messaging.registerDeviceForRemoteMessages();
    if (Platform.OS === 'ios') await messaging.requestPermission();
    return await messaging.getToken();
  } catch (error) {
    console.warn('[push] FCM token авч чадсангүй:', error?.message || error);
    return null;
  }
}

/**
 * Мэдэгдлийн оношилгоо — "яагаад ирэхгүй байна вэ" гэдгийг ХАРУУЛНА.
 *
 * Push ирэхгүй байх шалтгаан олон давхар: зөвшөөрөл, Firebase тохиргоо,
 * token үүсэх, түүнийг санд хадгалах. Аль нь тасарсныг гаднаас таах
 * боломжгүй тул алхам бүрийг шалгаж, ойлгомжтой хариу буцаана.
 */
export async function getPushDiagnostics(userId) {
  const out = {
    environment: isExpoGo ? 'Expo Go' : 'APK / development build',
    remoteSupported: !isExpoGo && Platform.OS !== 'web',
    isRealDevice: !!Device.isDevice,
    permission: 'тодорхойгүй',
    firebaseModule: false,
    token: null,
    savedInDb: false,
    problem: null,
  };

  try {
    const { status } = await Notifications.getPermissionsAsync();
    out.permission = status;
  } catch (e) {
    out.permission = 'алдаа';
  }

  if (!out.isRealDevice) {
    out.problem = 'Симулятор дээр push ажиллахгүй.';
    return out;
  }
  if (isExpoGo) {
    out.problem = 'Expo Go нь алсын push дэмжихгүй. Апп нээлттэй үед л мэдэгдэл харагдана.';
    return out;
  }
  if (out.permission !== 'granted') {
    out.problem = 'Мэдэгдлийн зөвшөөрөл өгөөгүй. Тохиргоо → Апп → Мэдэгдэл-ээс асаана уу.';
    return out;
  }

  const messaging = nativeMessaging();
  out.firebaseModule = !!messaging;
  if (!messaging) {
    // Жинхэнэ алдааг харуулна — "шинэ APK суулга" гэсэн ерөнхий зөвлөгөө
    // буруу мөрөөр хөөж, цаг алдахад хүргэдэг байв.
    out.problem = lastPushError || 'Firebase модуль ачаалагдсангүй.';
    return out;
  }

  try {
    await messaging.registerDeviceForRemoteMessages();
    out.token = await messaging.getToken();
  } catch (e) {
    out.problem = `Token авч чадсангүй: ${e?.message || e}`;
    return out;
  }
  if (!out.token) {
    out.problem = 'Firebase token хоосон буцлаа. google-services.json тохиргоог шалгана уу.';
    return out;
  }

  try {
    const { data } = await supabase
      .from('push_tokens')
      .select('token, active')
      .eq('user_id', userId)
      .eq('token', out.token)
      .maybeSingle();
    out.savedInDb = !!data?.active;
    if (!out.savedInDb) out.problem = 'Token үүссэн ч санд хадгалагдаагүй байна.';
  } catch (e) {
    out.problem = `Санд шалгахад алдаа: ${e?.message || e}`;
  }

  // Автомат бүртгэлийн үед гарсан алдаа байвал түүнийг давуу гэж үзнэ —
  // жинхэнэ шалтгаан ихэвчлэн тэнд байдаг.
  if (!out.problem && lastPushError) out.problem = lastPushError;

  return out;
}

export async function enablePushForUser(userId) {
  let token = null;
  try {
    token = await registerForPushNotificationsAsync();
  } catch (e) {
    lastPushError = `Token авахад алдаа: ${e?.message || e}`;
    return { ok: false, reason: 'token', error: lastPushError };
  }

  if (!token) {
    // Шалтгааныг ялгаж хэлнэ — бүгдийг "permission" гэж нэрлэх нь
    // буруу мөрөөр хөөж, цаг алдахад хүргэдэг.
    if (isExpoGo) lastPushError = 'Expo Go нь алсын push дэмжихгүй.';
    else if (!Device.isDevice) lastPushError = 'Симулятор дээр push ажиллахгүй.';
    else lastPushError = 'Зөвшөөрөл өгөөгүй эсвэл Firebase тохиргоо дутуу.';
    return { ok: false, reason: 'permission', error: lastPushError };
  }

  try {
    await savePushToken(userId, token);
  } catch (e) {
    lastPushError = `Token санд хадгалж чадсангүй: ${e?.message || e}`;
    return { ok: false, reason: 'save', error: lastPushError };
  }

  lastPushError = null;
  return { ok: true, token };
}

export async function savePushToken(userId, token) {
  if (!userId || !token) return;
  const deviceId = await getDeviceId();
  const { error } = await supabase.from('push_tokens').upsert({
    user_id: userId,
    token,
    platform: Platform.OS,
    device_id: deviceId,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token' });
  if (error) throw error;
  await AsyncStorage.multiSet([[TOKEN_KEY, token], [DEVICE_KEY, deviceId || '']]);

  // Дуудлагын төхөөрөмжийн бүртгэл. `push_tokens` нь ерөнхий мэдэгдэлд,
  // `device_tokens` нь дуудлагад — сүүлийнх нь iOS-ийн VoIP token-ийг
  // тусад нь хадгалах шаардлагатай тул салангид. Энд хамт бичих нь
  // хоёр газар мартагдахаас сэргийлнэ.
  try {
    await deviceTokens.registerDevice(userId, { fcmToken: token });
  } catch (e) {
    console.warn('[push] дуудлагын төхөөрөмж бүртгэгдсэнгүй:', e?.message || e);
  }
}

export async function removePushToken(userId, token) {
  const savedToken = token || await AsyncStorage.getItem(TOKEN_KEY);
  if (!userId || !savedToken || !supabase) return;
  const { error } = await supabase.from('push_tokens').update({ active: false, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('token', savedToken);
  if (error) console.warn('[push] token deactivate failed:', error.message);
  await deviceTokens.deactivateDevice(userId).catch(() => {});
  await AsyncStorage.multiRemove([TOKEN_KEY, DEVICE_KEY]);
}

export function listenForTokenRefresh(userId, onError) {
  const messaging = nativeMessaging();
  if (!messaging || !userId) return () => {};
  return messaging.onTokenRefresh(async (token) => {
    try { await savePushToken(userId, token); } catch (error) { onError?.(error); }
  });
}

export function listenForForegroundFcm(handler) {
  const messaging = nativeMessaging();
  if (!messaging) return () => {};
  return messaging.onMessage(handler);
}

function normalizeNotification(payload = {}) {
  return {
    title: String(payload.title || 'Gennetex ERP'),
    body: String(payload.body || ''),
    type: String(payload.data?.type || payload.type || 'system'),
    screen: payload.data?.screen || payload.screen,
    entityId: payload.data?.entityId || payload.entityId,
    data: { ...(payload.data || {}) },
    channelId: payload.channelId || 'default',
    sound: payload.sound || 'default',
  };
}

async function invokePush(audience, notification) {
  if (!supabase) return;
  const { data, error } = await supabase.functions.invoke('send-push', { body: { audience, notification: normalizeNotification(notification) } });
  if (error) throw error;
  return data;
}

export const sendPushToUser = (userId, notification) => invokePush({ kind: 'user', userId }, notification);
export const sendPushToUsers = (userIds, notification) => invokePush({ kind: 'users', userIds }, notification);
export const sendPushToAll = (notification) => invokePush({ kind: 'all' }, notification);
export const sendPushToRole = (role, notification) => invokePush({ kind: 'role', role }, notification);

export async function showLocalNotification({ title, body, data, channelId }) {
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: channelId || 'chat'} : {}),
    },
    trigger: null,
  });
}

export async function notifyUsers(userIds, payload) {
  try { await sendPushToUsers(userIds, payload); } catch (e) { console.warn('[push] users:', e?.message || e); }
}

export async function notifyAdmins(payload) {
  try { await sendPushToRole('admin', { channelId: 'messages', ...payload }); } catch (e) { console.warn('[push] admins:', e?.message || e); }
}

export async function notifySuperadmins(payload) {
  try { await sendPushToRole('superadmin', { channelId: 'messages', ...payload }); } catch (e) { console.warn('[push] superadmins:', e?.message || e); }
}

/** Ажилд орох шинэ анкет — админд */
export async function notifyApplicationToAdmins({ name, position, phone, applicationId }) {
  const details = [position, phone].filter(Boolean).join(' · ');
  await notifyAdmins({
    title: 'Ажлын байрны шинэ анкет',
    body: `${name || 'Нэр байхгүй'}${details ? ` · ${details}` : ''}`.slice(0, 200),
    data: { type: 'job_application', applicationId: String(applicationId || '') },
    channelId: 'chat',
    priority: 'high',
  });
}

/** Шинэ хөдөлмөрийн гэрээ — ажилтанд */
export async function notifyContractToEmployee(employeeId, { employeeName, position, contractId }) {
  if (!employeeId) return;
  await notifyUsers([employeeId], {
    title: 'Хөдөлмөрийн гэрээ ирлээ',
    body: `${employeeName || 'Танд'} гэрээ бэлэн боллоо${position ? ` · ${position}` : ''}. Уншиж гарын үсэг зурна уу.`,
    data: { type: 'job_contract', contractId: String(contractId || '') },
    channelId: 'chat',
    priority: 'high',
  });
}

/** Гэрээнд гарын үсэг зурсан — админд */
export async function notifyContractSignedToAdmins({ employeeName, contractId }) {
  await notifyAdmins({
    title: 'Гэрээнд гарын үсэг зурлаа',
    body: `${employeeName || 'Ажилтан'} хөдөлмөрийн гэрээндээ гарын үсэг зурж баталгаажууллаа.`,
    data: { type: 'job_contract_signed', contractId: String(contractId || '') },
    channelId: 'chat',
    priority: 'high',
  });
}

/** Шинэ төхөөрөмжөөр нэвтрэх хүсэлт — зөвхөн системийн админд */
export async function notifyDeviceRequestToSuperadmins({ userName, deviceModel, publicIp, localIp, mac, deviceId }) {
  const info = [deviceModel, publicIp ? `IP: ${publicIp}` : null, mac ? `MAC: ${mac}` : null]
    .filter(Boolean)
    .join(' · ');
  await notifySuperadmins({
    title: 'Шинэ төхөөрөмжийн зөвшөөрөл',
    body: `${userName || 'Ажилтан'} шинэ төхөөрөмжөөр нэвтрэхийг хүсэж байна. ${info}`.slice(0, 220),
    data: { type: 'device_approval', deviceId: String(deviceId || '') },
    channelId: 'chat',
    priority: 'high',
  });
}

/** Төхөөрөмжийн шийдвэр — хэрэглэгчид */
export async function notifyDeviceDecisionToUser(userId, { status }) {
  if (!userId) return;
  const approved = status === 'approved';
  await notifyUsers([userId], {
    title: approved ? 'Төхөөрөмж зөвшөөрөгдлөө' : 'Төхөөрөмж татгалзагдлаа',
    body: approved
      ? 'Хөгжүүлэгч таны төхөөрөмжийг зөвшөөрлөө. Апп руу орж болно.'
      : 'Хөгжүүлэгч таны шинэ төхөөрөмжөөр нэвтрэхийг татгалзлаа.',
    data: { type: 'device_decision', status: String(status || '') },
    channelId: 'chat',
    priority: 'high',
  });
}

// Чат мессеж — бусад гишүүдэд push
export async function notifyChatMembers(conversationId, senderId, { senderName, content, attachmentType }) {
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId);
  const recipients = (members || []).map((m) => m.user_id).filter((id) => id && id !== senderId);
  const preview =
    content ||
    (attachmentType === 'image'
      ? 'Зураг илгээлээ'
      : attachmentType === 'video'
      ? 'Видео илгээлээ'
      : attachmentType === 'file'
      ? 'Файл илгээлээ'
      : 'Шинэ мессеж');
  await notifyUsers(recipients, {
    title: senderName || 'Чат',
    body: preview,
    data: { type: 'chat', room: conversationId, senderName },
    channelId: 'chat',
    priority: 'high',
  });
}

/** SLA хэтэрсэн — бүх инженерт яаралтай push */
export async function notifySlaExceededToEngineers(engineerIds, call) {
  const ids = [...new Set((engineerIds || []).filter(Boolean))];
  if (!ids.length || !call?.id) return;

  const kind = call.site_kind === 'baiguulga' ? 'Байгууллага' : 'Айл';
  const who = call.engineer ? `Жолооч: ${call.engineer} · ` : '';
  const where = [call.customer, call.address || call.problem].filter(Boolean).join(' · ');
  const body = `${who}${kind}: ${where || 'Дуудлага'}`.trim();

  await notifyUsers(ids, {
    title: '⚠️ SLA хэтэрсэн — яаралтай очно уу!',
    body,
    data: {
      type: 'service_call_sla',
      callId: call.id,
      siteKind: call.site_kind || 'ail',
    },
    channelId: CALLS_CHANNEL,
    priority: 'high',
  });
}

/** Инженерт шинэ үйлчилгээний дуудлага оноогдоход */
export async function notifyServiceCallAssigned(engineerId, { engineerName, customer, problem, phone, siteKind, callId }) {
  const name = engineerName || 'Ажилтан';
  const kind = siteKind === 'baiguulga' ? 'Байгууллага' : 'Айл';
  const details = [customer, problem, phone].filter(Boolean).join(' · ');
  await notifyUsers([engineerId], {
    title: `${name}, танд шинээр дуудлага ирлээ`,
    body: details ? `${kind}: ${details}` : `${kind} дээрх шинэ дуудлага`,
    data: { type: 'service_call', callId, siteKind: siteKind || 'ail' },
    channelId: 'chat',
    priority: 'high',
  });
}

// Видео дуудлага — ringtone + TTS push
export async function notifyIncomingCall(calleeId, { callerName, room, callId }) {
  const name = callerName || 'Ажилтан';
  await notifyUsers([calleeId], {
    title: `${name} залгаж байна`,
    body: 'Видео дуудлага — хариулахын тулд нээнэ үү',
    sound: 'incoming_call.wav',
    data: { type: 'call', room, callId, callerName: name },
    channelId: 'calls',
    priority: 'high',
  });
}

export async function notifyRemoteAttendance({ staffName, note }) {
  await notifyAdmins({
    title: 'Зайнаас ирцийн хүсэлт',
    body: `${staffName || 'Ажилтан'}: ${note || 'Зөвшөөрөл хүлээж байна'}`,
    data: { type: 'attendance_pending'},
  });
}

export async function notifyFeedbackToAdmins({ fromName, kind, preview, feedbackId, mentionedNames = [] }) {
  const mention = mentionedNames.length ? ` · ${mentionedNames.join(', ')}` : '';
  await notifyAdmins({
    title: `Ажилтан ${fromName || '—'} ${kind || 'гомдол'} ирлээ`,
    body: `${preview || ''}${mention}`.trim().slice(0, 200),
    data: { type: 'employee_feedback', feedbackId: String(feedbackId || '') },
    channelId: 'chat',
    priority: 'high',
  });
}

export async function notifyOffSiteCheckIn({ staffName, locationName, distanceM }) {
  const where = locationName ? `"${locationName}"-аас` : 'ажлын байршлаас';
  await notifyAdmins({
    title: 'Байршил зөрсөн ирц',
    body: `${staffName || 'Ажилтан'} ${where} ${distanceM != null ? `~${distanceM}м` : 'гадуур'} бүртгүүллээ`,
    data: { type: 'attendance_offsite'},
  });
}

export async function notifyShiftMissed({ staffName, shiftTime, locationName }) {
  await notifyAdmins({
    title: 'Хуваарийн байршилд байхгүй',
    body: `${staffName || 'Ажилтан'} ${shiftTime || ''} цагт ${locationName || 'ажлын газарт'} ирээгүй байна`,
    data: { type: 'shift_missed' },
  });
}

// ---------------------------------------------------------------------------
// Дутуу байсан мэдэгдлүүд
// ---------------------------------------------------------------------------
// Эдгээрийг үйлчилгээнүүд дуудаж байсан ч хэрэгжүүлээгүй байв. Дуудлага нь
// `try/catch` дотор байсан тул алдаа чимээгүй залгигдаж, УНАХГҮЙ ч
// МЭДЭГДЭЛ ОГТ ЯВДАГГҮЙ байв — админ чөлөөний хүсэлт ирснийг мэдэхгүй
// өнгөрдөг гэсэн үг.

/** Хөгжүүлэгч рүү ирсэн шинэ мессеж. */
export async function notifyDeveloperMessage({ fromName, subject, preview, messageId } = {}) {
  return sendPushToRole('superadmin', {
    title: `Шинэ мессеж: ${fromName || 'Ажилтан'}`,
    body: subject ? `${subject} — ${preview || ''}`.trim() : preview || 'Мессеж ирлээ',
    data: { type: 'admin', screen: 'DeveloperInbox', entityId: messageId },
    channelId: 'default',
  });
}

/** Чөлөөний хүсэлт — админуудад. */
export async function notifyLeaveRequestToAdmins({ userName, dateRange, reason, requestId } = {}) {
  return sendPushToRole('admin', {
    title: 'Чөлөөний хүсэл',
    body: `${userName || 'Ажилтан'} — ${dateRange || ''}${reason ? ` · ${reason}` : ''}`.trim(),
    data: { type: 'admin', screen: 'Notifications', entityId: requestId },
    channelId: 'default',
  });
}
