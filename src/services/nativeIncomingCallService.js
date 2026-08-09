import { Platform } from 'react-native';
import { incomingCallBridge } from '../lib/incomingCallBridge';

let RNNotificationCall = null;
if (Platform.OS === 'android') {
  try {
    RNNotificationCall = require('react-native-full-screen-notification-incoming-call').default;
  } catch (e) {}
}

const CHANNEL_ID = 'gennetex_incoming_call_v1';
let initialized = false;

export function isNativeIncomingCallAvailable() {
  return Platform.OS === 'android' && !!RNNotificationCall?.displayNotification;
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
  });
}

/** Android — утасны системийн дуудлагын дэлгэц (түгжээтэй/background) */
export function showNativeIncomingCall(call) {
  if (!isNativeIncomingCallAvailable() || !call) return false;
  const callId = String(call.id || `tmp_${Date.now()}`);
  const callerName = call.caller_name || 'Ажилтан';
  try {
    RNNotificationCall.displayNotification(callId, null, 90_000, {
      channelId: CHANNEL_ID,
      channelName: 'Видео дуудлага',
      notificationIcon: 'ic_launcher',
      notificationTitle: callerName,
      notificationBody: 'Видео дуудлага ирлээ',
      answerText: 'Хариулах',
      declineText: 'Татгалзах',
      notificationColor: '#16a34a',
      isVideo: true,
      payload: buildPayload({ ...call, id: callId }),
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** Push data-аас native дуудлага харуулах */
export function showNativeIncomingCallFromPush(data) {
  if (!data || data.type !== 'call') return false;
  return showNativeIncomingCall({
    id: data.callId,
    room: data.room,
    caller_id: data.callerId,
    caller_name: data.callerName || 'Ажилтан',
    status: 'ringing',
    created_at: new Date().toISOString(),
  });
}

export function hideNativeIncomingCall() {
  if (!isNativeIncomingCallAvailable()) return;
  try {
    RNNotificationCall.hideNotification();
  } catch (e) {}
}

export function initNativeIncomingCallListeners() {
  if (!isNativeIncomingCallAvailable() || initialized) return;
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
