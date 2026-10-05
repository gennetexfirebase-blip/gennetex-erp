import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { showNativeIncomingCallFromPush } from './nativeIncomingCallService';

export const BACKGROUND_CALL_TASK = 'gennetex-background-incoming-call';

TaskManager.defineTask(BACKGROUND_CALL_TASK, ({ data, error }) => {
  if (error || Platform.OS !== 'android') return;
  const payload = data?.notification?.request?.content?.data;
  const kinds = ['incoming_call', 'call', 'live_invite'];
  if (payload && kinds.includes(payload.type)) {
    showNativeIncomingCallFromPush({
      ...payload,
      // `incoming_call` нь VoIP урсгал — callType-ыг хадгална. Бусад нь
      // хуучин видео дуудлага/урилга тул `call` болгож нэгтгэнэ.
      type: payload.type === 'incoming_call' ? 'incoming_call' : 'call',
      callerName: payload.callerName || payload.hostName || 'Ажилтан',
    });
  }
});

export async function registerBackgroundCallTask() {
  if (Platform.OS !== 'android') return;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_CALL_TASK);
    if (!registered) {
      await Notifications.registerTaskAsync(BACKGROUND_CALL_TASK);
    }
  } catch (e) {}
}
