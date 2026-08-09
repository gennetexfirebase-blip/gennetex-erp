/**
 * Gennetex AI — сүлжээний асуултад Gemini-ээр хариулна.
 * Түлхүүр: .env (EXPO_PUBLIC_GEMINI_API_KEY) эсвэл апп дотор хадгалсан түлхүүр.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

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
  return cleanEnv(extra.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY);
}

function youtubeFromExpoConfig() {
  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
  return cleanEnv(extra.youtubeApiKey || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY);
}

/** Синхрон шалгалт (.env / app.config) */
export function isGennetexAiConfigured() {
  return Boolean(keyFromExpoConfig());
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

async function callGeminiOnce(model, apiKey, userText, history) {
  const contents = [];
  (history || []).slice(-8).forEach((m) => {
    if (!m?.content) return;
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  });
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastErr = data?.error?.message || `Gemini алдаа (${res.status})`;
      // model олдсонгүй бол дараагийн модель руу
      if (res.status === 404 || /not found|not supported/i.test(lastErr)) break;
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
  const apiKey = await getGeminiKeyAsync();
  if (!apiKey) {
    throw new Error(
      'Gemini API түлхүүр олдсонгүй. Доорх талбарт түлхүүрээ оруулна уу, эсвэл .env дээр EXPO_PUBLIC_GEMINI_API_KEY=AIza... гэж бичээд npx expo start --clear хийнэ үү.'
    );
  }

  let lastErr = null;
  for (const model of MODELS) {
    try {
      return await callGeminiOnce(model, apiKey, userText, history);
    } catch (e) {
      lastErr = e.message || String(e);
      if (/API key|invalid|PERMISSION|403|401/i.test(lastErr)) throw new Error(lastErr);
    }
  }
  throw new Error(lastErr || 'Gemini холбогдсонгүй');
}

/** Ерөнхий Gemini дуудлага (гүйцэтгэлийн шинжилгээ гэх мэт) */
export async function callGeminiText(systemText, userText, { json = false } = {}) {
  const apiKey = await getGeminiKeyAsync();
  if (!apiKey) {
    throw new Error('Gemini API түлхүүр олдсонгүй (.env эсвэл Gennetex AI дээр түлхүүр оруулна уу).');
  }
  const sys = String(systemText || '').trim();
  const usr = String(userText || '').trim();
  if (!usr) throw new Error('Оролт хоосон байна');

  let lastErr = null;
  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const body = {
        ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: usr }] }],
        generationConfig: {
          temperature: 0.35,
          ...(json ? { responseMimeType: 'application/json' } : {}),
          ...(model.includes('2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = data?.error?.message || `Gemini алдаа (${res.status})`;
        if (res.status === 404 || /not found|not supported/i.test(lastErr)) break;
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
