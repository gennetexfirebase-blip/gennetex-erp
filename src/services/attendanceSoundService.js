import { Audio } from 'expo-av';

// Ирц амжилттай бүртгэгдсэн үед тоглох дуу хоолой — "амжилттай гэсэн бичвэрийн
// оронд" (алдаа/pending үед хэвээр Alert ашиглана, зөвхөн шууд амжилттай
// бүртгэгдсэн тохиолдолд л дуу тоглоно).
const CHECK_IN_SOUND = require('../../assets/sounds/attendance_check_in.mp3');
const CHECK_OUT_SOUND = require('../../assets/sounds/attendance_check_out.mp3');

async function playSound(asset) {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: true, volume: 1 });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (e) {
    // Дуу тоглуулж чадаагүй ч ирц бүртгэл өөрөө амжилттай хэвээр — алгасна.
  }
}

export function playCheckInSound() {
  return playSound(CHECK_IN_SOUND);
}

export function playCheckOutSound() {
  return playSound(CHECK_OUT_SOUND);
}
