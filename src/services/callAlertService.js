import { Vibration, Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

let player = null;
let ttsTimer = null;
let vibeTimer = null;

// Дуудлагын ringtone — апп дотор багцлагдсан аудио файл (Алс хол нь дэргэд)
const RINGTONE_ASSET = require('../../assets/sounds/incoming_call.mp3');
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
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      interruptionModeAndroid: 'doNotMix',
    });
    const p = createAudioPlayer(RINGTONE_ASSET);
    p.loop = true;
    p.volume = 1;
    // expo-audio-д ачаалалт асинхрон тул алдаа нь зөвхөн статусаар мэдэгддэг:
    // багцлагдсан файл уншигдаагүй бол онлайн ringtone руу шилжинэ.
    let switched = false;
    p.addListener('playbackStatusUpdate', (status) => {
      if (!status?.error || switched) return;
      switched = true;
      try {
        p.replace({ uri: RINGTONE_FALLBACK_URI });
        p.loop = true;
        p.volume = 1;
        p.play();
      } catch (e) {}
    });
    player = p;
    p.play();
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
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch (e) {}
    player = null;
  }
}
