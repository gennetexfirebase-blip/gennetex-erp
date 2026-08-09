/**
 * Tool check-in/out + damage photo condition.
 */
import { supabase } from '../lib/supabase';
import { isFlagOn } from '../lib/featureFlags';

export const CONDITIONS = [
  { key: 'ok', label: 'Хэвийн', color: '#16a34a' },
  { key: 'worn', label: 'Элэгдсэн', color: '#d97706' },
  { key: 'damaged', label: 'Гэмтэлтэй', color: '#dc2626' },
  { key: 'missing', label: 'Дутуу/алдагдсан', color: '#7c3aed' },
];

export async function logToolCondition({
  itemId,
  itemName,
  userId,
  userName,
  direction, // 'out' | 'in'
  condition,
  note,
  photoUrl,
  quantity = 1,
}) {
  if (!isFlagOn('toolCondition')) {
    return { skipped: true };
  }
  const row = {
    item_id: itemId,
    item_name: itemName,
    user_id: userId,
    user_name: userName,
    direction: direction || 'in',
    condition: condition || 'ok',
    note: note || null,
    photo_url: photoUrl || null,
    quantity: quantity || 1,
  };
  if (!supabase) {
    return { local: true, ...row, created_at: new Date().toISOString() };
  }
  const { data, error } = await supabase.from('tool_condition_logs').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function fetchToolConditionLogs({ itemId, userId, limit = 100 } = {}) {
  if (!supabase) return [];
  let q = supabase
    .from('tool_condition_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (itemId) q = q.eq('item_id', itemId);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export function requiresPhoto(condition) {
  return condition === 'damaged' || condition === 'missing';
}
