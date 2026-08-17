import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

/**
 * Google Sheet → `authorized_users` синхрончлол.
 *
 * ЯАГААД GOOGLE API БИШ, CSV ВЭ:
 *   Google Sheets API ашиглах бол service account үүсгэж, sheet-ийг
 *   түүнтэй хуваалцаж, JWT flow хэрэгжүүлэх шаардлагатай. Гэтэл sheet
 *   нь "холбоостой хүн үзэх" горимд байгаа тул `export?format=csv`
 *   хаягаар ямар ч түлхүүргүйгээр уншигдана.
 *
 *   ⚠️ Үүний хариуд: sheet-ийн хандалтыг хаавал синхрончлол зогсоно.
 *      Мөн холбоосыг мэдсэн хэн ч ажилтны нэр, утас, хаягийг харна.
 *      Эмзэг мэдээлэл нэмэхээс өмнө үүнийг бодолцоно уу.
 *
 * ХАМГААЛАЛТ:
 *   • Дуудагчийг JWT-ээр таниулна
 *   • Зөвхөн админ (role_rank >= 3) ажиллуулна
 *   • Бичих үйлдэл service role-оор — клиент `authorized_users`-д
 *     шууд бичих эрхгүй
 *
 * ЮУГ ХИЙХГҮЙ:
 *   Sheet рүү БУЦААЖ бичихгүй ("ID", "Бүртгүүлсэн огноо" багана хоосон
 *   үлдэнэ). Бичихийн тулд Google-ийн бичих эрх шаардана — өөр асуудал.
 */

const SHEET_ID = '14h3HO7EsdrF-zYfiV2kxPEaHEMshRwnI7IgirIV3RZA';

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

/**
 * CSV задлагч.
 *
 * Хаяг, нэр зэрэгт таслал агуулагдаж болох тул хашилт доторх таслалыг
 * салгагч гэж үзэхгүй. Мөн хашилт доторх давхар хашилт ("") нь нэг
 * хашилт гэсэн үг.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Sheet дэх монгол эрхийн нэрийг системийн утга руу буулгана. */
function mapRole(raw: string): string {
  const r = (raw || '').trim().toLowerCase();
  if (!r) return 'employee';
  if (/хөгжүүлэгч|hogjuulegch|superadmin|developer/.test(r)) return 'superadmin';
  if (/админ|admin/.test(r)) return 'admin';
  // Хэлтсийн удирдлага — менежерийг ахлахаас ӨМНӨ шалгана, эс тэгвээс
  // "ахлах менежер" гэсэн бичлэг ахлах болж буурна.
  if (/менежер|menejer|manager/.test(r)) return 'menejer';
  if (/ахлах|ahlah|lead/.test(r)) return 'ahlah';
  return 'employee';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    // --- Дуудагчийг таних ---
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'not_authenticated' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'not_authenticated' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return json({ error: 'forbidden', message: 'Зөвхөн админ синхрончилно.' }, 403);
    }

    // Админ нь ажилтан л нэмнэ — админ/хөгжүүлэгч эрх олгох нь зөвхөн
    // хөгжүүлэгчийн эрх. Sheet дээр "Админ" гэж бичээд дамжуулах нь
    // энэ дүрмийг тойрох цонх болж байсан.
    const mayAssignRoles = profile.role === 'superadmin';

    // --- Sheet татах ---
    const body = await req.json().catch(() => ({}));
    const sheetId = body?.sheetId || SHEET_ID;
    const gid = body?.gid ?? 0;
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    const res = await fetch(csvUrl, { redirect: 'follow' });
    if (!res.ok) {
      return json(
        {
          error: 'sheet_unreachable',
          message:
            'Sheet уншигдсангүй. "Холбоостой хүн бүр үзэх" горимд байгаа эсэхийг шалгана уу.',
          status: res.status,
        },
        502
      );
    }
    const csv = await res.text();
    if (/<html/i.test(csv)) {
      return json(
        {
          error: 'sheet_not_public',
          message:
            'Sheet нээлттэй биш байна. Share → "Anyone with the link" → Viewer болгоно уу.',
        },
        502
      );
    }

    const rows = parseCsv(csv);
    if (rows.length < 2) return json({ ok: true, added: 0, updated: 0, skipped: 0, rows: 0 });

    // --- Багануудыг толгойгоор нь олох ---
    // Багана шилжсэн ч ажиллах ёстой — байрлалаар нь бус нэрээр нь хайна.
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => {
      for (const n of names) {
        const i = header.findIndex((h) => h.includes(n));
        if (i >= 0) return i;
      }
      return -1;
    };
    const iLast = col('овог');
    const iName = col('нэр');
    const iMail = col('gmail', 'мэйл', 'email', 'и-мэйл');
    const iPhone = col('утас');
    const iAddr = col('хаяг');
    const iRole = col('эрх', 'role');

    if (iMail < 0) {
      return json(
        { error: 'no_email_column', message: 'Sheet дээр "Gmail" багана олдсонгүй.' },
        400
      );
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;
    const problems: string[] = [];

    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      const email = (cells[iMail] || '').trim().toLowerCase();

      // Хоосон мөр — sheet дээр урьдчилан бэлдсэн мөрүүд байдаг
      if (!email) {
        skipped++;
        continue;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        problems.push(`${r + 1}-р мөр: "${email}" зөв хаяг биш`);
        skipped++;
        continue;
      }

      // `name` нь NOT NULL. Sheet дээр нэр хоосон байвал хаягийн эхний
      // хэсгээр орлуулна — эс бөгөөс мөр бүхэлдээ унана.
      const nameCell = (cells[iName] || '').trim();

      const payload: Record<string, unknown> = {
        email,
        name: nameCell || email.split('@')[0],
        last_name: iLast >= 0 ? (cells[iLast] || '').trim() || null : null,
        phone: iPhone >= 0 ? (cells[iPhone] || '').trim() || null : null,
        address: iAddr >= 0 ? (cells[iAddr] || '').trim() || null : null,
        role: mayAssignRoles ? mapRole(iRole >= 0 ? cells[iRole] : '') : 'employee',
        active: true,
      };

      // ⚠️ `authorized_users`-ийн primary key нь EMAIL — `id` багана БАЙХГҮЙ.
      // Урьд нь энд `select('id, role')` гэж байсан тул query алдаа өгч,
      // байгаа хүнийг "олдсонгүй" гэж үзээд дахин insert хийдэг байв.
      // Үр дүн: "duplicate key value violates unique constraint
      // authorized_users_pkey" — нэг ч мөр шинэчлэгдэхгүй.
      const { data: existing, error: lookupError } = await admin
        .from('authorized_users')
        .select('email, role')
        .eq('email', email)
        .maybeSingle();

      // Хайлт өөрөө унасан бол insert руу шилжих нь ДАХИН давхцал үүсгэнэ.
      // Тиймээс мөрийг алгасаад шалтгааныг нь хэлнэ.
      if (lookupError) {
        problems.push(`${email}: шалгахад алдаа — ${lookupError.message}`);
        skipped++;
        continue;
      }

      if (existing) {
        // Эрхийг sheet-ээс ДАРААХГҮЙ: аппаас админ болгосон хүнийг
        // sheet дээрх хуучин "Ажилтан" утга буцаагаад доошлуулж болохгүй.
        delete payload.role;
        const { error } = await admin
          .from('authorized_users')
          .update(payload)
          .eq('email', email);
        if (error) problems.push(`${email}: ${error.message}`);
        else updated++;
      } else {
        const { error } = await admin.from('authorized_users').insert(payload);
        if (error) problems.push(`${email}: ${error.message}`);
        else added++;
      }
    }

    return json({
      ok: true,
      rows: rows.length - 1,
      added,
      updated,
      skipped,
      problems: problems.slice(0, 20),
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
