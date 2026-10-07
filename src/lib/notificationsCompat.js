import { isExpoGo } from './runtimeEnv';

/**
 * Expo Go (SDK 53+) remote push API-г бүрэн хассан. `expo-notifications`-г
 * import хийх төдийд red screen гардаг тул Expo Go үед жижиг no-op facade,
 * development/production build үед жинхэнэ модулийг буцаана.
 */
const noopSubscription = () => ({ remove() {} });

const expoGoNotifications = {
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
  AndroidNotificationPriority: { DEFAULT: 'default', HIGH: 'high', MAX: 'max' },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  setNotificationHandler() {},
  async setNotificationChannelAsync() {},
  async deleteNotificationChannelAsync() {},
  async getPermissionsAsync() { return { status: 'undetermined', granted: false }; },
  async requestPermissionsAsync() { return { status: 'undetermined', granted: false }; },
  async scheduleNotificationAsync() { return null; },
  async registerTaskAsync() {},
  addNotificationReceivedListener: noopSubscription,
  addNotificationResponseReceivedListener: noopSubscription,
  async getLastNotificationResponseAsync() { return null; },
};

let Notifications = expoGoNotifications;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch {
    Notifications = expoGoNotifications;
  }
}

export default Notifications;
