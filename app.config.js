/**
 * Expo Go: native-only plugin-уудыг хасна.
 * APK / EAS build: бүх plugin идэвхтэй.
 */
const fs = require('fs');

const isNativeBuild =
  !!process.env.EAS_BUILD ||
  process.env.EXPO_USE_DEV_CLIENT === '1' ||
  process.env.NODE_ENV === 'production';

const NATIVE_ONLY_PLUGINS = new Set([
  'expo-dev-client',
  'react-native-full-screen-notification-incoming-call',
]);

const androidGoogleServices = './google-services.json';
const iosGoogleServices = './GoogleService-Info.plist';

module.exports = ({ config }) => {
  const plugins = (config.plugins || []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return !NATIVE_ONLY_PLUGINS.has(name) || isNativeBuild;
  });

  if (isNativeBuild) {
    plugins.push('@react-native-firebase/app', '@react-native-firebase/messaging');
  }

  return {
    ...config,
    plugins,
    android: {
      ...config.android,
      ...(fs.existsSync(androidGoogleServices) ? { googleServicesFile: androidGoogleServices } : {}),
    },
    ios: {
      ...config.ios,
      ...(fs.existsSync(iosGoogleServices) ? { googleServicesFile: iosGoogleServices } : {}),
    },
  };
};
