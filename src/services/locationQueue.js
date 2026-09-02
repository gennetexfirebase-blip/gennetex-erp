/**
 * Байршлын OFFLINE ДАРАА — сүлжээ тасарсан үед координатыг локалд
 * хадгалж, сүлжээ ормогц нөхөж илгээнэ.
 *
 * ⚠️ ЯАГААД ЭНЭ ФАЙЛ ШИНЭЭР НЭМЭГДЭВ:
 *    Өмнө нь background task-ийн `catch` блок нь сүлжээгүй үед
 *    "чимээгүй өнгөрдөг" байсан — координат БҮРМӨСӨН алдагддаг байв.
 *    Талбарын ажилтан сүлжээгүй бүсэд (подвал, алслагдсан газар)
 *    ороод гарахад тэр хугацааны замнал огт үлдэхгүй байлаа.
 *
 *    Одоо илгээж чадаагүй цэг бүр дараанд орж, дараагийн амжилттай
 *    холболтод нөхөж илгээгдэнэ.
 *
 * ⚠️ SQLite/Hive БИШ, AsyncStorage ашиглав. Шалтгаан: төсөл аль
 *    хэдийн AsyncStorage-ыг өргөн ашигладаг бөгөөд шинэ натив
 *    хамаарал (expo-sqlite) нэмбэл Expo Go дээр ажиллахгүй болно.
 *    Байршлын цэг нь жижиг (2 тоо + timestamp) тул JSON массив
 *    хангалттай — бид дээд хязгаар тавьж хязгааргүй өсөхөөс сэргийлнэ.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@gennetex_location_queue_v1';

/**
 * Дарааллын дээд хэмжээ.
 *
 * 15 сек тутам нэг цэг → 500 цэг ≈ 2 цагийн тасралт. Түүнээс их
 * тасрах нь ховор бөгөөд хамгийн ХУУЧИН цэгүүд ач холбогдлоо алддаг
 * тул хязгаарт хүрвэл эхнээс нь хасна (FIFO). Хязгааргүй өсвөл
 * AsyncStorage дүүрч, апп удааширна.
 */
const MAX_QUEUE = 500;

let memo = null; // санах ойн хуулбар — уншилт бүрд диск хүрэхгүй

async function read() {
  if (memo) return memo;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    memo = raw ? JSON.parse(raw) : [];
  } catch (e) {
    memo = [];
  }
  return memo;
}

async function write(list) {
  memo = list;
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch (e) {
    /* диск дүүрсэн ч санах ойд үлдэнэ — дараагийн flush оролдоно */
  }
}

/**
 * Илгээж чадаагүй цэгийг дараанд нэмнэ.
 *
 * @param {{ userId, userName, latitude, longitude, speed?, battery?, at? }} point
 */
export async function enqueue(point) {
  if (point?.latitude == null || point?.longitude == null) return;
  const list = await read();
  list.push({
    userId: point.userId,
    userName: point.userName || null,
    latitude: point.latitude,
    longitude: point.longitude,
    speed: point.speed ?? null,
    battery: point.battery ?? null,
    // Хэзээ авсан цаг — сервер дээр "одоо" гэж бичихгүй, БОДИТ мөчийг
    // хадгална. Эс бөгөөс нөхөж илгээхэд замнал гажина.
    at: point.at || new Date().toISOString(),
  });
  // Хязгаараас хэтэрвэл хамгийн хуучныг хасна.
  if (list.length > MAX_QUEUE) list.splice(0, list.length - MAX_QUEUE);
  await write(list);
}

export async function queueSize() {
  return (await read()).length;
}

/**
 * Дараанд байгаа бүх цэгийг илгээх.
 *
 * @param {(point) => Promise<void>} sender  Нэг цэг илгээх функц.
 *   Амжилттай бол `resolve`, амжилтгүй бол `throw` хийнэ.
 * @returns {Promise<{ sent: number, remaining: number }>}
 *
 * ⚠️ Цэгүүдийг ДАРААЛЛААР нь илгээнэ (эртнийх нь эхэнд). Нэг цэг
 *    амжилтгүй болвол ЗОГСОНО — сүлжээ дахин тасарсан гэж үзэж,
 *    үлдсэнийг дараанд үлдээнэ. Ингэснээр давхар илгээх, дараалал
 *    эвдрэхээс сэргийлнэ.
 */
export async function flush(sender) {
  const list = await read();
  if (!list.length) return { sent: 0, remaining: 0 };

  let sent = 0;
  for (const point of list) {
    try {
      await sender(point);
      sent += 1;
    } catch (e) {
      break; // сүлжээ дахин унасан — үлдсэнийг хойшлуулна
    }
  }

  if (sent > 0) {
    const remaining = list.slice(sent);
    await write(remaining);
    return { sent, remaining: remaining.length };
  }
  return { sent: 0, remaining: list.length };
}

/** Дарааг цэвэрлэх (гарах, эсвэл тест). */
export async function clearQueue() {
  memo = [];
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch (e) {}
}
