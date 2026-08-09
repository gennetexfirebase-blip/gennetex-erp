import { Vibration, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

let sound = null;
let ttsTimer = null;
let vibeTimer = null;

// Дуудлагын ringtone — апп дотор багцлагдсан аудио файл (Алс хол нь дэргэд)
const RINGTONE_ASSET = require('../../assets/sounds/incoming-call.mp3');
// Нөөц (локал файл ачаалахад алдаа гарвал онлайн)
const RINGTONE_FALLBACK_URI =
  'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb7499d42.mp3?filename=phone-ringtone-124474.mp3';

function speakCaller(callerName) {
  const phrase = `${callerName || 'Ажилтан'} залгаж байна`;
  Speech.stop();
  Speech.speak(phrase, {
    language: 'mn-MN',
    rate: Platform.OS === 'ios' ? 0.48 : 0.9,
    pitch: 1,
  });
}

function startVibration() {
  if (Platform.OS === 'web') return;
  const pattern = [0, 700, 400, 700];
  Vibration.vibrate(pattern, true);
  vibeTimer = setInterval(() => Vibration.vibrate(pattern, true), 2200);
}

function stopVibration() {
  if (vibeTimer) clearInterval(vibeTimer);
  vibeTimer = null;
  Vibration.cancel();
}

export async function startIncomingCallAlert(callerName) {
  await stopIncomingCallAlert();
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });
    try {
      const { sound: s } = await Audio.Sound.createAsync(RINGTONE_ASSET, {
        isLooping: true,
        volume: 1,
        shouldPlay: true,
      });
      sound = s;
      await sound.playAsync();
    } catch (assetErr) {
      // Багцлагдсан файл ачаалахад алдаа гарвал онлайн ringtone
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: RINGTONE_FALLBACK_URI },
        { isLooping: true, volume: 1, shouldPlay: true }
      );
      sound = s;
      await sound.playAsync();
    }
  } catch (e) {
    // Ringtone алдаа — TTS + чичиргээ л үлдэнэ
  }
  speakCaller(callerName);
  ttsTimer = setInterval(() => speakCaller(callerName), 4500);
  startVibration();
}

export async function stopIncomingCallAlert() {
  if (ttsTimer) {
    clearInterval(ttsTimer);
    ttsTimer = null;
  }
  Speech.stop();
  stopVibration();
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch (e) {}
    sound = null;
  }
}
