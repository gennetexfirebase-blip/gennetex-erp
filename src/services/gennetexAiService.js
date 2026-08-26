/**
 * Gennetex AI — сүлжээний асуултад Gemini-ээр хариулна.
 * Түлхүүр: .env (EXPO_PUBLIC_GEMINI_API_KEY) эсвэл апп дотор хадгалсан түлхүүр.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { callEdge } from '../lib/edgeFunction';

const STORAGE_KEY = '@gennetex_gemini_api_key';
const YT_STORAGE_KEY = '@gennetex_youtube_api_key';
const CHAT_STORAGE_KEY = '@gennetex_ai_chat_history';

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
];

function cleanEnv(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function keyFromExpoConfig() {
  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
  // process.env.EXPO_PUBLIC_GEMINI_API_KEY-г ЗОРИУД уншихгүй: EXPO_PUBLIC_*
  // утгууд аппын bundle дотор ил үлддэг тул APK задалсан хэн ч түлхүүрийг
  // аваад таны Google данснаас төлбөр үүсгэж чадна. Түлхүүрийг апп дотроос
  // (Тохиргоо) оруулж, төхөөрөмж дээр л хадгална.
  return cleanEnv(extra.geminiApiKey);
}

function youtubeFromExpoConfig() {
  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
  return cleanEnv(extra.youtubeApiKey || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY);
}

/**
 * AI ашиглах боломжтой эсэх.
 *
 * Supabase холбогдсон бол `gemini-proxy` Edge Function-оор дамжуулах зам
 * нээлттэй тул түлхүүр аппад байх шаардлагагүй.
 */
export function isGennetexAiConfigured() {
  return Boolean(keyFromExpoConfig()) || Boolean(supabase);
}

// ---------------------------------------------------------------------------
// Gemini рүү хандах НЭГ цэг
// ---------------------------------------------------------------------------

/**
 * Прокси ажиллаж байгаа эсэх (нэг session-д нэг л удаа тогтооно).
 *   null  — хараахан оролдоогүй
 *   true  — Edge Function ажиллаж байна
 *   false — deploy хийгээгүй / түлхүүр серверт алга → төхөөрөмжийн түлхүүр
 */
let proxyState = null;

/** Прокси байхгүй үед л хэрэглэгчээс түлхүүр шаардана. */
const NO_KEY_MESSAGE =
  'Gemini API түлхүүр олдсонгүй.\n\n' +
  'Сервер тал дээр тохируулах нь зөв: supabase secrets set GEMINI_API_KEY=… ' +
  'дараа нь supabase functions deploy gemini-proxy.\n\n' +
  'Түр зуур энэ төхөөрөмж дээр түлхүүрээ оруулж болно.';

/**
 * Gemini-ийн `generateContent`-ыг дуудна.
 *
 * ЭХЛЭЭД сервер прокси (түлхүүр серверт үлдэнэ), тэр боломжгүй бол хуучин
 * шууд зам (төхөөрөмж дэх түлхүүр). Ингэснээр прокси deploy хийгдэх хүртэл
 * юу ч эвдрэхгүй.
 *
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function generateContent(model, body) {
  if (supabase && proxyState !== false) {
    try {
      const { data } = await callEdge('gemini-proxy', { model, body });
      proxyState = true;
      return {
        ok: data?.ok !== false,
        status: Number(data?.status) || 200,
        data: data?.data || {},
      };
    } catch (e) {
      // `callEdge` нь функц deploy хийгдээгүй (404) эсвэл серверт түлхүүр
      // алга (501) үед л алдаа шидэж энд ирнэ — тэгвэл хуучин зам руу.
      proxyState = false;
    }
  }

  const apiKey = await getGeminiKeyAsync();
  if (!apiKey) throw new Error(NO_KEY_MESSAGE);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Апп дотор хадгалсан түлхүүр + .env */
export async function getGeminiKeyAsync() {
  try {
    const local = cleanEnv(await AsyncStorage.getItem(STORAGE_KEY));
    if (local) return local;
  } catch (e) {}
  return keyFromExpoConfig();
}

export async function saveGeminiKeyLocal(key) {
  const k = cleanEnv(key);
  if (!k) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, k);
}

export async function loadGennetexChatHistory() {
  try {
    const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

export async function saveGennetexChatHistory(messages) {
  try {
    await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (e) {}
}

export async function clearGennetexChatHistory() {
  try {
    await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
  } catch (e) {}
}

export async function getYoutubeKeyAsync() {
  try {
    const local = cleanEnv(await AsyncStorage.getItem(YT_STORAGE_KEY));
    if (local) return local;
  } catch (e) {}
  return youtubeFromExpoConfig();
}

const SYSTEM = `Та бол "Gennetex AI" — Gennetex компанийн сүлжээний техникийн туслах chatbot.
ЗӨВХӨН сүлжээ / телеком / интернет / ONU / OLT / router / switch / Wi‑Fi / кабель / оптик / IP / VLAN / GPON / FTTH / troubleshooting зэрэг сэдвээр хариулна.
Бусад сэдэв (спорт, улс төр, хоол, ерөнхий мэдлэг гэх мэт) бол on_topic=false гэж буцаа.

Хариулт монгол хэлээр, ажилтнуудад ойлгомжтой, алхам алхмаар ЗААВАР хэлбэрээр бич.
Товч, практик байх. Аюултай/хууль бус зүйл заахгүй.

Зөвхөн дараах JSON буцаа (өөр текст битгий нэм):
{
  "on_topic": true эсвэл false,
  "answer": "заавар эсвэл татгалзсан хариу",
  "youtube_query": "англиар богино хайлтын түлхүүр үг (видео хайхад)"
}`;

function extractJson(text) {
  const raw = String(text || '').trim();
  try {
    return JSON.parse(raw);
  } catch (e) {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (e) {}
  }
  return null;
}

async function callGeminiOnce(model, userText, history) {
  const contents = [];
  (history || []).slice(-8).forEach((m) => {
    if (!m?.content) return;
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  });
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const bodies = [
    {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    },
    {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { temperature: 0.4 },
    },
  ];

  let lastErr = null;
  for (const body of bodies) {
    const { ok, status, data } = await generateContent(model, body);
    if (!ok) {
      lastErr = data?.error?.message || `Gemini алдаа (${status})`;
      // model олдсонгүй бол дараагийн модель руу
      if (status === 404 || /not found|not supported/i.test(lastErr)) break;
      continue;
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    const parsed = extractJson(text);
    if (parsed) {
      return {
        on_topic: parsed.on_topic !== false,
        answer: String(parsed.answer || '').trim() || 'Хариу хоосон байна.',
        youtube_query: String(parsed.youtube_query || '').trim(),
      };
    }
    if (text) {
      return { on_topic: true, answer: text, youtube_query: '' };
    }
    lastErr = 'Хоосон хариу';
  }
  throw new Error(lastErr || 'Gemini хариу өгсөнгүй');
}

async function callGemini(userText, history = []) {
  let lastErr = null;
  for (const model of MODELS) {
    try {
      return await callGeminiOnce(model, userText, history);
    } catch (e) {
      lastErr = e.message || String(e);
      if (/API key|invalid|PERMISSION|403|401/i.test(lastErr)) throw new Error(lastErr);
    }
  }
  throw new Error(lastErr || 'Gemini холбогдсонгүй');
}

/** Ерөнхий Gemini дуудлага (гүйцэтгэлийн шинжилгээ гэх мэт) */
export async function callGeminiText(systemText, userText, { json = false } = {}) {
  const sys = String(systemText || '').trim();
  const usr = String(userText || '').trim();
  if (!usr) throw new Error('Оролт хоосон байна');

  let lastErr = null;
  for (const model of MODELS) {
    try {
      const body = {
        ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: usr }] }],
        generationConfig: {
          temperature: 0.35,
          ...(json ? { responseMimeType: 'application/json' } : {}),
          ...(model.includes('2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      };
      const { ok, status, data } = await generateContent(model, body);
      if (!ok) {
        lastErr = data?.error?.message || `Gemini алдаа (${status})`;
        if (status === 404 || /not found|not supported/i.test(lastErr)) break;
        continue;
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
      if (!text.trim()) {
        lastErr = 'Хоосон хариу';
        continue;
      }
      if (json) {
        const parsed = extractJson(text);
        if (parsed) return parsed;
      }
      return text.trim();
    } catch (e) {
      lastErr = e.message || String(e);
      if (/API key|invalid|PERMISSION|403|401/i.test(lastErr)) throw new Error(lastErr);
    }
  }
  throw new Error(lastErr || 'Gemini холбогдсонгүй');
}

async function searchYouTube(query, maxResults = 2) {
  const q = String(query || '').trim();
  if (!q) return [];

  const YOUTUBE_KEY = await getYoutubeKeyAsync();
  if (!YOUTUBE_KEY) {
    return [
      {
        id: 'search',
        title: `YouTube: ${q}`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
        thumb: null,
        isSearch: true,
      },
    ];
  }

  const url =
    'https://www.googleapis.com/youtube/v3/search?' +
    new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: String(maxResults),
      q,
      key: YOUTUBE_KEY,
      relevanceLanguage: 'mn',
      safeSearch: 'strict',
    }).toString();

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return [
      {
        id: 'search',
        title: `YouTube: ${q}`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
        thumb: null,
        isSearch: true,
      },
    ];
  }

  return (data.items || [])
    .map((it) => {
      const id = it?.id?.videoId;
      if (!id) return null;
      return {
        id,
        title: it.snippet?.title || 'YouTube видео',
        url: `https://www.youtube.com/watch?v=${id}`,
        thumb: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
        isSearch: false,
      };
    })
    .filter(Boolean);
}

export async function askGennetexAi(question, history = []) {
  const q = String(question || '').trim();
  if (!q) throw new Error('Асуулт хоосон байна');

  const gemini = await callGemini(q, history);

  if (!gemini.on_topic) {
    return {
      onTopic: false,
      answer:
        gemini.answer ||
        'Би зөвхөн сүлжээ / интернет / төхөөрөмжийн асуудлаар тусална. Сүлжээтэй холбоотой асуулт асууна уу.',
      videos: [],
    };
  }

  let videos = [];
  try {
    videos = await searchYouTube(gemini.youtube_query || q, 2);
  } catch (e) {
    videos = [];
  }

  return {
    onTopic: true,
    answer: gemini.answer,
    videos,
  };
}
