import { supabase } from '../lib/supabase';

/**
 * Ажилтны одоогийн дэлгэц/үйлдэл — зөвхөн realtime presence.
 * Database-д хадгалахгүй. Админ шууд харж болно, ажилтанд мэдэгдэл гарахгүй.
 */

const CHANNEL = 'employee-screen-presence';

let channel = null;
let me = { userId: null, userName: null };

const SCREEN_LABELS = {
  Home: 'Нүүр',
  Attendance: 'Ирц',
  Feed: 'Пост',
  Chat: 'Чат',
  Profile: 'Профайл',
  Conversation: 'Чат яриа',
  Inventory: 'Бараа авах',
  Tools: 'Багаж авах',
  MyStock: 'Миний үлдэгдэл',
  MyTools: 'Миний багаж',
  StockLog: 'Хэн авсан',
  SiteWork: 'Ажлын байр',
  Calls: 'Дуудлага',
  Vehicle: 'Машин',
  Fuel: 'Бензин',
  Meeting: 'Хурал',
  GennetexAi: 'Gennetex AI',
  Employees: 'Ажилчид',
  Live: 'Байршил',
  FeedPost: 'Пост дэлгэрэнгүй',
  FeedProfile: 'Профайл (пост)',
  NewGroup: 'Шинэ групп',
  MyShift: 'Хуваарь',
  EmployeeReport: 'Тайлан',
  EmployeeDirectory: 'Ажилтны мэдээлэл',
  ChatArchive: 'Чат архив',
  ChatShared: 'Хуваалцсан файл',
  AdminReports: 'Тайлан (админ)',
  VehiclesAdmin: 'Машины мэдээлэл солих',
  VehicleSpecs: 'Машины оншилгоо',
  ToolAllocation: 'Үлдэгдэл',
  AiInventoryHome: 'AI Inventory',
  InventoryCamera: 'AI камер',
};

export function screenLabel(name) {
  return SCREEN_LABELS[name] || name || '—';
}

export function startScreenPresence(userId, userName) {
  if (!userId) return;
  me = { userId, userName: userName || 'Ажилтан' };
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch (e) {}
    channel = null;
  }

  channel = supabase.channel(CHANNEL, {
    config: { presence: { key: userId } },
  });

  channel.subscribe(async (status) => {
    if (status !== 'SUBSCRIBED') return;
    try {
      await channel.track({
        user_id: me.userId,
        user_name: me.userName,
        screen: null,
        screen_label: 'Апп нээлттэй',
        detail: null,
        at: new Date().toISOString(),
      });
    } catch (e) {}
  });
}

export async function publishScreenPresence({ screen, detail }) {
  if (!channel || !me.userId) return;
  try {
    await channel.track({
      user_id: me.userId,
      user_name: me.userName,
      screen: screen || null,
      screen_label: screenLabel(screen),
      detail: detail ? String(detail).slice(0, 200) : null,
      at: new Date().toISOString(),
    });
  } catch (e) {}
}

export function stopScreenPresence() {
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch (e) {}
    channel = null;
  }
  me = { userId: null, userName: null };
}

/**
 * Админ web / апп: ижил channel дээр presence сонсоно (DB биш).
 * onSync(list) — [{ user_id, user_name, screen, screen_label, detail, at }]
 */
export function subscribeScreenPresence(onSync) {
  const ch = supabase.channel(CHANNEL, {
    config: { presence: { key: `watcher-${Math.random().toString(36).slice(2)}` } },
  });

  const emit = () => {
    try {
      const state = ch.presenceState();
      const byUser = {};
      Object.values(state || {}).forEach((arr) => {
        (arr || []).forEach((p) => {
          if (!p?.user_id) return;
          // watcher-үүдийг алгасна
          if (String(p.user_id).startsWith('watcher')) return;
          const prev = byUser[p.user_id];
          if (!prev || String(p.at || '') >= String(prev.at || '')) {
            byUser[p.user_id] = p;
          }
        });
      });
      onSync?.(
        Object.values(byUser).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      );
    } catch (e) {
      onSync?.([]);
    }
  };

  ch.on('presence', { event: 'sync' }, emit);
  ch.on('presence', { event: 'join' }, emit);
  ch.on('presence', { event: 'leave' }, emit);

  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // Админ зөвхөн сонсоно — track хийхгүй (эсвэл хоосон watcher)
      try {
        await ch.track({ user_id: 'watcher', user_name: 'Админ', at: new Date().toISOString() });
      } catch (e) {}
      emit();
    }
  });

  return () => {
    try {
      supabase.removeChannel(ch);
    } catch (e) {}
  };
}
