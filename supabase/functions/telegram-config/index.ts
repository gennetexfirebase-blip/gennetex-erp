/**
 * Telegram MTProto-ийн api_id / api_hash-ыг НЭВТЭРСЭН хэрэглэгчид өгнө.
 *
 * ЯАГААД ЭНЭ ФУНКЦ ХЭРЭГТЭЙ ВЭ:
 *   Өмнө нь эдгээр нь `EXPO_PUBLIC_TELEGRAM_API_ID/_HASH` байсан.
 *   `EXPO_PUBLIC_` угтвартай бүх зүйл JS bundle дотор ШАТААГДДАГ —
 *   2026-08-31-ний аудитаар экспортолсон Hermes файлаас `api_hash`-ыг
 *   задлахгүйгээр уншиж чадсан. APK-г татсан ХЭН Ч түүнийг олно.
 *
 *   Telegram-ийн `api_hash` нь хэрэглэгчийн дансны нэрийн өмнөөс
 *   MTProto сесс нээх боломж олгодог тул энэ нь бодит эрсдэл.
 *
 * ЯАГААД БҮРЭН СЕРВЕРТ ЗӨӨГӨӨГҮЙ ВЭ:
 *   MTProto нь клиент-серверийн шифрлэсэн протокол. Клиент нь холболт
 *   үүсгэхдээ api_id/api_hash-ыг ӨӨРӨӨ мэдэж байх ёстой — Gemini шиг
 *   дамжуулагч (proxy) тавих боломжгүй. Тиймээс хамгийн сайн зам нь
 *   түлхүүрийг APK-д шатаахын оронд НЭВТЭРСЭН хэрэглэгчид ажиллах
 *   үед өгөх явдал.
 *
 *   Ингэснээр APK задалсан хүн түлхүүрийг олохгүй; зөвхөн хүчинтэй
 *   сесстэй ажилтан авна.
 *
 * ⚠️ Тохируулах:
 *     supabase secrets set TELEGRAM_API_ID=<id>
 *     supabase secrets set TELEGRAM_API_HASH=<hash>
 *     supabase functions deploy telegram-config
 *
 * ⚠️ Хуучин hash нь аль хэдийн тараагдсан APK дотор үлдсэн тул
 *    my.telegram.org дээр ЗААВАЛ ШИНЭЧИЛНЭ. Кодоос хасах нь
 *    ганцаараа хангалтгүй.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // ── Нэвтрэлт заавал ────────────────────────────────────────────
  // Энэ бол ЭНЭ ФУНКЦИЙН ЦОРЫН ГАНЦ УТГА. Шалгалтгүй бол түлхүүрийг
  // нийтэд тавьсантай ялгаагүй болно.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const apiId = Deno.env.get("TELEGRAM_API_ID");
  const apiHash = Deno.env.get("TELEGRAM_API_HASH");
  if (!apiId || !apiHash) {
    // Апп үүнийг хараад "тохируулаагүй" гэж ойлгомжтой мэдэгдэнэ.
    return jsonResponse({ error: "telegram_not_configured" }, 501);
  }

  return jsonResponse({ apiId: Number(apiId), apiHash });
});
