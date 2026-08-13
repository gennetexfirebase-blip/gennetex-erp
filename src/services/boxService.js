import { supabase } from '../lib/supabase';

/**
 * Хайрцгийн үйлчилгээ.
 *
 * Бүх бичих үйлдэл RPC-ээр явна — `box_items` дээр INSERT/UPDATE policy
 * ЗОРИУД байхгүй. Шууд бичихийг зөвшөөрвөл хэн ч үлдэгдлээ өөрчилж,
 * тооллого утгагүй болно.
 */

function mapError(message = '') {
  const m = String(message || '');
  if (/box_not_found/.test(m)) return 'Ийм хайрцаг олдсонгүй. QR код зөв эсэхийг шалгана уу.';
  if (/not_in_this_box/.test(m)) return 'Энэ бараа ЭНЭ хайрцагт байхгүй байна. Өөр хайрцгийнх байж магадгүй.';
  if (/item_not_found/.test(m)) return 'Уншсан код системд бүртгэлгүй байна.';
  if (/insufficient_in_box/.test(m)) return 'Хайрцагт хүрэлцэхгүй байна.';
  if (/user_not_found/.test(m)) return 'Ажилтан олдсонгүй.';
  if (/invalid_quantity/.test(m)) return 'Тоо ширхэг буруу.';
  if (/code_required/.test(m)) return 'Хайрцгийн код оруулна уу.';
  if (/name_required/.test(m)) return 'Хайрцгийн нэр оруулна уу.';
  if (/forbidden/.test(m)) return 'Танд олгох эрх байхгүй. Зөвхөн админ бараа олгоно.';
  if (/not_authenticated/.test(m)) return 'Дахин нэвтэрнэ үү.';
  if (/duplicate key/.test(m)) return 'Ийм кодтой хайрцаг аль хэдийн бий.';
  return m || 'Алдаа гарлаа.';
}

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(mapError(error.message));
  return data;
}

/** Бүх хайрцаг — тоо ширхэгийн хураангуйтай. */
export function fetchBoxes() {
  return rpc('box_list', {});
}

/**
 * QR кодоор хайрцгийн агуулгыг авна.
 *
 * RPC нь мөр бүрд хайрцгийн мэдээллийг давтаж буцаадаг (join) тул
 * энд нэг объект + жагсаалт болгон эмхэлнэ. Хоосон хайрцгийн хувьд
 * мөр огт ирэхгүй тул тэр тохиолдлыг тусад нь боловсруулав.
 */
export async function fetchBoxByCode(code) {
  const rows = await rpc('box_by_code', { p_code: String(code || '').trim() });
  const list = rows || [];
  if (!list.length) {
    // Хайрцаг олдоогүй бол RPC өөрөө exception шиднэ. Энд хүрсэн гэдэг нь
    // хайрцаг байгаа ч ХООСОН гэсэн үг.
    return { box: null, items: [], empty: true };
  }
  const first = list[0];
  return {
    box: {
      id: first.box_id,
      code: first.code,
      name: first.name,
      location: first.location,
      note: first.note,
    },
    items: list
      .filter((r) => r.item_id)
      .map((r) => ({
        id: r.item_id,
        name: r.item_name,
        unit: r.unit,
        category: r.category,
        barcode: r.barcode,
        serial_no: r.serial_no,
        quantity: Number(r.quantity) || 0,
      })),
    empty: false,
  };
}

/**
 * Зураасан код уншуулж ажилтанд олгоно.
 *
 * ЯГ ТЭР хайрцгаас хасагдана — өөр хайрцагт байгаа ижил бараа
 * хөндөгдөхгүй.
 */
export async function issueByBarcode({ boxCode, barcode, userId, quantity = 1 }) {
  const data = await rpc('box_issue_by_barcode', {
    p_box_code: boxCode,
    p_barcode: String(barcode || '').trim(),
    p_user_id: userId,
    p_quantity: quantity,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Олголт бүртгэгдсэнгүй.');
  return {
    itemId: row.item_id,
    itemName: row.item_name,
    serialNo: row.serial_no,
    issued: Number(row.issued) || 0,
    remaining: Number(row.remaining) || 0,
  };
}

/** Хайрцаг үүсгэх / засах. */
export async function upsertBox({ code, name, location, note }) {
  return rpc('box_upsert', {
    p_code: code,
    p_name: name,
    p_location: location || null,
    p_note: note || null,
  });
}

/** Хайрцагт бараа хийх — зураасан кодоор. */
export async function putItem({ boxCode, barcode, quantity = 1 }) {
  const data = await rpc('box_put_item', {
    p_box_code: boxCode,
    p_barcode: String(barcode || '').trim(),
    p_quantity: quantity,
  });
  const row = Array.isArray(data) ? data[0] : data;
  return { itemName: row?.r_item_name, quantity: Number(row?.r_quantity) || 0 };
}

/** Хайрцгаас олгосон түүх. */
export async function fetchIssues(boxId, limit = 100) {
  let q = supabase
    .from('box_issues')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (boxId) q = q.eq('box_id', boxId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * QR-д бичих утга.
 *
 * Зөвхөн КОДЫГ бичнэ — бүх мэдээллийг QR дотор хийвэл хайрцгийн агуулга
 * өөрчлөгдөх бүрд QR-ыг дахин хэвлэх шаардлагатай болно. Код нь тогтмол,
 * агуулга нь сангаас ирнэ.
 */
export function qrValue(code) {
  return `GENNETEX-BOX:${String(code || '').trim()}`;
}

/** Уншсан QR-аас хайрцгийн кодыг гаргана. */
export function parseQr(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^GENNETEX-BOX:(.+)$/i);
  // Танихгүй формат ирвэл түүхий утгыг нь код гэж үзнэ — өөр системээр
  // хэвлэгдсэн QR, эсвэл гараар бичсэн код ажиллах ёстой.
  return (m ? m[1] : s).trim();
}

/**
 * Хайрцгийн QR-аас бөөнөөр бүртгэх.
 *
 * НЭГ барааны бүртгэл үүсгэж, доторх серийн дугаар бүрийг тусад нь
 * хадгална. Өмнө нь MAC тутамд ТУСДАА бараа үүсгэдэг байсан тул
 * "Бараа материал" жагсаалт ижил нэртэй хэдэн арван картаар дүүрдэг байв.
 */
export async function registerSerials({ boxCode, name, serials, category = 'material', unit = 'ширхэг', price = 0 }) {
  const data = await rpc('box_register_serials', {
    p_box_code: boxCode,
    p_name: name,
    p_serials: serials,
    p_category: category,
    p_unit: unit,
    p_price: price,
  });
  const row = Array.isArray(data) ? data[0] : data;
  // Баганын нэрс `r_` угтвартай: `returns table (item_id ...)` нь
  // PostgreSQL-д ГАРАЛТЫН ПАРАМЕТР болж, `on conflict (box_id, item_id)`
  // дотор хоёрдмол утгатай болж функцийг унагадаг байв.
  return {
    itemId: row?.r_item_id,
    itemName: row?.r_item_name,
    added: Number(row?.r_added) || 0,
    skipped: Number(row?.r_skipped) || 0,
    totalInBox: Number(row?.r_total) || 0,
  };
}

/** Хайрцаг доторх серийн дугаарууд. */
export function fetchSerials(boxCode) {
  return rpc('box_serials_of', { p_box_code: String(boxCode || '').trim() });
}

/**
 * Хайрцгийг БҮТНЭЭР ажилтанд олгоно.
 *
 * Доторх бүх серийн дугаар тухайн хүний нэр дээр шилжиж, агуулахаас
 * хасагдана. Хайрцаг хоосорно — устахгүй, дахин ашиглана.
 */
export async function issueWholeBox({ boxCode, userId }) {
  const data = await rpc('box_issue_whole', { p_box_code: boxCode, p_user_id: userId });
  const row = Array.isArray(data) ? data[0] : data;
  return {
    items: Number(row?.issued_items) || 0,
    serials: Number(row?.issued_serials) || 0,
    employee: row?.employee || '',
  };
}
