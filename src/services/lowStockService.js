/**
 * Low-stock alerts + reorder draft.
 */
import { supabase } from '../lib/supabase';
import { isFlagOn } from '../lib/featureFlags';
import * as notifyApi from './notificationService';

export const DEFAULT_LOW_THRESHOLD = 5;

/**
 * @param {Array} inventory — { id, name, quantity, min_stock?, category, unit, price }
 */
export function findLowStockItems(inventory = [], defaultThreshold = DEFAULT_LOW_THRESHOLD) {
  return (inventory || [])
    .filter((it) => {
      const qty = Number(it.quantity) || 0;
      const min = it.min_stock != null ? Number(it.min_stock) : defaultThreshold;
      return qty <= min;
    })
    .map((it) => ({
      ...it,
      threshold: it.min_stock != null ? Number(it.min_stock) : defaultThreshold,
      deficit: Math.max(
        0,
        (it.min_stock != null ? Number(it.min_stock) : defaultThreshold) - (Number(it.quantity) || 0)
      ),
    }))
    .sort((a, b) => a.quantity - b.quantity);
}

export function buildReorderDraft(lowItems = []) {
  return (lowItems || []).map((it) => {
    const target = Math.max((it.threshold || DEFAULT_LOW_THRESHOLD) * 3, 10);
    const qty = Math.max(target - (Number(it.quantity) || 0), it.deficit || 1);
    return {
      item_id: it.id,
      name: it.name,
      unit: it.unit || 'ширхэг',
      current: Number(it.quantity) || 0,
      order_qty: qty,
      est_cost: qty * (Number(it.price) || 0),
      category: it.category || 'material',
    };
  });
}

export async function fetchLowStockFromCloud(defaultThreshold = DEFAULT_LOW_THRESHOLD) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('quantity', { ascending: true })
    .limit(500);
  if (error) throw error;
  return findLowStockItems(data || [], defaultThreshold);
}

export async function alertAdminsLowStock(lowItems, adminIds = []) {
  if (!isFlagOn('lowStockAlerts') || !lowItems?.length) return;
  const top = lowItems.slice(0, 5).map((i) => `${i.name} (${i.quantity})`).join(', ');
  const body = `Дуусаж буй бараа: ${top}${lowItems.length > 5 ? ` +${lowItems.length - 5}` : ''}`;
  try {
    if (adminIds?.length) {
      await notifyApi.notifyUsers(adminIds, {
        title: '⚠️ Агуулах — бага үлдэгдэл',
        body,
        data: { type: 'low_stock' },
        channelId: 'chat',
      });
    }
  } catch {}
  if (supabase) {
    try {
      await supabase.from('stock_alerts').insert({
        kind: 'low_stock',
        payload: { items: lowItems.slice(0, 50), message: body },
      });
    } catch {}
  }
}

export async function saveReorderRequest(draft, { userId, userName } = {}) {
  if (!supabase || !draft?.length) return null;
  const { data, error } = await supabase
    .from('reorder_requests')
    .insert({
      items: draft,
      status: 'draft',
      created_by: userId || null,
      created_by_name: userName || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
