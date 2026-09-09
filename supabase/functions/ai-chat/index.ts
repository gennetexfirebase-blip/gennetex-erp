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

const AI_BASE_URL = (Deno.env.get('AI_BASE_URL') ?? '').replace(/\/+$/, '');
const AI_MODEL = Deno.env.get('AI_MODEL') ?? 'qwen3:1.7b';
const AI_API_KEY = Deno.env.get('AI_API_KEY') ?? '';

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
    'Чи бол Gennetex AI — ЖЕННЕТЕКС ХХК-ийн монгол хэлний туслах.',
    '',
    'ДҮРЭМ:',
    '1. ҮРГЭЛЖ монгол кирилл үсгээр хариул. Хэрэглэгч латин галигаар',
    '   бичсэн ч (жишээ нь "sain uu", "yaj bh ve") чи кириллээр хариулна.',
    '2. Латин галигийг монгол хэл гэж ойлго: sh=ш, ch=ч, ts=ц, kh/h=х,',
    '   ya=я, yo=ё, yu=ю, j=ж, z=з, w=щ, y=ы.',
    '3. Богино, тодорхой бич. Шаардлагагүй давталт бүү хий.',
    '4. Мэдэхгүй зүйлээ "мэдэхгүй байна" гэж шулуухан хэл. ОГТ бүү зохио.',
    '5. Огноо, үнэ, хүний нэр зэрэг баримтыг доорх мэдлэгээс л ав.',
    '6. Латин галигаар хариулахыг ТУСГАЙЛАН хүсвэл л галигаар бич.',
  ].join('\n');

  if (!knowledge.length) return base;

  const facts = knowledge
    .map((k, i) => `${i + 1}. Асуулт: ${k.question}\n   Хариулт: ${k.answer}`)
    .join('\n');

  return `${base}\n\nМЭДЭГДЭЖ БУЙ БАРИМТУУД (эдгээрийг үнэн гэж үз):\n${facts}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST хүсэлт хүлээж байна.' }, 405);

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
    max_tokens: 900,
    stream: false,
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

  return json({ reply, conversationId, model: AI_MODEL, durationMs: duration });
});
