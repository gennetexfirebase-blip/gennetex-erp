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
export function isCallKitAvailable() {
  return !!RNCallKeep;
}

export function getCallKeepDiagnostics() {
  return { platform: Platform.OS, moduleLoaded: !!RNCallKeep, ready, error: loadError };
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
  } catch (e) {
    ready = false;
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
    RNCallKeep.displayIncomingCall(
      uuid,
      String(call.caller_id || 'gennetex'),
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
