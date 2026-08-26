/**
 * Supabase-ийн нэвтрэлтийн session-ийг ХАМГААЛАГДСАН санд хадгалах адаптер.
 *
 * ЯАГААД:
 *   Өмнө нь session (access token + refresh token) нь `AsyncStorage`-д
 *   ЭНГИЙН ТЕКСТЭЭР хадгалагдаж байсан. AsyncStorage нь Android дээр
 *   зүгээр нэг SQLite файл, iOS дээр plist — root эрхтэй утас, backup,
 *   эсвэл файл уншдаг өөр апп/хэрэгслээр гарч ирнэ. Refresh token гарсан
 *   тохиолдолд халдагч тухайн ажилтны нэрээр ERP-д хязгааргүй нэвтэрнэ.
 *
 *   OWASP MASVS-STORAGE-1 болон App Store / Play-ийн шаардлагын дагуу
 *   нэвтрэлтийн credential-ийг үйлдлийн системийн хамгаалалттай санд
 *   хадгална:
 *     iOS     → Keychain
 *     Android → EncryptedSharedPreferences (Android Keystore-оор түлхүүрлэсэн)
 *   Хоёуланг нь `expo-secure-store` хийж өгнө.
 *
 * ХОЁР НАРИЙН ЗҮЙЛ:
 *   1. SecureStore нь нэг утгад ~2КБ хязгаартай (Android дээр анхааруулга
 *      өгөөд алддаг). Supabase-ийн session JSON нь JWT-тэйгээ 2-4КБ болдог
 *      тул ХЭСЭГЛЭЖ (chunk) хадгална.
 *   2. Аль хэдийн нэвтэрсэн хэрэглэгчид байгаа. Тэднийг албадан гаргахгүйн
 *      тулд эхний уншилтад хуучин AsyncStorage дахь утгыг ШИЛЖҮҮЛЭЭД
 *      хуучныг нь устгана.
 *
 * Веб (react-native-web) дээр SecureStore байхгүй тул AsyncStorage руу
 * автоматаар буцна — тэнд хөтчийн өөрийнх нь sandbox хамгаална.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Нэг хэсэгт багтаах тэмдэгтийн тоо — 2048 байтын хязгаараас доогуур. */
const CHUNK_SIZE = 1600;

/** SecureStore-ийн түлхүүрт зөвшөөрөгдөх тэмдэгтүүд: [A-Za-z0-9._-] */
function safeKey(key) {
  return String(key).replace(/[^A-Za-z0-9._-]/g, '_');
}

const countKey = (key) => `${safeKey(key)}.n`;
const chunkKey = (key, i) => `${safeKey(key)}.${i}`;

/** Веб дээр SecureStore байхгүй. */
const secureAvailable = Platform.OS !== 'web';

async function secureGet(key) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    // Түлхүүр эвдэрсэн / төхөөрөмж түгжээтэй үед унших боломжгүй байж болно.
    return null;
  }
}

async function secureSet(key, value) {
  await SecureStore.setItemAsync(key, value, {
    // Утас түгжээтэй байхад ч дэвсгэрийн даалгавар (байршил илгээх,
    // дуудлага хүлээн авах) token шаардана. `AFTER_FIRST_UNLOCK` нь
    // "утсыг асаасны дараа нэг удаа тайлсан бол" уншигдана гэсэн үг.
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

async function secureDelete(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    /* байхгүй байсан ч алдаа тооцохгүй */
  }
}

/** Хэсэглэсэн утгыг бүтнээр нь уншина. */
async function readChunked(key) {
  const raw = await secureGet(countKey(key));
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  let out = '';
  for (let i = 0; i < n; i += 1) {
    const part = await secureGet(chunkKey(key, i));
    // Нэг хэсэг нь дутуу бол бүхэлдээ хүчингүй — дахин нэвтрүүлнэ.
    if (part == null) return null;
    out += part;
  }
  return out;
}

async function writeChunked(key, value) {
  const previous = Number(await secureGet(countKey(key))) || 0;
  const parts = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    parts.push(value.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < parts.length; i += 1) {
    await secureSet(chunkKey(key, i), parts[i]);
  }
  // Хуучин утга илүү олон хэсэгтэй байсан бол үлдэгдлийг цэвэрлэнэ.
  for (let i = parts.length; i < previous; i += 1) {
    await secureDelete(chunkKey(key, i));
  }
  await secureSet(countKey(key), String(parts.length));
}

async function clearChunked(key) {
  const previous = Number(await secureGet(countKey(key))) || 0;
  for (let i = 0; i < previous; i += 1) await secureDelete(chunkKey(key, i));
  await secureDelete(countKey(key));
}

/**
 * Supabase-д өгөх storage адаптер.
 *
 * `createClient(..., { auth: { storage: secureSessionStorage } })`
 */
export const secureSessionStorage = {
  async getItem(key) {
    if (!secureAvailable) return AsyncStorage.getItem(key);

    const stored = await readChunked(key);
    if (stored != null) return stored;

    // ШИЛЖИЛТ: хуучин хувилбар дээр нэвтэрсэн хэрэглэгчийн session-ийг
    // хамгаалагдсан сан руу зөөж, задгай хуулбарыг нь устгана.
    const legacy = await AsyncStorage.getItem(key).catch(() => null);
    if (legacy != null) {
      try {
        await writeChunked(key, legacy);
        await AsyncStorage.removeItem(key);
      } catch (e) {
        // Зөөж чадаагүй бол ядаж нэвтрэлт нь тасрахгүй.
        return legacy;
      }
      return legacy;
    }
    return null;
  },

  async setItem(key, value) {
    if (!secureAvailable) return AsyncStorage.setItem(key, value);
    await writeChunked(key, String(value));
    // Хуучин задгай хуулбар үлдсэн бол устгана.
    await AsyncStorage.removeItem(key).catch(() => {});
  },

  async removeItem(key) {
    if (!secureAvailable) return AsyncStorage.removeItem(key);
    await clearChunked(key);
    await AsyncStorage.removeItem(key).catch(() => {});
  },
};

export default secureSessionStorage;
