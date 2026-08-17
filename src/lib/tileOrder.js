/**
 * Нүүр дэлгэцийн хавтангийн дараалал — хэрэглэгч бүрээр.
 *
 * Хэрэглэгч хавтангаа удаан дараад чирж дурын байрлалд зөөнө. Тэр
 * дараалал нь ЗӨВХӨН ТУХАЙН ТӨХӨӨРӨМЖ дээр, тухайн хэрэглэгчийн
 * нэрээр хадгалагдана (AsyncStorage) — сервер рүү илгээхгүй.
 *
 * ЯАГААД ХЭРЭГЛЭГЧ БҮРЭЭР ВЭ:
 *   Нэг төхөөрөмж дээр хэд хэдэн хүн ээлжлэн нэвтэрдэг (жишээ нь
 *   агуулахын нийтийн таблет). Нэг түлхүүрт хадгалбал нэг хүний
 *   өөрчилсөн байрлал бусдад нь хамаарна.
 *
 * ⚠️ Хадгалсан жагсаалт нь ЗӨВЛӨМЖ болохоос дүрэм биш:
 *   • эрх нь өөрчлөгдөж алга болсон модулийг алгасана
 *   • шинэ модуль нэмэгдвэл АРД нь залгана (алга болохгүй)
 *   Ингэснээр шинэ хувилбарт нэмэгдсэн боломж хэрэглэгчийн хуучин
 *   дараалал дээр гацаж, харагдахгүй үлдэхээс сэргийлнэ.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@gennetex/tile_order_v1';

function storageKey(section, userId) {
  return `${PREFIX}:${userId || 'guest'}:${section}`;
}

/** Хадгалсан дарааллыг унших. Байхгүй бол `null`. */
export async function loadTileOrder(section, userId) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(section, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : null;
  } catch {
    return null;
  }
}

export async function saveTileOrder(section, userId, keys) {
  try {
    await AsyncStorage.setItem(storageKey(section, userId), JSON.stringify(keys || []));
  } catch {
    // Хадгалалт бүтэхгүй бол дараалал нь энэ удаад л ажиллана —
    // хэрэглэгчийн ажлыг зогсоохгүй.
  }
}

export async function clearTileOrder(section, userId) {
  try {
    await AsyncStorage.removeItem(storageKey(section, userId));
  } catch {}
}

/**
 * Хадгалсан дарааллыг одоогийн модулиудад тохируулна.
 *
 * @param modules Одоогийн (эрхээр шүүсэн) модулиуд
 * @param savedKeys Хадгалсан түлхүүрийн дараалал (эсвэл null)
 */
export function applyTileOrder(modules, savedKeys) {
  const list = modules || [];
  if (!savedKeys?.length) return list;

  const byKey = new Map(list.map((m) => [m.key, m]));
  const ordered = [];
  for (const key of savedKeys) {
    const found = byKey.get(key);
    if (found) {
      ordered.push(found);
      byKey.delete(key);
    }
  }
  // Дараалалд ороогүй (шинэ) модулиуд ард нь, эх дарааллаараа.
  for (const m of list) {
    if (byKey.has(m.key)) ordered.push(m);
  }
  return ordered;
}
