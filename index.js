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

// Арын байршлын task. OS нь аппыг сэргээхдээ энэ task-ийг нэрээр нь хайдаг тул
// React mount хийхээс ӨМНӨ, модулийн дээд түвшинд бүртгэгдсэн байх ёстой.
try {
  require('./src/services/backgroundLocationService');
} catch (e) {}

// Data-only FCM messages need a top-level handler before React is mounted.
// Expo Go has no project-specific native Firebase module, so this optional
// require intentionally becomes a no-op there.
try {
  const messagingModule = require('@react-native-firebase/messaging');

  // ⚠️ v26 дээр `default` export БАЙХГҮЙ. Урьд нь
  //    `messagingModule.default || messagingModule` гэж аваад
  //    `messaging()` гэж дуудахад модулийн объектыг функц мэт дуудаж
  //    TypeError шидэж, доорх catch дотор чимээгүй үхэж байв.
  //    Үр дүнд нь background handler ХЭЗЭЭ Ч бүртгэгдэхгүй — апп
  //    хаалттай үед дуудлага сэрээх зам байхгүй байлаа.
  const messaging = messagingModule.getMessaging();

  // Дуудлага ирэхэд аппыг СЭРЭЭХ цорын ганц зам. Апп бүрэн хаагдсан үед
  // React ажиллахгүй тул энд, headless JS-д бүтэн дэлгэцийн дуудлагыг
  // гаргана. Энэ handler удаан ажиллавал Android процессыг хааж мэдэх тул
  // зөвхөн мэдэгдэл гаргаад шууд буцна — сүлжээний хүсэлт хийхгүй.
  messagingModule.setBackgroundMessageHandler(messaging, async (message) => {
    const data = message?.data;
    if (!data || data.type !== 'incoming_call') return;
    try {
      const { showNativeIncomingCallFromPush } = require('./src/services/nativeIncomingCallService');
      showNativeIncomingCallFromPush(data);
    } catch (e) {}
  });
} catch (e) {}

registerRootComponent(App);
