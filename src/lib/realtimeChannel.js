import { supabase } from './supabase';

/**
 * Өвөрмөц нэртэй realtime суваг үүсгэнэ.
 *
 * АСУУДАЛ:
 *   Supabase-ийн `supabase.channel('нэр')` нь ижил нэрээр дуудахад ӨМНӨХ
 *   сувгийн объектыг буцаадаг. Хэрэв тэр суваг аль хэдийн `.subscribe()`
 *   хийгдсэн байвал дээр нь `.on()` нэмэх боломжгүй бөгөөд дараах алдаа гарна:
 *
 *     cannot add `postgres_changes` callbacks for realtime:... after `subscribe()`
 *
 *   Энэ нь дэлгэцийг крэш болгодог. Хоёр өөр компонент нэг үйлчилгээний
 *   subscribe функцийг дуудахад (ж: TabBar + NotificationCenterScreen)
 *   яг ингэж болдог.
 *
 * ШИЙДЭЛ:
 *   Дуудалт бүрд дугаар нэмж өвөрмөц нэр өгнө. Ингэснээр дуудагч бүр өөрийн
 *   сувагтай болж, бие биеийнхээ бүртгэлд халдахгүй.
 *
 * @param {string} base Уншихад ойлгомжтой суурь нэр, ж: 'feed-realtime'
 */
let seq = 0;

export function uniqueChannel(base) {
  seq += 1;
  return supabase.channel(`${base}-${seq}-${Date.now().toString(36)}`);
}
