export const MOVEMENT_TYPES = {
  WITHDRAW: 'withdraw',
  CONSUME: 'consume',
  RETURN: 'return',
};

/** Олголт (+), хэрэглээ/буцаалт (−) */
export function movementDelta(m) {
  const q = Number(m.quantity) || 0;
  const type = m.movement_type || MOVEMENT_TYPES.WITHDRAW;
  if (type === MOVEMENT_TYPES.WITHDRAW) return q;
  if (type === MOVEMENT_TYPES.CONSUME || type === MOVEMENT_TYPES.RETURN) return -q;
  return q;
}

export function movementTypeLabel(type) {
  if (type === MOVEMENT_TYPES.CONSUME) return 'Хэрэглээ';
  if (type === MOVEMENT_TYPES.RETURN) return 'Буцаалт';
  return 'Олголт';
}

/**
 * Ажилтан / барааны үлдэгдэл = олголт − хэрэглээ − буцаалт
 */
export function computeBalances(movements, options = {}) {
  const { userId, itemId, category, inventoryById = {} } = options;
  const map = {};
  (movements || []).forEach((m) => {
    if (userId && m.user_id !== userId) return;
    if (itemId && m.item_id !== itemId) return;
    const cat = inventoryById[m.item_id]?.category || m.category || 'material';
    if (category && cat !== category) return;
    const key = m.item_id || m.item_name;
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        item_id: m.item_id,
        item_name: m.item_name || '—',
        unit: m.unit || 'ширхэг',
        category: cat,
        quantity: 0,
        user_id: m.user_id,
        user_name: m.user_name,
      };
    }
    map[key].quantity += movementDelta(m);
  });
  return Object.values(map)
    .filter((x) => x.quantity > 0.0001)
    .sort((a, b) => b.quantity - a.quantity);
}

/** Нэг барааны ажилтан бүрийн үлдэгдэл */
export function computeHoldersByItem(movements, itemId) {
  const map = {};
  (movements || [])
    .filter((m) => m.item_id === itemId)
    .forEach((m) => {
      const key = m.user_id || m.user_name || 'unknown';
      if (!map[key]) {
        map[key] = { user_id: m.user_id, name: m.user_name || 'Тодорхойгүй', qty: 0 };
      }
      map[key].qty += movementDelta(m);
    });
  return Object.values(map)
    .filter((h) => h.qty > 0.0001)
    .sort((a, b) => b.qty - a.qty);
}

/** Ажилтан бүрийн үлдэгдлийн жагсаалт */
export function computeBalancesByUser(movements, inventoryById = {}) {
  const byUser = {};
  (movements || []).forEach((m) => {
    const uid = m.user_id || m.user_name;
    if (!uid) return;
    if (!byUser[uid]) {
      byUser[uid] = { user_id: m.user_id, user_name: m.user_name || 'Тодорхойгүй', items: {} };
    }
    const key = m.item_id || m.item_name;
    if (!key) return;
    if (!byUser[uid].items[key]) {
      byUser[uid].items[key] = {
        item_id: m.item_id,
        item_name: m.item_name || '—',
        unit: m.unit || 'ширхэг',
        category: inventoryById[m.item_id]?.category || m.category || 'material',
        quantity: 0,
      };
    }
    byUser[uid].items[key].quantity += movementDelta(m);
  });
  return Object.values(byUser)
    .map((u) => ({
      ...u,
      items: Object.values(u.items).filter((it) => it.quantity > 0.0001),
    }))
    .filter((u) => u.items.length > 0)
    .sort((a, b) => (a.user_name || '').localeCompare(b.user_name || '', 'mn'));
}
