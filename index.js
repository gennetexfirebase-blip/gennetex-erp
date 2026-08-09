import './src/lib/telegram/polyfills';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';

try {
  const { initNativeIncomingCallListeners } = require('./src/services/nativeIncomingCallService');
  initNativeIncomingCallListeners?.();
} catch (e) {}

try {
  require('./src/services/incomingCallBackgroundTask');
} catch (e) {}

// Data-only FCM messages need a top-level handler before React is mounted.
// Expo Go has no project-specific native Firebase module, so this optional
// require intentionally becomes a no-op there.
try {
  const messagingModule = require('@react-native-firebase/messaging');
  const messaging = messagingModule.default || messagingModule;
  messaging().setBackgroundMessageHandler(async () => {});
} catch (e) {}

registerRootComponent(App);
