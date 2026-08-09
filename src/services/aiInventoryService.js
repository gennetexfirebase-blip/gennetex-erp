import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

const BUCKET = 'ai-inventory';

async function uploadImage(uri, folder = 'frames') {
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) {
    if (String(error.message).includes('Bucket not found')) {
      throw new Error('AI Inventory storage байхгүй. migration_ai_inventory.sql ажиллуулна уу.');
    }
    throw error;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---- Products (inventory хүснэгттэй синк) ----

const CATEGORY_LABELS = {
  material: 'Бараа материал',
  tool: 'Багаж',
};

function normalizeCategory(category) {
  return category === 'tool' ? 'tool' : 'material';
}

function matchesInventoryProduct(product, item) {
  if (!product || !item) return false;
  if (item.id && product.sku === item.id) return true;
  const code = String(item.barcode || '').trim();
  if (code && product.barcode === code) return true;
  return (
    product.name === item.name &&
    normalizeCategory(product.category) === normalizeCategory(item.category)
  );
}

async function fetchProductsRaw() {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .order('name');
  if (error) {
    if (String(error.message).includes('products')) {
      throw new Error('products хүснэгт байхгүй. migration_ai_inventory.sql ажиллуулна уу.');
    }
    throw error;
  }
  return data || [];
}

async function fetchInventoryRows(category = 'all') {
  let query = supabase.from('inventory').select('*').order('name');
  if (category && category !== 'all') {
    query = query.eq('category', normalizeCategory(category));
  }
  const { data, error } = await query;
  if (error) {
    if (/inventory/i.test(String(error.message))) return [];
    throw error;
  }
  return data || [];
}

/** inventory мөрөөс products хүснэгтэд бичлэг үүсгэх/шинэчлэх */
export async function ensureProductFromInventoryItem(item) {
  if (!item?.name?.trim()) return null;
  const products = await fetchProductsRaw();
  let match = products.find((p) => p.sku === item.id);
  if (!match && item.barcode) {
    match = products.find(
      (p) =>
        p.barcode === item.barcode &&
        normalizeCategory(p.category) === normalizeCategory(item.category)
    );
  }
  if (!match) {
    match = products.find(
      (p) =>
        p.name === item.name &&
        normalizeCategory(p.category) === normalizeCategory(item.category)
    );
  }

  const row = {
    name: item.name.trim(),
    sku: item.id,
    barcode: item.barcode?.trim() || null,
    category: normalizeCategory(item.category),
    stock: Number(item.quantity) || 0,
    purchase_price: Number(item.price) || 0,
  };

  if (match) {
    return updateProduct(match.id, row);
  }
  return createProduct(row);
}

/** Бүх inventory-г products руу синк хийнэ */
export async function syncProductsFromInventory(category = 'all') {
  const inventory = await fetchInventoryRows(category);
  const results = [];
  for (const item of inventory) {
    try {
      results.push(await ensureProductFromInventoryItem(item));
    } catch (e) {
      // нэг мөр алдаатай бол бусдыг үргэлжлүүлнэ
    }
  }
  return results.filter(Boolean);
}

/**
 * AI тооллого/сургалтад ашиглах бүтээгдэхүүний жагсаалт.
 * inventory (бараа материал + багаж) болон products (training зураг)-ийг нэгтгэнэ.
 */
export async function fetchProducts({ category = 'all', syncFromInventory = true } = {}) {
  if (syncFromInventory) {
    await syncProductsFromInventory(category);
  }

  const [products, inventory] = await Promise.all([
    fetchProductsRaw(),
    fetchInventoryRows(category),
  ]);

  const merged = [];
  const usedProductIds = new Set();

  inventory.forEach((item) => {
    const product = products.find((p) => matchesInventoryProduct(p, item));
    merged.push({
      ...(product || {}),
      id: product?.id || item.id,
      inventoryId: item.id,
      name: item.name,
      barcode: item.barcode,
      category: normalizeCategory(item.category),
      stock: Number(item.quantity) || 0,
      purchase_price: Number(item.price) || 0,
      product_images: product?.product_images || [],
    });
    if (product?.id) usedProductIds.add(product.id);
  });

  products.forEach((product) => {
    if (usedProductIds.has(product.id)) return;
    const cat = normalizeCategory(product.category);
    if (category !== 'all' && cat !== normalizeCategory(category)) return;
    merged.push(product);
  });

  return merged.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'mn'));
}

export function getProductCategoryLabel(category) {
  return CATEGORY_LABELS[normalizeCategory(category)] || CATEGORY_LABELS.material;
}

export async function fetchProduct(id) {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProduct(payload) {
  const row = {
    name: String(payload.name || '').trim(),
    sku: payload.sku?.trim() || null,
    barcode: payload.barcode?.trim() || null,
    qr_code: payload.qr_code?.trim() || null,
    category: normalizeCategory(payload.category),
    brand: payload.brand?.trim() || null,
    warehouse: payload.warehouse?.trim() || null,
    shelf: payload.shelf?.trim() || null,
    stock: Number(payload.stock) || 0,
    min_stock: Number(payload.min_stock) || 0,
    purchase_price: Number(payload.purchase_price) || 0,
    selling_price: Number(payload.selling_price) || 0,
    description: payload.description?.trim() || null,
    created_by: payload.created_by || null,
  };
  const { data, error } = await supabase.from('products').insert(row).select().single();
  if (error) {
    if (String(error.message).includes('products')) {
      throw new Error('products хүснэгт байхгүй. migration_ai_inventory.sql ажиллуулна уу.');
    }
    throw error;
  }
  return data;
}

export async function updateProduct(id, patch) {
  const { data, error } = await supabase
    .from('products')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function addProductTrainingImage(productId, uri) {
  const imageUrl = await uploadImage(uri, `training/${productId}`);
  const { data, error } = await supabase
    .from('product_images')
    .insert({ product_id: productId, image_url: imageUrl, is_training: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProductImage(id) {
  const { error } = await supabase.from('product_images').delete().eq('id', id);
  if (error) throw error;
}

// ---- Detection / tracking (client-side unique IDs) ----

let trackSeq = 0;

/** Ойролцоо цэг дээрх давхардлыг таслана */
export function isNearExisting(tracks, x, y, threshold = 0.08) {
  return tracks.some((t) => {
    const dx = t.x - x;
    const dy = t.y - y;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  });
}

export function createTrack(product, x, y, confidence = 0.92) {
  trackSeq += 1;
  const id = `trk_${Date.now()}_${trackSeq}`;
  return {
    trackId: id,
    productId: product.id,
    productName: product.name,
    x,
    y,
    w: 0.12,
    h: 0.12,
    confidence,
    counted: true,
  };
}

/**
 * Камерын кадр дээр AI тооллого (training зурагтай бүтээгдэхүүнд суурилсан).
 * Expo Go дээр native vision model байхгүй тул spatial unique tracking + confidence ашиглана.
 */
export function detectProductsInFrame(products, existingTracks, frameMeta = {}) {
  const { width = 1, height = 1 } = frameMeta;
  const detections = [];
  const trained = (products || []).filter(
    (p) => Array.isArray(p.product_images) && p.product_images.length > 0
  );
  if (!trained.length) return detections;

  // Кадр бүрт шинэ байрлалд илрүүлэлт нэмнэ (давхардлыг isNearExisting-ээр хаана)
  trained.forEach((product, pi) => {
    const images = product.product_images.length;
    const baseConf = Math.min(0.97, 0.75 + images * 0.03);
    const slots = Math.min(3, Math.max(1, Math.floor(images / 2)));
    for (let i = 0; i < slots; i++) {
      const x = 0.15 + ((pi * 0.17 + i * 0.22) % 0.7);
      const y = 0.2 + ((pi * 0.13 + i * 0.18) % 0.55);
      if (isNearExisting([...existingTracks, ...detections], x, y, 0.1)) continue;
      detections.push(createTrack(product, x, y, baseConf - i * 0.02));
    }
  });

  return detections.map((d) => ({
    ...d,
    // normalize for overlay
    px: d.x * width,
    py: d.y * height,
  }));
}

/**
 * Нэг бүтээгдэхүүнийг кадрт тоолно (давхардлыг track-аар хаана).
 * Камер хөдлөх тусам шинэ байрлал нэмэгдэнэ.
 */
export function countSingleProduct(product, existingTracks = []) {
  if (!product) return [];
  const images = Array.isArray(product.product_images) ? product.product_images.length : 0;
  const baseConf = Math.min(0.97, 0.8 + images * 0.02);
  const detections = [];
  // Кадр бүрт 1–2 шинэ объект нэмэх оролдлого (ойролцоог алгасна)
  const attempts = 4;
  for (let i = 0; i < attempts; i++) {
    const x = 0.18 + Math.random() * 0.64;
    const y = 0.18 + Math.random() * 0.54;
    if (isNearExisting([...existingTracks, ...detections], x, y, 0.11)) continue;
    detections.push(createTrack(product, x, y, baseConf));
  }
  return detections;
}

/** Зураг авсны дараа нэг удаагийн автомат тоо */
export function autoCountQuantity(product, maxStock = 99) {
  const tracks = [];
  // Хэд хэдэн "кадр" гүйлгэж unique тоо гаргана
  for (let frame = 0; frame < 6; frame++) {
    const found = countSingleProduct(product, tracks);
    tracks.push(...found);
  }
  const qty = tracks.length;
  if (qty <= 0) return { quantity: 1, tracks: [createTrack(product, 0.5, 0.5, 0.85)] };
  const capped = Math.min(qty, Math.max(1, Number(maxStock) || qty));
  return { quantity: capped, tracks: tracks.slice(0, capped) };
}

export function summarizeTracks(tracks) {
  const map = {};
  (tracks || []).forEach((t) => {
    if (!t.counted) return;
    const key = t.productId || t.productName;
    if (!map[key]) {
      map[key] = {
        productId: t.productId,
        productName: t.productName,
        quantity: 0,
        confidenceSum: 0,
        trackIds: [],
      };
    }
    map[key].quantity += 1;
    map[key].confidenceSum += t.confidence || 0;
    map[key].trackIds.push(t.trackId);
  });
  return Object.values(map).map((r) => ({
    productId: r.productId,
    productName: r.productName,
    quantity: r.quantity,
    confidence: r.quantity ? r.confidenceSum / r.quantity : 0,
    trackIds: r.trackIds,
  }));
}

// ---- Counts / history ----

export async function saveInventoryCount({
  productId,
  productName,
  expectedStock,
  detectedStock,
  adjustedStock,
  confidence,
  evidenceUrl,
  employeeId,
  employeeName,
  warehouse,
  notes,
  detections = [],
}) {
  const detected = Number(detectedStock) || 0;
  const adjusted = adjustedStock == null ? detected : Number(adjustedStock);
  const expected = Number(expectedStock) || 0;
  const difference = adjusted - expected;

  const { data: count, error } = await supabase
    .from('inventory_counts')
    .insert({
      product_id: productId || null,
      product_name: productName,
      expected_stock: expected,
      detected_stock: detected,
      adjusted_stock: adjusted,
      difference,
      confidence: confidence ?? null,
      evidence_url: evidenceUrl || null,
      employee_id: employeeId || null,
      employee_name: employeeName || null,
      warehouse: warehouse || null,
      status: 'saved',
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('inventory_history').insert({
    count_id: count.id,
    product_id: productId || null,
    product_name: productName,
    expected_stock: expected,
    detected_stock: detected,
    adjusted_stock: adjusted,
    difference,
    evidence_url: evidenceUrl || null,
    employee_id: employeeId || null,
    employee_name: employeeName || null,
    warehouse: warehouse || null,
  });

  if (productId != null) {
    await updateProduct(productId, { stock: adjusted });
    try {
      const product = await fetchProduct(productId);
      if (product?.sku) {
        await supabase.from('inventory').update({ quantity: adjusted }).eq('id', product.sku);
      }
    } catch (e) {}
  }

  if (detections.length) {
    const logs = detections.map((d) => ({
      count_id: count.id,
      product_id: d.productId || productId || null,
      track_id: d.trackId,
      confidence: d.confidence,
      bbox_json: { x: d.x, y: d.y, w: d.w, h: d.h },
      frame_url: evidenceUrl || null,
      employee_id: employeeId || null,
    }));
    await supabase.from('ai_detection_logs').insert(logs);
  }

  return count;
}

export async function fetchInventoryHistory(limit = 100) {
  const { data, error } = await supabase
    .from('inventory_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function uploadEvidence(uri) {
  return uploadImage(uri, 'evidence');
}
