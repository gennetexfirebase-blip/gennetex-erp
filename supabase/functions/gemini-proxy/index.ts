import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Gemini прокси — API түлхүүрийг СЕРВЕР дээр байлгах.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *   Өмнө нь `EXPO_PUBLIC_GEMINI_API_KEY` нь `app.config.js`-ээр дамжин
 *   аппын `extra` дотор орж, улмаар APK/IPA дотор ИЛ үлддэг байв. Аппыг
 *   задалсан хэн ч түлхүүрийг аваад танай Google дансны нэрийн өмнөөс
 *   төлбөр үүсгэх боломжтой. Түлхүүрийг сольсон ч дараагийн build дотор
 *   дахин ил гарах тул "rotate" хийх нь утгагүй болно.
 *
 *   Энэ функц нь түлхүүрийг ЗӨВХӨН серверт хадгална:
 *     supabase secrets set GEMINI_API_KEY=AIza...
 *
 *   Апп нь өөрийн нэвтрэлтийн JWT-ээрээ энэ функцийг дуудна. Supabase нь
 *   JWT-г үүдэнд шалгадаг тул НЭВТРЭЭГҮЙ хүн Gemini-г ашиглах боломжгүй —
 *   өөрөөр хэлбэл түлхүүр задарсан ч гуравдагч этгээд танай квотыг
 *   зарцуулж чадахгүй.
 *
 * DEPLOY:
 *   supabase secrets set GEMINI_API_KEY=<түлхүүр>
 *   supabase functions deploy gemini-proxy
 *
 * Deploy хийгээгүй үед апп нь хуучин зам (төхөөрөмж дэх түлхүүр) руугаа
 * автоматаар буцдаг тул энэ функц гарч ирэх хүртэл юу ч эвдрэхгүй.
 */

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

/**
 * Зөвшөөрөгдсөн загварууд.
 *
 * Дурын нэр дамжуулахыг зөвшөөрвөл халдагч энэ проксиор дамжуулан
 * Google-ийн ӨӨР үйлчилгээ рүү хандах (SSRF маягийн) оролдлого хийж болно.
 * Тиймээс зөвхөн апп ашигладаг загваруудыг цагаан жагсаалтад оруулав —
 * `gennetexAiService.js` доторх MODELS-тэй ижил байх ёстой.
 */
const ALLOWED_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
]);

/** Хүсэлтийн биеийн дээд хэмжээ — хэт том prompt-оор квот шавхахаас сэргийлнэ. */
const MAX_BODY_BYTES = 200_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    // Апп үүнийг хараад төхөөрөмж дэх түлхүүр рүүгээ буцна.
    return jsonResponse({ error: "GEMINI_API_KEY тохируулаагүй байна" }, 501);
  }

  let payload: { model?: string; body?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Хүсэлт хэт том байна" }, 413);
    }
    payload = JSON.parse(raw);
  } catch (_e) {
    return jsonResponse({ error: "JSON биш хүсэлт" }, 400);
  }

  const model = String(payload?.model || "");
  if (!ALLOWED_MODELS.has(model)) {
    return jsonResponse({ error: `Зөвшөөрөөгүй загвар: ${model}` }, 400);
  }
  if (!payload?.body || typeof payload.body !== "object") {
    return jsonResponse({ error: "body дутуу" }, 400);
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.body),
    });
    const data = await upstream.json().catch(() => ({}));

    // Gemini-ийн алдааг ХЭВЭЭР нь дамжуулна (загвар олдоогүй, квот дууссан
    // гэх мэт). Функц өөрөө 200 буцаана — эс тэгвээс клиент талын
    // `callEdge` нь ялгаж чадахгүй ерөнхий алдаа шиднэ.
    //
    // ⚠️ Дээд түвшинд `error` түлхүүр ХЭРЭГЛЭХГҮЙ: түүнийг клиент нь
    //    "прокси өөрөө ажиллахгүй байна" гэж ойлгож, төхөөрөмжийн
    //    түлхүүр рүү буцдаг.
    return jsonResponse({ ok: upstream.ok, status: upstream.status, data });
  } catch (e) {
    return jsonResponse({ ok: false, status: 502, data: { error: { message: String(e) } } });
  }
});
