import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

/**
 * Gennetex AI — чатын прокси (ai.gennetex.com).
 *
 * ⚠️ Загвар ЭНД ажиллахгүй. Edge Function бол Deno, санах ой багатай тул
 *    qwen3:1.7b багтахгүй. Энэ функц нь:
 *      1. Зочны асуултыг хүлээж авна
 *      2. Мэдлэгийн сангаас холбогдох зүйлсийг олно (кирилл + галиг)
 *      3. Ярианы өмнөх мөрүүдийг контекст болгоно
 *      4. OpenAI-тэй нийцтэй ГАДААД загварын сервер рүү дамжуулна
 *         (Ollama-гийн `/v1/chat/completions` яг ийм хэлбэртэй)
 *      5. Асуулт, хариултыг хадгална — эндээс мэдлэг бүрддэг
 *
 * Шаардлагатай нууц утгууд (`supabase secrets set`):
 *   AI_BASE_URL   жишээ: https://llm.gennetex.com/v1
 *   AI_MODEL      жишээ: qwen3:1.7b
 *   AI_API_KEY    сервер шаарддаг бол (Ollama-д хэрэггүй)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const AI_BASE_URL = (
  Deno.env.get('AI_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta/openai'
).replace(/\/+$/, '');
const AI_MODEL = Deno.env.get('AI_MODEL') ?? 'gemini-3.6-flash';
const AI_API_KEY = Deno.env.get('AI_API_KEY') ?? '';

/**
 * Бодох гүн.
 *
 * Gemini 3.x нь дотроо "бодох" (thinking) токен зарцуулдаг бөгөөд тэдгээр нь
 * max_tokens-д ТООЦОГДДОГ. Гүнзгий бодуулбал бүх төсөв бодолд дуусаж,
 * хэрэглэгчид ХООСОН хариу очно (finish_reason: "length"). Чат хурдан байх
 * ёстой тул 'low'. Шаардлагатай бол AI_REASONING_EFFORT нууц утгаар солино.
 */
const AI_REASONING = Deno.env.get('AI_REASONING_EFFORT') ?? 'low';

/** Ярианаас өөрөө суралцах эсэх. */
const LEARN_ENABLED = (Deno.env.get('AI_LEARN') ?? 'on') !== 'off';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Хэт урт асуулт нь загварын контекстийг дүүргэдэг тул таслана. */
const MAX_MESSAGE_CHARS = 4000;
/** Загвар удаан бодох тул хугацааг өгөөмөр авна, гэхдээ хязгаартай. */
const MODEL_TIMEOUT_MS = 55_000;

/**
 * Системийн заавар.
 *
 * qwen3:1.7b бол ЖИЖИГ загвар — монгол хэлний чадвар нь хязгаартай.
 * Тиймээс зааврыг маш тодорхой бичиж, "мэдэхгүй" гэж хэлэхийг
 * зөвшөөрсөн нь худал зохиохоос нь хамаагүй дээр.
 */
function buildSystemPrompt(knowledge: { question: string; answer: string }[]): string {
  const base = [
    'Чи бол МАЗААЛАЙ хиймэл оюун — монгол хэлээр сэтгэдэг туслах.',
    'Чиний ажиллаж буй загвар: Mazaalai 1.4B.',
    '',
    'ӨӨРИЙГӨӨ ТАНИЛЦУУЛАХ:',
    'A. "Чи хэн бэ", "ямар AI вэ", "ямар загвар вэ", "хэн чамайг хийсэн бэ"',
    '   гэх мэт асуувал ЯГ ингэж хариул:',
    '   "Би Мазаалай хиймэл оюуны Mazaalai 1.4B загвар дээр ажиллаж байна."',
    'B. Өөр ямар ч компани, бүтээгдэхүүн, загварын нэрийг ОГТ бүү дурд.',
    '',
    'ДҮРЭМ:',
    '1. ҮРГЭЛЖ монгол кирилл үсгээр хариул. Хэрэглэгч латин галигаар',
    '   бичсэн ч (жишээ нь "sain uu", "yaj bh ve") чи кириллээр хариулна.',
    '2. Латин галигийг монгол хэл гэж ойлго: sh=ш, ch=ч, ts=ц, kh/h=х,',
    '   ya=я, yo=ё, yu=ю, j=ж, z=з, w=щ, y=ы. Жишээ: "bayarlalaa"=баярлалаа,',
    '   "yamar tsag bolj bn"="ямар цаг болж байна".',
    '3. БҮХ ТӨРЛИЙН асуултад хариул — шинжлэх ухаан, түүх, программчлал,',
    '   математик, орчуулга, зөвлөгөө, өдөр тутмын яриа. "Би зөвхөн тодорхой',
    '   сэдвээр хариулна" гэж БҮҮ хэл.',
    '4. Богино, тодорхой бич. Шаардлагагүй давталт бүү хий.',
    '5. Компанийн ДОТООД баримт (үнэ, огноо, хүний нэр)-ыг зөвхөн доорх',
    '   мэдлэгээс ав. Мэдлэгт байхгүй бол "мэдэхгүй байна" гэж шулуухан хэл —',
    '   БҮҮ зохио. Ерөнхий мэдлэгийн асуултад энэ дүрэм хамаарахгүй.',
    '6. Латин галигаар хариулахыг ТУСГАЙЛАН хүсвэл л галигаар бич.',
  ].join('\n');

  if (!knowledge.length) return base;

  const facts = knowledge
    .map((k, i) => `${i + 1}. Асуулт: ${k.question}\n   Хариулт: ${k.answer}`)
    .join('\n');

  return `${base}\n\nМЭДЭГДЭЖ БУЙ БАРИМТУУД (эдгээрийг үнэн гэж үз):\n${facts}`;
}

/**
 * Энгийн IP хязгаарлалт.
 *
 * Энэ функц нэвтрэлт шаарддаггүй (зочид чатлах ёстой) тул хэн ч дуудаж
 * болно. Хязгааргүй бол нэг хүн загварын квотыг шавхах боломжтой.
 * Isolate тус бүрийн санах ойд байдаг тул төгс биш — гэхдээ энгийн
 * хэт хэрэглээг барина.
 */
const RATE_LIMIT = Number(Deno.env.get('AI_RATE_LIMIT') ?? '20');
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  if (RATE_LIMIT <= 0) return false;
  const now = Date.now();
  const seen = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  seen.push(now);
  hits.set(ip, seen);
  if (hits.size > 5000) hits.clear();
  return seen.length > RATE_LIMIT;
}

/** Мэндчилгээ, хоосон яриа — санд хадгалах утгагүй. */
const SMALL_TALK = /^(сайн уу|сайн байна уу|баярлалаа|тийм|үгүй|за|okay|ok|hi|hello|sain uu|sain baina uu|bayarlalaa|thanks|bye)(?![а-яёүөa-zA-Z])/i;

/** Санд хадгалах эсэхийг шийднэ. */
const LEARN_MIN_CHARS = 10;
function shouldLearn(question: string, answer: string): boolean {
  if (question.length < LEARN_MIN_CHARS) return false;
  if (SMALL_TALK.test(question.trim())) return false;
  // Загвар мэдэхгүй гэсэн бол суралцах зүйл алга.
  if (/мэдэхгүй|мэдэхгүй байна|мэдээлэл алга|уучлаарай/i.test(answer)) return false;
  // Хэт урт хариултыг санд хийвэл хайлт бүдгэрдэг.
  if (answer.length < 10 || answer.length > 1500) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST хүсэлт хүлээж байна.' }, 405);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return json({ error: 'Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.' }, 429);
  }

  if (!AI_BASE_URL) {
    return json(
      {
        error:
          'Загварын сервер тохируулаагүй байна. AI_BASE_URL нууц утгыг тохируулна уу.',
      },
      503,
    );
  }

  let payload: { message?: string; conversationId?: string | null; history?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'JSON биш хүсэлт ирлээ.' }, 400);
  }

  const message = String(payload.message ?? '').trim();
  if (!message) return json({ error: 'Асуулт хоосон байна.' }, 400);
  if (message.length > MAX_MESSAGE_CHARS) {
    return json({ error: `Асуулт хэт урт байна (дээд тал нь ${MAX_MESSAGE_CHARS} тэмдэгт).` }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── 1. Мэдлэгийн сангаас холбогдох зүйлсийг олно ──────────────────
  let knowledge: { question: string; answer: string }[] = [];
  try {
    const { data } = await supabase.rpc('ai_search_knowledge', { q: message, max_rows: 4 });
    if (Array.isArray(data)) knowledge = data;
  } catch {
    // Мэдлэг олдоогүй нь хариулахад саад биш.
  }

  // ── 2. Яриа — байхгүй бол шинээр үүсгэнэ ──────────────────────────
  let conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : null;
  if (conversationId) {
    const { data } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!data) conversationId = null;
  }
  if (!conversationId) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ title: message.slice(0, 80) })
      .select('id')
      .single();
    if (error || !data) return json({ error: 'Яриа үүсгэж чадсангүй.' }, 500);
    conversationId = data.id;
  }

  // ── 3. Өмнөх мөрүүд — контекст ────────────────────────────────────
  const { data: past } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(8);

  const historyMsgs = (past ?? [])
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // ── 4. Загвар руу ─────────────────────────────────────────────────
  const body = {
    model: AI_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(knowledge) },
      ...historyMsgs,
      { role: 'user', content: message },
    ],
    temperature: 0.4,
    // Бодох токен ЭНД багтдаг тул төсвийг өгөөмөр авна.
    max_tokens: 2400,
    stream: false,
    ...(AI_REASONING ? { reasoning_effort: AI_REASONING } : {}),
  };

  const started = Date.now();
  let reply = '';
  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return json({ error: `Загварын сервер алдаа (${res.status}): ${detail}` }, 502);
    }

    const data = await res.json();
    reply = String(data?.choices?.[0]?.message?.content ?? '').trim();

    // qwen3 нь бодлоо `<think>…</think>` дотор гаргадаг — хэрэглэгчид
    // харуулах шаардлагагүй тул хасна.
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const timedOut = /timeout|aborted/i.test(msg);
    return json(
      {
        error: timedOut
          ? 'Загвар хэт удаж байна. Дахин оролдоно уу.'
          : `Загварын сервер рүү холбогдож чадсангүй: ${msg}`,
      },
      504,
    );
  }

  if (!reply) reply = 'Уучлаарай, хариу үүсгэж чадсангүй. Дахин асууна уу.';

  // ── 5. Хадгална — мэдлэг эндээс бүрдэнэ ───────────────────────────
  const duration = Date.now() - started;
  await supabase.from('ai_messages').insert([
    { conversation_id: conversationId, role: 'user', content: message },
    {
      conversation_id: conversationId,
      role: 'assistant',
      content: reply,
      model: AI_MODEL,
      duration_ms: duration,
    },
  ]);
  await supabase
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  // ── 6. Өөрөө суралцах ─────────────────────────────────────────────
  //
  // Мэдлэгийн сангаас ТААРАХ зүйл олдоогүй асуултын хариултыг санд
  // нэмнэ — ингэснээр дараагийн ижил асуултад загвар дахин бодохгүйгээр
  // тогтсон хариулт өгнө.
  //
  // ⚠️ Энэ нь загварын хариултыг үнэн гэж үзэж байгаа тул алдаатай зүйл
  //    ч суралцаж болзошгүй. Админ `ai_knowledge` хүснэгтээс буруу
  //    мөрийг устгаж/засаж болно (source = 'conversation').
  if (LEARN_ENABLED && !knowledge.length && shouldLearn(message, reply)) {
    try {
      await supabase.from('ai_knowledge').insert({
        question: message,
        answer: reply,
        source: 'conversation',
        approved: true,
        tags: ['auto'],
      });
    } catch {
      // Суралцаж чадаагүй нь хэрэглэгчид хариу өгөхөд саад биш.
    }
  }

  return json({ reply, conversationId, model: AI_MODEL, durationMs: duration });
});
