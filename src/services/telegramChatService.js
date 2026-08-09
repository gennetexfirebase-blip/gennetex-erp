import { supabase } from '../lib/supabase';

const TABLE = 'telegram_chat_messages';

export async function fetchTelegramChatMessages(limit = 150) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function sendTelegramChatMessage({ content, senderId, senderName }) {
  const body = String(content || '').trim();
  if (!body) throw new Error('Мессеж хоосон байж болохгүй');

  const { data, error } = await supabase.functions.invoke('telegram-chat-send', {
    body: { content: body },
  });
  if (error) throw error;
  if (data?.ok === false) {
    throw new Error(data?.error || 'Telegram илгээх амжилтгүй');
  }
  return { ok: true, senderId, senderName, content: body };
}

export async function getTelegramLinkStatus() {
  const { data, error } = await supabase.functions.invoke('telegram-link', {
    body: { action: 'status' },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data?.error || 'status_failed');
  return data;
}

export async function createTelegramLink() {
  const { data, error } = await supabase.functions.invoke('telegram-link', {
    body: { action: 'create' },
  });
  if (error) throw error;
  if (data?.ok === false) {
    throw new Error(data?.error || 'Холбох холбоос үүсгэж чадсангүй');
  }
  return data;
}

export async function unlinkTelegram() {
  const { data, error } = await supabase.functions.invoke('telegram-link', {
    body: { action: 'unlink' },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data?.error || 'unlink_failed');
  return data;
}

export function subscribeTelegramChat(onInsert) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('telegram-chat-live')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE },
      (payload) => {
        if (payload?.new) onInsert(payload.new);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
