import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Ирц амжилттай бүртгэгдсэн үед тоглох дуу хоолой — "амжилттай гэсэн бичвэрийн
// оронд" (алдаа/pending үед хэвээр Alert ашиглана, зөвхөн шууд амжилттай
// бүртгэгдсэн тохиолдолд л дуу тоглоно).
const CHECK_IN_SOUND = require('../../assets/sounds/attendance_check_in.mp3');
const CHECK_OUT_SOUND = require('../../assets/sounds/attendance_check_out.mp3');
// Зайнаас (бүсээс гадуур) бүртгүүлсэн — админы зөвшөөрөл хүлээнэ.
const REMOTE_IN_SOUND = require('../../assets/sounds/remote_check_in.mp3');
const REMOTE_OUT_SOUND = require('../../assets/sounds/remote_check_out.mp3');
// Ирц бүртгэх бүсээс ГАРСАН.
const ZONE_EXIT_SOUND = require('../../assets/sounds/zone_exit.mp3');

async function playSound(asset) {
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
    const player = createAudioPlayer(asset);
    player.volume = 1;
    // Дуусмагц натив player-ийг суллана — expo-audio нь өөрөө цэвэрлэдэггүй.
    let released = false;
    player.addListener('playbackStatusUpdate', (status) => {
      if (!status?.didJustFinish || released) return;
      released = true;
      try {
        player.remove();
      } catch (e) {}
    });
    player.play();
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

/** Зайнаас ирсэн ирц илгээгдлээ (админы зөвшөөрөл хүлээнэ). */
export function playRemoteCheckInSound() {
  return playSound(REMOTE_IN_SOUND);
}

/** Зайнаас явсан ирц илгээгдлээ. */
export function playRemoteCheckOutSound() {
  return playSound(REMOTE_OUT_SOUND);
}

/** Ирц бүртгэх бүсээс ГАРСАН үед. */
export function playZoneExitSound() {
  return playSound(ZONE_EXIT_SOUND);
}

// ---------------------------------------------------------------------------
// Геофенс бүсэд нэвтрэх дуут мэдэгдэл
// ---------------------------------------------------------------------------
// Байршлын НЭРЭЭР тохирох бичлэгийг сонгоно. Нэрийг жижиг үсэг болгож,
// түлхүүр үгээр тааруулна — админ "office", "Office", "Оффис" гэх мэтээр
// бичсэн ч ажиллана.
const ZONE_SOUNDS = [
  { match: ['aguulah', 'агуулах'], asset: require('../../assets/sounds/zone_aguulah.mp3') },
  { match: ['office', 'оффис', 'офис'], asset: require('../../assets/sounds/zone_office.mp3') },
];

/** Тухайн байршлын нэрэнд тохирох бичлэг байгаа эсэх. */
export function hasZoneSound(locationName) {
  const n = String(locationName || '').toLowerCase();
  if (!n) return false;
  return ZONE_SOUNDS.some((z) => z.match.some((m) => n.includes(m)));
}

/**
 * Бүсэд нэвтэрсэн дууг тоглуулна.
 *
 * Тохирох бичлэг олдоогүй тохиолдолд ЧИМЭЭГҮЙ өнгөрнө — танихгүй нэртэй
 * шинэ байршил нэмэгдэхэд буруу дуу гаргахаас сэргийлнэ.
 */
export function playZoneEnterSound(locationName) {
  const n = String(locationName || '').toLowerCase();
  const found = ZONE_SOUNDS.find((z) => z.match.some((m) => n.includes(m)));
  if (!found) return Promise.resolve(false);
  return playSound(found.asset).then(() => true);
}
