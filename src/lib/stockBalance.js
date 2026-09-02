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
    /**
     * ⚠️ `user_id` нь NULL байж БОЛНО.
     *
     *    Аппад ороогүй ажилтанд олгосон мөр нь `user_email`-ээр
     *    тэмдэглэгддэг (uuid байхгүй тул). И-мэйлийг түлхүүрт
     *    оруулахгүй бол тэдгээр бүх мөр `user_name` дээр нийлж,
     *    ижил нэртэй хоёр хүн нэг болж харагдана.
     */
    const uid = m.user_id || (m.user_email ? `email:${String(m.user_email).toLowerCase()}` : m.user_name);
    if (!uid) return;
    if (!byUser[uid]) {
      byUser[uid] = {
        user_id: m.user_id,
        user_email: m.user_email || null,
        user_name: m.user_name || 'Тодорхойгүй',
        items: {},
      };
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
        /**
         * Хэн олгосон бэ.
         *
         * ⚠️ `issued_by_name` нь ХУДАЛДАН АВАЛТААС хойш бүртгэгддэг ч
         *    хаана ч харагддаггүй байв. Маргаан гарахад "энэ барааг хэн
         *    олгосон юм бэ" гэдгийг мэдэх ямар ч арга байгаагүй.
         *
         *    Нэг бараа хэд хэдэн удаа, өөр өөр админаас олгогдож болно
         *    тул жагсаалт болгож цуглуулаад, хамгийн сүүлийнхийг нь
         *    түрүүлж харуулна.
         */
        issuers: [],
      };
    }
    const slot = byUser[uid].items[key];
    slot.quantity += movementDelta(m);

    // Зөвхөн ОЛГОЛТ дээр олгогчийг тэмдэглэнэ — буцаалт дээр биш.
    if (movementDelta(m) > 0 && (m.issued_by_name || m.issued_by)) {
      const name = m.issued_by_name || 'Админ';
      const prev = slot.issuers.find((x) => x.name === name);
      if (prev) {
        prev.count += 1;
        if (m.created_at && m.created_at > prev.at) prev.at = m.created_at;
      } else {
        slot.issuers.push({ name, at: m.created_at || '', count: 1 });
      }
    }
  });
  return Object.values(byUser)
    .map((u) => ({
      ...u,
      items: Object.values(u.items)
        .filter((it) => it.quantity > 0.0001)
        // Сүүлд олгосон нь эхэнд — маргаан ихэвчлэн хамгийн сүүлийн
        // олголтын тухай гардаг.
        .map((it) => ({
          ...it,
          issuers: it.issuers.sort((a, b) => String(b.at).localeCompare(String(a.at))),
        })),
    }))
    .filter((u) => u.items.length > 0)
    .sort((a, b) => (a.user_name || '').localeCompare(b.user_name || '', 'mn'));
}
