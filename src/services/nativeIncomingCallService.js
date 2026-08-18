import { Platform } from 'react-native';
import { incomingCallBridge } from '../lib/incomingCallBridge';
import {
  getCallKeepDiagnostics,
  isCallKitAvailable,
  setupCallKit,
  displayIncomingCallKit,
  endAllCallKit,
} from './callKitService';

let RNNotificationCall = null;
/**
 * Модуль ачаалахад гарсан алдаа — оношилгоонд харуулна.
 *
 * ⚠️ Урьд нь `catch (e) {}` дотор чимээгүй алга болдог байсан тул
 *    "яагаад дуудлагын дэлгэц гардаггүй юм бол" гэдэг хэзээ ч
 *    харагддаггүй байв.
 */
let loadError = null;

if (Platform.OS === 'android') {
  try {
    RNNotificationCall = require('react-native-full-screen-notification-incoming-call').default;
  } catch (e) {
    loadError = e?.message || String(e);
  }
}

export function getIncomingCallDiagnostics() {
  const ck = getCallKeepDiagnostics();
  return {
    platform: Platform.OS,
    // Системийн дуудлага (Telecom / CallKit) — Viber маягийн зам
    systemCall: ck.moduleLoaded,
    systemCallReady: ck.ready,
    systemCallError: ck.error,
    // Нөөц зам — бүтэн дэлгэцийн мэдэгдэл
    moduleLoaded: !!RNNotificationCall,
    canDisplay: !!RNNotificationCall?.displayNotification,
    listenersReady: initialized,
    error: loadError,
  };
}

let initialized = false;
const CHANNEL_ID = 'gennetex_incoming_call_v1';

/**
 * Системийн дуудлагын дэлгэц гаргах боломжтой эсэх.
 *
 * Android — бүтэн дэлгэцийн мэдэгдэл. iOS — CallKit. Хоёулаа байхгүй бол
 * апп доторх дэлгэцээ ашиглана.
 */
export function isNativeIncomingCallAvailable() {
  if (Platform.OS === 'android') return !!RNNotificationCall?.displayNotification;
  return isCallKitAvailable();
}

function parsePayload(raw) {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return {};
  }
}

function buildPayload(call) {
  return JSON.stringify({
    callId: String(call.id || ''),
    room: String(call.room || ''),
    callerId: String(call.caller_id || ''),
    callerName: String(call.caller_name || 'Ажилтан'),
    callType: call.type === 'video' ? 'video' : 'audio',
  });
}

/** Android — утасны системийн дуудлагын дэлгэц (түгжээтэй/background) */
export function showNativeIncomingCall(call) {
  if (!call) return false;

  /**
   * 1) СИСТЕМИЙН дуудлагын дэлгэц (iOS CallKit / Android Telecom).
   *    Viber, WhatsApp яг үүнийг ашигладаг: утасны жинхэнэ дуудлагын
   *    дэлгэц гарч, түгжээтэй дэлгэц дээр ч ажиллана, дуудлагын түүхэнд
   *    бүртгэгдэнэ. Нэмэлт зөвшөөрөл (full-screen intent) шаардахгүй.
   */
  if (isCallKitAvailable() && displayIncomingCallKit(call)) return true;

  // 2) НӨӨЦ: Android дээрх бүтэн дэлгэцийн мэдэгдэл.
  if (Platform.OS !== 'android') return false;
  if (!isNativeIncomingCallAvailable()) return false;
  const callId = String(call.id || `tmp_${Date.now()}`);
  const callerName = call.caller_name || 'Ажилтан';
  const isVideo = call.type === 'video';
  try {
    // 45 секунд — сервер тал ч мөн ийм хугацааны дараа `missed` тавьдаг.
    // Хоёрын хугацаа зөрвөл утас дуугарсаар байтал сервер дуудлагыг
    // дуусгасан байх эсвэл эсрэгээр болно.
    RNNotificationCall.displayNotification(callId, null, 45_000, {
      channelId: CHANNEL_ID,
      channelName: 'Дуудлага',
      notificationIcon: 'ic_launcher',
      notificationTitle: callerName,
      notificationBody: isVideo ? 'Видео дуудлага ирлээ' : 'Дуут дуудлага ирлээ',
      answerText: 'Хариулах',
      declineText: 'Татгалзах',
      notificationColor: '#16a34a',
      isVideo,
      payload: buildPayload({ ...call, id: callId }),
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** Push data-аас native дуудлага харуулах */
export function showNativeIncomingCallFromPush(data) {
  // `incoming_call` нь шинэ VoIP урсгал, `call` нь хуучин Jitsi урсгал.
  // Хуучин апп суулгасан утаснууд шинэчлэгдэх хүртэл хоёуланг таньна.
  if (!data || (data.type !== 'incoming_call' && data.type !== 'call')) return false;
  return showNativeIncomingCall({
    id: data.callId,
    room: data.room,
    caller_id: data.callerId,
    caller_name: data.callerName || 'Ажилтан',
    type: data.callType === 'video' ? 'video' : 'audio',
    status: 'ringing',
    created_at: new Date().toISOString(),
  });
}

export function hideNativeIncomingCall() {
  // Хоёр замыг ч хаана — аль нь ажилласан нь мэдэгдэхгүй байж болно.
  if (isCallKitAvailable()) endAllCallKit();
  if (Platform.OS !== 'android') return;
  if (!isNativeIncomingCallAvailable()) return;
  try {
    RNNotificationCall.hideNotification();
  } catch (e) {}
}

export function initNativeIncomingCallListeners() {
  if (initialized) return;

  // Системийн дуудлагыг эхлээд тохируулна. Android дээр энэ нь
  // ConnectionService-ийг бүртгэдэг — Viber маягийн дуудлагын дэлгэц.
  if (isCallKitAvailable()) {
    setupCallKit();
  }

  // ⚠️ Бүтэн дэлгэцийн сонсогчийг МӨН бүртгэнэ: CallKeep тохируулга
  //    бүтэхгүй бол (зарим OEM дээр тохиолддог) нөөц зам ажиллах ёстой.
  //    Урьд нь CallKeep байвал энд `return` хийж, нөөц замыг бүрмөсөн
  //    хааж байсан.
  if (Platform.OS !== 'android' || !isNativeIncomingCallAvailable()) {
    initialized = true;
    return;
  }
  initialized = true;

  RNNotificationCall.addEventListener('answer', (event) => {
    const parsed = parsePayload(event?.payload);
    try {
      RNNotificationCall.backToApp();
    } catch (e) {}
    incomingCallBridge.emitAnswer({
      ...parsed,
      callUUID: event?.callUUID,
    });
  });

  RNNotificationCall.addEventListener('endCall', (event) => {
    const parsed = parsePayload(event?.payload);
    if (event?.endAction === 'ACTION_REJECTED_CALL') {
      incomingCallBridge.emitDecline({ ...parsed, callUUID: event?.callUUID });
    } else {
      incomingCallBridge.emitTimeout({ ...parsed, callUUID: event?.callUUID });
    }
  });
}
