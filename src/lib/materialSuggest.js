/**
 * Call type → ихэвчлэн зарцуулагддаг бараа (санал болгох).
 * CloseCallModal болон workflow-д нэмэлтээр ашиглана.
 */
import { CALL_TYPES } from '../data/mockData';

/** name substring / keywords → catalog-аас хайх */
export const MATERIAL_SUGGEST_BY_TYPE = {
  new: [
    { keywords: ['onu', 'онт'], qty: 1, reason: 'Шинэ айл — ONU' },
    { keywords: ['оптик кабель', 'fiber'], qty: 50, reason: 'Оптик кабель' },
    { keywords: ['патч', 'patch'], qty: 2, reason: 'Патч корд' },
    { keywords: ['адаптер'], qty: 2, reason: 'Оптик адаптер' },
    { keywords: ['боолт', 'стяжка'], qty: 1, reason: 'Кабель боолт' },
  ],
  t30: [
    { keywords: ['onu', 'онт'], qty: 1, reason: 'Шилжүүлэг — ONU' },
    { keywords: ['патч', 'patch'], qty: 1, reason: 'Патч корд' },
  ],
  t100: [
    { keywords: ['onu', 'онт'], qty: 1, reason: 'Шилжүүлэг 100k' },
    { keywords: ['router', 'чиглүүлэгч'], qty: 1, reason: 'Router' },
    { keywords: ['utp', 'cat6'], qty: 20, reason: 'UTP кабель' },
  ],
  gombol: [
    { keywords: ['патч', 'patch'], qty: 1, reason: 'Гомдол — солих' },
    { keywords: ['адаптер'], qty: 1, reason: 'Адаптер' },
  ],
  repair: [
    { keywords: ['utp', 'cat6'], qty: 10, reason: 'Засвар — кабель' },
    { keywords: ['rj45'], qty: 4, reason: 'RJ45' },
    { keywords: ['адаптер', 'тэжээл'], qty: 1, reason: 'Тэжээл/адаптер' },
  ],
  other: [
    { keywords: ['кабель'], qty: 5, reason: 'Ерөнхий' },
  ],
};

function matchItem(catalogItem, keywords) {
  const name = String(catalogItem?.name || '').toLowerCase();
  return keywords.some((k) => name.includes(String(k).toLowerCase()));
}

/**
 * @param {string} callType — CALL_TYPES key
 * @param {Array} catalogItems — inventory rows
 * @param {Array} stockItems — employee stock (optional, prefer available)
 */
export function suggestMaterialsForCall(callType, catalogItems = [], stockItems = []) {
  const rules = MATERIAL_SUGGEST_BY_TYPE[callType] || MATERIAL_SUGGEST_BY_TYPE.other;
  const stockMap = {};
  (stockItems || []).forEach((s) => {
    stockMap[s.item_id] = Number(s.quantity) || 0;
  });

  const suggestions = [];
  const usedIds = new Set();

  for (const rule of rules) {
    const candidates = (catalogItems || []).filter(
      (it) => (it.category || 'material') !== 'tool' && matchItem(it, rule.keywords)
    );
    // Prefer items that engineer has in stock
    candidates.sort((a, b) => (stockMap[b.id] || 0) - (stockMap[a.id] || 0));
    const pick = candidates.find((c) => !usedIds.has(c.id));
    if (!pick) continue;
    usedIds.add(pick.id);
    suggestions.push({
      id: pick.id,
      name: pick.name,
      unit: pick.unit || 'ширхэг',
      qty: rule.qty,
      reason: rule.reason,
      stockQty: stockMap[pick.id] || 0,
      price: Number(pick.price) || 0,
    });
  }
  return suggestions;
}

export function callTypeLabel(key) {
  return CALL_TYPES.find((t) => t.key === key)?.label || key || 'Бусад';
}

/** Нийт өртөг (мөнгөн дүн) */
export function estimateMaterialCost(materials = [], catalogItems = []) {
  const priceMap = {};
  (catalogItems || []).forEach((it) => {
    priceMap[it.id] = Number(it.price) || 0;
  });
  let total = 0;
  const lines = (materials || []).map((m) => {
    const price = m.price != null ? Number(m.price) : priceMap[m.id] || 0;
    const qty = Number(m.qty || m.quantity) || 0;
    const line = price * qty;
    total += line;
    return { ...m, unitPrice: price, lineTotal: line };
  });
  return { total, lines };
}
