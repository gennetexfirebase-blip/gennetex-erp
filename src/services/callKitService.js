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
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line global-require
    RNCallKeep = require('react-native-callkeep').default;
  } catch (e) {
    RNCallKeep = null;
  }
}

let ready = false;
const activeUuids = new Map(); // callId -> uuid

export function isCallKitAvailable() {
  return Platform.OS === 'ios' && !!RNCallKeep;
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
      android: { alertTitle: '', alertDescription: '', cancelButton: '', okButton: '' },
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
export function displayIncomingCallKit(call) {
  if (!isCallKitAvailable() || !ready || !call?.id) return false;
  const uuid = String(call.id);
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
