import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Хэрэглэгчийн контентын гомдол ба хэрэглэгч хаах (App Store 1.2).
 *
 * Пост, сэтгэгдэл, чатын мессежийн цэсэнд «Мэдээлэх», «Хаах» товч
 * гарна. Гомдол админуудад Мэдэгдлийн төвөөр очно; хаасан хэрэглэгчийн
 * контент энэ хэрэглэгчээс нуугдана.
 */

const REASONS = [
  { key: 'inappropriate', label: 'Зохисгүй контент' },
  { key: 'harassment', label: 'Доромжлол, дарамт' },
  { key: 'spam', label: 'Спам' },
  { key: 'other', label: 'Бусад' },
];

let blocked = new Map(); // userId -> name
let loadedFor = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(new Set(blocked.keys())));

export async function loadBlockedUsers(meId) {
  if (!meId) return new Set();
  const { data, error } = await supabase.from('user_blocks').select('blocked_id, blocked_name').eq('blocker_id', meId);
  if (!error) {
    blocked = new Map((data || []).map((r) => [String(r.blocked_id), r.blocked_name || '']));
    loadedFor = meId;
    emit();
  }
  return new Set(blocked.keys());
}

export function listBlockedUsers() {
  return [...blocked.entries()].map(([id, name]) => ({ id, name }));
}

/** Хаасан хэрэглэгчдийн Set — өөрчлөгдөхөд дахин render хийнэ. */
export function useBlockedUsers(meId) {
  const [set, setSet] = useState(() => new Set(blocked.keys()));
  useEffect(() => {
    listeners.add(setSet);
    if (meId && loadedFor !== meId) loadBlockedUsers(meId);
    return () => listeners.delete(setSet);
  }, [meId]);
  return set;
}

export async function blockUser(me, user) {
  if (!me?.id || !user?.id || String(user.id) === String(me.id)) return;
  const { error } = await supabase
    .from('user_blocks')
    .upsert({ blocker_id: me.id, blocked_id: user.id, blocked_name: user.name || null }, { onConflict: 'blocker_id,blocked_id' });
  if (error) throw error;
  blocked.set(String(user.id), user.name || '');
  emit();
}

export async function unblockUser(me, userId) {
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', me.id).eq('blocked_id', userId);
  if (error) throw error;
  blocked.delete(String(userId));
  emit();
}

export async function reportContent(me, { targetType, targetId, targetUser, excerpt, reason }) {
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: me.id,
    reporter_name: me.name || null,
    target_type: targetType,
    target_id: targetId ? String(targetId) : null,
    target_user_id: targetUser?.id || null,
    target_user_name: targetUser?.name || null,
    reason,
    excerpt: excerpt ? String(excerpt).slice(0, 500) : null,
  });
  if (error) throw error;
}

/** «Мэдээлэх» — шалтгаан сонгуулж гомдол илгээнэ. */
export function promptReport(me, target) {
  Alert.alert('Мэдээлэх', 'Яагаад мэдээлж байна вэ? Гомдлыг админ 24 цагийн дотор шалгана.', [
    ...REASONS.map((r) => ({
      text: r.label,
      onPress: async () => {
        try {
          await reportContent(me, { ...target, reason: r.key });
          Alert.alert(
            'Баярлалаа',
            'Таны гомдлыг админд илгээлээ.' + (target.targetUser?.id ? ' Энэ хүнийг хаахыг хүсвэл цэснээс «Хэрэглэгчийг хаах»-ыг сонгоно уу.' : '')
          );
        } catch (e) {
          Alert.alert('Алдаа', e?.message || 'Илгээж чадсангүй.');
        }
      },
    })),
    { text: 'Болих', style: 'cancel' },
  ]);
}

/** «Хэрэглэгчийг хаах» — баталгаажуулаад хаана. */
export function confirmBlock(me, user, onDone) {
  if (!user?.id) return;
  Alert.alert(
    `${user.name || 'Энэ хэрэглэгч'}-ийг хаах уу?`,
    'Түүний пост, сэтгэгдэл, мессеж танд харагдахгүй болно. Профайл → Нууцлал хэсгээс буцааж нээж болно.',
    [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Хаах',
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(me, user);
            onDone?.();
          } catch (e) {
            Alert.alert('Алдаа', e?.message || 'Хааж чадсангүй.');
          }
        },
      },
    ]
  );
}

/** Бусдын контентод зориулсан цэсийн мөрүүд (Alert товчлууд). */
export function moderationActions(me, { targetType, targetId, targetUser, excerpt }, onBlocked) {
  if (!me?.id || !targetUser?.id || String(targetUser.id) === String(me.id)) return [];
  return [
    { text: 'Мэдээлэх', onPress: () => promptReport(me, { targetType, targetId, targetUser, excerpt }) },
    { text: 'Хэрэглэгчийг хаах', style: 'destructive', onPress: () => confirmBlock(me, targetUser, onBlocked) },
  ];
}
