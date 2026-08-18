import { Platform } from 'react-native';
import { incomingCallBridge } from '../lib/incomingCallBridge';

/**
 * iOS CallKit — утасны жинхэнэ дуудлагын дэлгэц.
 *
 * Android дээр бүтэн дэлгэцийн мэдэгдэл гаргаж болдог бол iOS дээр тийм
 * боломж БАЙХГҮЙ. Түгжээтэй дэлгэц дээр дуудлага гаргах цорын ганц зам нь
 * CallKit бөгөөд түүнийг зөвхөн PushKit-ийн VoIP push сэрээж чадна.
 *
 * ⚠️ PENDING EXTERNAL CONFIG — дараах зүйлс тохируулагдтал iOS дээр
 *    ТҮГЖЭЭТЭЙ үед дуудлага ирэхгүй (апп нээлттэй үед ажиллана):
 *      1. Apple Developer дээр VoIP Services сертификат үүсгэх
 *      2. `com.apple.developer.pushkit.unrestricted-voip` entitlement
 *      3. Тэр сертификатыг Firebase / APNs руу байршуулах
 *      4. call-notify Edge Function дотор APNs VoIP илгээх хэсгийг идэвхжүүлэх
 *
 *    Эдгээрийг хийхээс өмнө "iOS дээр бэлэн" гэж хэлэх боломжгүй.
 */

let RNCallKeep = null;
let loadError = null;
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    // eslint-disable-next-line global-require
    RNCallKeep = require('react-native-callkeep').default;
  } catch (e) {
    loadError = e?.message || String(e);
    RNCallKeep = null;
  }
}

let ready = false;
/**
 * `setup()` бүтэлгүйтсэн шалтгаан.
 *
 * ⚠️ Урьд нь `catch (e) { ready = false }` гэж алдааг ХАЯДАГ байсан тул
 *    "системийн дуудлагын дэлгэц яагаад гарахгүй байна" гэдэг мөрдөх
 *    боломжгүй байв. Одоо оношилгоонд харагдана.
 */
let setupError = null;
/** Утасны "дуудлагын данс" идэвхтэй эсэх (Android Telecom). */
let phoneAccountEnabled = null;
const activeUuids = new Map(); // callId -> uuid

/**
 * Системийн дуудлагын дэлгэц ашиглах боломжтой эсэх.
 *
 * ⚠️ ӨӨРЧЛӨЛТ: урьд нь ЗӨВХӨН iOS дээр асаадаг байсан. Гэтэл
 *    `react-native-callkeep` нь Android дээр ч ажилладаг — тэнд
 *    Telecom/ConnectionService-ээр дамжуулж УТАСНЫ ЖИНХЭНЭ дуудлагын
 *    дэлгэцийг гаргадаг. Viber, WhatsApp яг үүнийг ашигладаг.
 *
 *    Шаардлагатай зүйлс аль хэдийн бэлэн байсан:
 *      • MANAGE_OWN_CALLS, READ_PHONE_STATE зөвшөөрөл — манифестэд
 *      • io.wazo.callkeep.VoiceConnectionService — манифестэд
 *    Зөвхөн JS тал нь хаалттай байв.
 */
/**
 * Android дээр Telecom/ConnectionService замыг АШИГЛАХГҮЙ.
 *
 * ⚠️ ЭНЭ НЬ АППЫГ УНАГААДАГ — v1.1.7-д асаасны дараа "Gennetex ERP
 *    stopped" гарч, дуудлага ирэхэд апп бүхэлдээ хаагддаг болсон.
 *
 * ШАЛТГААН (react-native-callkeep 4.3.16, RNCallKeepModule.java):
 *   • мөр 1195: `hasPhoneAccount()` нь selfManaged горимд ҮРГЭЛЖ `true`
 *     буцаадаг тул мөр 448 дахь хамгаалалт юу ч хийхгүй.
 *   • мөр 466: `telecomManager.addNewIncomingCall(handle, extras)` нь
 *     try/catch-гүй. Telecom нь бүртгэгдээгүй/буруу handle дээр
 *     `SecurityException` шиднэ.
 *   • мөр 456: дугаарыг `Uri.fromParts("tel", number, null)` болгодог.
 *     Бид тийш нь UUID дамжуулдаг байсан — `tel:` схемд тоо биш утга.
 *   `@ReactMethod` дотор баригдаагүй exception нь JS try/catch-д
 *   БАРИГДАХГҮЙ, процессыг шууд унагана.
 *
 * Android дээр бүтэн дэлгэцийн мэдэгдлийн зам (нөөц зам) найдвартай
 * ажилладаг тул түүнийг ашиглана. iOS дээр CallKit нь цорын ганц зам
 * учир хэвээр үлдэнэ.
 */
const ANDROID_TELECOM_ENABLED = false;

export function isCallKitAvailable() {
  if (Platform.OS === 'android' && !ANDROID_TELECOM_ENABLED) return false;
  return !!RNCallKeep;
}

export function getCallKeepDiagnostics() {
  return {
    platform: Platform.OS,
    moduleLoaded: !!RNCallKeep,
    ready,
    phoneAccountEnabled,
    error: loadError || setupError,
  };
}

/**
 * Утасны "дуудлагын данс" (phone account) идэвхтэй эсэхийг шалгана.
 *
 * Android Telecom нь аппыг дуудлагын данс болгож бүртгэдэг. Зарим
 * үйлдвэрлэгч дээр тэр данс АНХНААСАА унтраалттай ирдэг — тэр үед
 * `displayIncomingCall` дуудагдсан ч дэлгэц ГАРАХГҮЙ, алдаа ч гарахгүй.
 */
export async function refreshPhoneAccountState() {
  if (!isCallKitAvailable() || Platform.OS !== 'android') return null;
  try {
    phoneAccountEnabled = await RNCallKeep.checkPhoneAccountEnabled();
  } catch (e) {
    phoneAccountEnabled = null;
  }
  return phoneAccountEnabled;
}

/** Дуудлагын дансны тохиргоог нээнэ — хэрэглэгч гараар асаана. */
export function openPhoneAccountSettings() {
  if (!RNCallKeep || Platform.OS !== 'android') return false;
  try {
    RNCallKeep.openPhoneAccounts();
    return true;
  } catch (e) {
    return false;
  }
}

/** CallKit-ийг нэг л удаа тохируулна. */
export async function setupCallKit() {
  if (!isCallKitAvailable() || ready) return ready;
  try {
    await RNCallKeep.setup({
      ios: {
        appName: 'Gennetex ERP',
        supportsVideo: true,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: true,
      },
      android: {
        alertTitle: 'Дуудлагын зөвшөөрөл',
        alertDescription: 'Дуудлага хүлээн авахын тулд Gennetex ERP-д зөвшөөрөл өгнө үү.',
        cancelButton: 'Болих',
        okButton: 'За',
        // `selfManaged` — апп өөрөө дуудлагаа удирдана (Viber, WhatsApp-тай
        // адил). Ингэснээр хэрэглэгч утасны тохиргооноос "дуудлагын данс"
        // сонгох шаардлагагүй, системийн дуудлагын дэлгэц шууд гарна.
        selfManaged: true,
        foregroundService: {
          channelId: 'gennetex_call_service',
          channelName: 'Дуудлага',
          notificationTitle: 'Дуудлага үргэлжилж байна',
        },
      },
    });
    RNCallKeep.setAvailable(true);
    registerListeners();
    ready = true;
    setupError = null;
    refreshPhoneAccountState();
  } catch (e) {
    ready = false;
    setupError = e?.message || String(e);
  }
  return ready;
}

function findCallId(uuid) {
  for (const [callId, u] of activeUuids.entries()) {
    if (u === uuid) return callId;
  }
  return null;
}

function registerListeners() {
  // Хэрэглэгч CallKit дэлгэц дээр "Хариулах" дарлаа
  RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
    const callId = findCallId(callUUID);
    if (callId) incomingCallBridge.emitAnswer({ callId, callUUID });
  });

  // "Таслах" эсвэл дуудлага дуусав
  RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
    const callId = findCallId(callUUID);
    activeUuids.delete(callId);
    if (callId) incomingCallBridge.emitDecline({ callId, callUUID });
  });

  // Системийн микрофоны хяналт — CallKit дээрх mute нь апп-тай синк байх ёстой
  RNCallKeep.addEventListener('didPerformSetMutedCallAction', () => {});
}

/**
 * Ирж буй дуудлагыг CallKit-ээр харуулна.
 *
 * `callId` нь UUID тул CallKit-д шууд өгч болно — тусад нь буулгалт
 * хийх шаардлагагүй, ингэснээр хоёр талын ID үргэлж таарна.
 */
/**
 * Android-ийн Telecom нь ЖИНХЭНЭ UUID шаарддаг. Манай дуудлагын id нь
 * заримдаа `tmp_1712...` хэлбэртэй байдаг тул тэрийг UUID болгож хувиргана.
 */
function toUuid(id) {
  const raw = String(id || '');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return raw;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  const hex = (n) => Math.abs(n).toString(16).padStart(8, '0').slice(0, 8);
  const a = hex(h);
  const b = hex(h * 7 + raw.length);
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-8${a.slice(0, 3)}-${a}${b.slice(0, 4)}`;
}

export function displayIncomingCallKit(call) {
  if (!isCallKitAvailable() || !ready || !call?.id) return false;

  const uuid = toUuid(call.id);
  activeUuids.set(String(call.id), uuid);
  try {
    // ⚠️ `number` нь native талдаа `Uri.fromParts("tel", number, null)`
    //    болж хувирдаг. UUID зэрэг тоо биш утга өгвөл Telecom алдаа
    //    шидэж, аппыг унагана. Тиймээс зөвхөн цифр үлдээнэ.
    const digits = String(call.caller_id || '').replace(/\D/g, '').slice(-15);
    RNCallKeep.displayIncomingCall(
      uuid,
      digits || '0000000000',
      call.caller_name || 'Ажилтан',
      'generic',
      call.type === 'video'
    );
    return true;
  } catch (e) {
    activeUuids.delete(String(call.id));
    return false;
  }
}

/** Дуудлага өөр шалтгаанаар дууссан үед CallKit дэлгэцийг хаана. */
export function endCallKit(callId) {
  if (!isCallKitAvailable() || !ready) return;
  const uuid = activeUuids.get(String(callId));
  try {
    if (uuid) RNCallKeep.endCall(uuid);
    else RNCallKeep.endAllCalls();
  } catch (e) {}
  activeUuids.delete(String(callId));
}

export function endAllCallKit() {
  if (!isCallKitAvailable() || !ready) return;
  try {
    RNCallKeep.endAllCalls();
  } catch (e) {}
  activeUuids.clear();
}
