import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { MOVEMENT_TYPES, computeBalances, movementDelta } from '../lib/stockBalance';

const TABLE = 'inventory';
const BUCKET = 'inventory';

async function uploadImage(uri, folder) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadInventoryImage(uri) {
  return uploadImage(uri, 'items');
}

export async function uploadMovementPhoto(uri) {
  return uploadImage(uri, 'movements');
}

export async function fetchInventory() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}

export async function fetchItemByBarcode(barcode) {
  const code = String(barcode || '').trim();
  if (!code) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('barcode', code)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

export async function insertInventory(item) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      price: item.price,
      barcode: item.barcode || null,
      image_url: item.image_url || null,
      category: item.category || 'material',
      // `null` = НИЙТИЙН бараа (бүх хэлтэс харна). Хэлтэс сонгосон бол
      // зөвхөн тэр хэлтсийнхэнд харагдана — шүүлт нь RLS дээр.
      department_id: item.department_id || null,
      // Хангамжийн размер. Размер бүр тусдаа мөр — тус бүр өөрийн
      // үлдэгдэлтэй. `size_group` нь тэдгээрийг нэг бараа болгож холбоно.
      size: item.size || null,
      size_group: item.size_group || null,
    })
    .select()
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updateInventory(id, patch) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deleteInventory(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

// Бараа олгох: тоо хасаад олголтын лог үүсгэнэ
export async function withdrawInventory({
  item, userId, userEmail, userName, qty, photoUrl, issuedBy, issuedByName,
}) {
  const newQty = Math.max(0, (Number(item.quantity) || 0) - qty);
  const unitPrice = Math.max(0, Number(item.price) || 0);
  await updateInventory(item.id, { quantity: newQty });
  const { error } = await supabase.from('stock_movements').insert({
    item_id: item.id,
    item_name: item.name,
    unit: item.unit,
    // ХЭНД олгосон.
    //
    // ⚠️ Аппад ороогүй ажилтанд `user_id` БАЙХГҮЙ — тэр нь uuid багана
    //    тул `pending:<email>` гэж бичвэл өгөгдлийн сан унана. Тийм
    //    үед `user_email` нь хүнийг заана; тэр хүн хожим нэвтрэхэд
    //    `link_pending_assignments` trigger нь мөрүүдийг автоматаар
    //    профайлтай нь холбоно.
    user_id: userId || null,
    user_email: userEmail || null,
    user_name: userName,
    // ХЭН олгосон — тайланд "аль админ хэнд юу олгосон" гэж харуулна.
    issued_by: issuedBy || null,
    issued_by_name: issuedByName || null,
    quantity: qty,
    movement_type: MOVEMENT_TYPES.WITHDRAW,
    unit_price: unitPrice,
    total_amount: unitPrice * qty,
    photo_url: photoUrl || null,
  });
  if (error) {
    // Олголтын лог бичигдээгүй бол агуулахын хасалтыг буцааж сэргээнэ.
    await updateInventory(item.id, { quantity: Number(item.quantity) || 0 }).catch(() => {});
    throw error;
  }
  return newQty;
}

/**
 * Буруу олголтыг буцаах — зөвхөн админ.
 * Сервер нэг transaction дотор ажилтны буцаалтын лог үүсгээд
 * агуулахын үлдэгдлийг сэргээнэ.
 */
export async function reverseStockMovement(movementId) {
  const { data, error } = await supabase.rpc('admin_reverse_stock_movement', {
    p_movement_id: movementId,
  });
  if (error) throw error;
  return data;
}

/** Ажилтны үлдэгдлээс хэрэглэх */
export async function consumeInventory({ item, userId, userName, qty }) {
  const q = Math.max(1, Number(qty) || 0);
  const movements = await fetchMyMovements(userId, 500);
  const balances = computeBalances(movements, { userId, itemId: item.id });
  const balance = balances[0]?.quantity || 0;
  if (q > balance) {
    throw new Error(`Үлдэгдэл хүрэлцэхгүй (${balance} ${item.unit || 'ширхэг'})`);
  }
  const { error } = await supabase.from('stock_movements').insert({
    item_id: item.id,
    item_name: item.name,
    unit: item.unit,
    user_id: userId || null,
    user_name: userName,
    quantity: q,
    movement_type: MOVEMENT_TYPES.CONSUME,
  });
  if (error) throw error;
  return balance - q;
}

export async function fetchMovements(limit = 300) {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Агуулахын орлогын түүх — хамгийн сүүлийн орлого эхэндээ. */
export async function fetchInventoryReceipts(limit = 500) {
  const { data, error } = await supabase
    .from('inventory_receipts')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    quantity: Number(row.quantity) || 0,
    unit_price: Number(row.unit_price) || 0,
    total_amount: Number(row.total_amount) || 0,
  }));
}

/**
 * Бараа/багаж/хангамжид орлого авах.
 *
 * Сервер үлдэгдлийг нэмэх, дундаж өртгийг шинэчлэх, орлогын түүх үүсгэх
 * гурван үйлдлийг нэг transaction-д хийдэг тул тал дутуу хадгалагдахгүй.
 */
export async function receiveInventoryStock({ itemId, quantity, unitPrice, supplier, note, receivedAt }) {
  const { data, error } = await supabase.rpc('receive_inventory_stock', {
    p_item_id: itemId,
    p_quantity: Number(quantity),
    p_unit_price: Number(unitPrice) || 0,
    p_supplier: String(supplier || '').trim() || null,
    p_note: String(note || '').trim() || null,
    p_received_at: receivedAt || new Date().toISOString(),
  });
  if (error) throw error;
  return data;
}

export async function fetchMyMovements(userId, limit = 300) {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchMyBalances(userId, inventory = []) {
  const movements = await fetchMyMovements(userId, 500);
  const inventoryById = {};
  inventory.forEach((it) => {
    inventoryById[it.id] = it;
  });
  return computeBalances(movements, { userId, inventoryById });
}

function normalize(row) {
  return {
    ...row,
    quantity: Number(row.quantity) || 0,
    price: Number(row.price) || 0,
    category: row.category || 'material',
  };
}
