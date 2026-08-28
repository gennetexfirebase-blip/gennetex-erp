import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

/**
 * Түлшний үнийг нийтийн эх сурвалжаас татаж `fuel_prices`-д бичнэ.
 *
 * ⚠️ ЯАГААД EDGE FUNCTION ВЭ: аппаас шууд татвал CORS хаагдана, мөн
 *    ажилтан бүрийн утаснаас давхардсан хүсэлт явна. Энд өдөрт нэг
 *    удаа (cron) ажиллаж, бүгд нэг эх сурвалжаас ижил үнэ хардаг.
 *
 * ⚠️ ЭХ СУРВАЛЖ ТОГТВОРГҮЙ: Монголын түлш нийлүүлэгчид албан ёсны API
 *    гаргадаггүй тул HTML-ээс уншина. Сайт өөрчлөгдвөл таних загвар
 *    ажиллахаа болино — тэр үед функц алдаа ЗАРЛАХГҮЙ, зүгээр л
 *    "олдсонгүй" гэж буцаана. Админ гараар оруулах зам үргэлж
 *    нээлттэй (`set_fuel_price` RPC) тул систем зогсохгүй.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Found = { fuel_type: string; price_mnt: number };

/** "2,850₮" / "2850 төг" / "2 850" → 2850 */
function parsePrice(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  // Монголд 1 литр 1'000–20'000₮ хооронд. Гаднах утга бол буруу таналт.
  return n >= 1000 && n <= 20000 ? n : null;
}

/**
 * HTML дотроос "АИ-92" мэтийн шошгыг олоод, ойролцоох тооноос үнийг авна.
 *
 * Тодорхой сайтын бүтцэд уяхгүй байхыг зорьсон: шошго ба түүнээс хойших
 * 200 тэмдэгтийн дотор эхэлж таарсан "мянгатын" тоог үнэ гэж үзнэ.
 */
function scanHtml(html: string): Found[] {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const patterns: Array<[string, RegExp]> = [
    ['ai80', /(?:АИ|AI)[\s-]*80/i],
    ['ai92', /(?:АИ|AI)[\s-]*92/i],
    ['ai95', /(?:АИ|AI)[\s-]*95/i],
    ['diesel', /дизель|diesel/i],
  ];

  const out: Found[] = [];
  for (const [fuelType, re] of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    const window = text.slice(m.index, m.index + 200);
    const num = /\d[\d\s,'.]{2,}/.exec(window.slice(m[0].length));
    if (!num) continue;
    const price = parsePrice(num[0]);
    if (price != null) out.push({ fuel_type: fuelType, price_mnt: price });
  }
  return out;
}

const SOURCES: Array<{ name: string; url: string }> = [
  { name: 'nic', url: 'https://nic.mn/' },
  { name: 'petrovis', url: 'https://petrovis.mn/' },
  { name: 'shunkhlai', url: 'https://shunkhlai.mn/' },
];

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // Зарим сайт бот гэж үзээд хаадаг тул энгийн браузерын толгой.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept-Language': 'mn,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Оношилгоо: эх сурвалжийн HTML-ээс түлштэй холбоотой хэсгийг харуулна.
  // Сайт өөрчлөгдөхөд таних загварыг шинэчлэхэд хэрэгтэй.
  const url = new URL(req.url);
  if (url.searchParams.get('debug')) {
    const target = url.searchParams.get('url') || SOURCES[1].url;
    const html = await tryFetch(target);
    if (!html) return json({ target, ok: false, reason: 'татагдсангүй' });
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const hits: string[] = [];
    for (const re of [/(?:АИ|AI)[\s-]*9[25]/gi, /дизель/gi, /бензин/gi]) {
      let m;
      while ((m = re.exec(text)) && hits.length < 8) {
        hits.push(text.slice(Math.max(0, m.index - 60), m.index + 160));
      }
    }
    return json({ target, ok: true, length: html.length, hits, head: text.slice(0, 300) });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false } },
  );

  const attempts: Array<{ source: string; ok: boolean; found: number }> = [];
  let saved = 0;
  let usedSource: string | null = null;

  for (const src of SOURCES) {
    const html = await tryFetch(src.url);
    if (!html) {
      attempts.push({ source: src.name, ok: false, found: 0 });
      continue;
    }
    const found = scanHtml(html);
    attempts.push({ source: src.name, ok: true, found: found.length });
    if (!found.length) continue;

    const today = new Date().toISOString().slice(0, 10);
    for (const f of found) {
      const { error } = await db.from('fuel_prices').upsert(
        {
          fuel_type: f.fuel_type,
          price_mnt: f.price_mnt,
          effective_date: today,
          source: src.name,
        },
        { onConflict: 'fuel_type,effective_date' },
      );
      if (!error) saved++;
    }
    usedSource = src.name;
    break; // Эхний ажилласан эх сурвалжаар зогсоно.
  }

  console.log('[fuel-price-sync]', { usedSource, saved, attempts });

  return json({
    ok: saved > 0,
    source: usedSource,
    saved,
    attempts,
    // Автомат татаж чадаагүй нь АЛДАА биш: админ гараар оруулах зам
    // үргэлж нээлттэй тул систем зогсохгүй.
    hint: saved > 0 ? undefined : 'Автомат татаж чадсангүй — үнийг гараар оруулна уу.',
  });
});
