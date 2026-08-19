import { plateToAutoboxQuery } from '../lib/mongoliaPlate';
import { fetchAutoboxHtml } from '../lib/autoboxParse';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const PUBLIC_API = (process.env.EXPO_PUBLIC_AUTOBOX_API_URL || '').replace(/\/$/, '');

async function fetchJson(url) {
  const headers = {};
  if (url.includes('.supabase.co')) {
    headers.apikey = ANON_KEY;
    headers.Authorization = `Bearer ${ANON_KEY}`;
  }
  const res = await fetch(url, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Алдаа (${res.status})`);
  }
  return json;
}

async function fetchViaProxy(plateNo) {
  const urls = [];
  if (PUBLIC_API) {
    urls.push(`${PUBLIC_API}?plateNo=${encodeURIComponent(plateNo)}`);
  }
  if (SUPABASE_URL) {
    urls.push(
      `${SUPABASE_URL}/functions/v1/autobox-vehicle?plateNo=${encodeURIComponent(plateNo)}`,
    );
  }

  let lastErr = 'Машины мэдээлэл татахад алдаа';
  for (const url of urls) {
    try {
      const json = await fetchJson(url);
      if (json.ok !== false && (json.general || json.technical || json.diagnosis || json.fines)) {
        return json;
      }
      lastErr = json.error || lastErr;
    } catch (e) {
      lastErr = e.message || String(e);
    }
  }
  throw new Error(lastErr);
}

/** Autobox.mn-ээс машины хүснэгтүүдийг татна. */
export async function fetchAutoboxVehicle(plate) {
  const q = plateToAutoboxQuery(plate);
  if (!q) throw new Error('Улсын дугаар буруу');

  try {
    return await fetchAutoboxHtml(q);
  } catch (directErr) {
    try {
      return await fetchViaProxy(q);
    } catch (proxyErr) {
      /**
       * ⚠️ ЭХНИЙХИЙН БИШ, ПРОКСИЙН алдааг харуулна.
       *
       * Урьд нь `directErr.message` давамгайлдаг байсан. Утаснаас
       * autobox.mn руу ШУУД хандах нь ихэвчлэн бүтдэггүй тул хэрэглэгч
       * үргэлж "Network request failed" гэдгийг л хардаг байв — тэр нь
       * ХҮЛЭЭГДСЭН зүйл бөгөөд жинхэнэ шалтгаан биш.
       *
       * Жинхэнэ шалтгаан нь нөөц зам буюу проксид байдаг (жишээ нь
       * функц deploy хийгдээгүй бол 404). Түүнийг нуувал асуудлыг
       * олоход хэцүү болно.
       */
      const proxyMsg = proxyErr?.message || '';
      const directMsg = directErr?.message || '';
      throw new Error(proxyMsg || directMsg || 'Машины мэдээлэл татахад алдаа');
    }
  }
}
