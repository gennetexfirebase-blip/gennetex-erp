import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { showNativeIncomingCallFromPush } from './nativeIncomingCallService';

export const BACKGROUND_CALL_TASK = 'gennetex-background-incoming-call';

TaskManager.defineTask(BACKGROUND_CALL_TASK, ({ data, error }) => {
  if (error || Platform.OS !== 'android') return;
  const payload = data?.notification?.request?.content?.data;
  if (payload?.type === 'call' || payload?.type === 'live_invite') {
    showNativeIncomingCallFromPush({
      ...payload,
      type: 'call',
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
