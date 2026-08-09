import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

function safeText(v: unknown, max = 2000) {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export function isBroadcastCommand(text: string): boolean {
  return text.trim().startsWith("!");
}

export function broadcastBody(text: string): string {
  const t = text.trim();
  return t.startsWith("!") ? t.slice(1).trim() || t : t;
}

export async function insertTelegramChatMessage(
  sb: SupabaseClient,
  row: {
    sender_id?: string | null;
    sender_name: string;
    content: string;
    source: "app" | "telegram";
    telegram_message_id?: number | null;
  },
) {
  const { data, error } = await sb
    .from("telegram_chat_messages")
    .insert({
      sender_id: row.sender_id || null,
      sender_name: safeText(row.sender_name, 120),
      content: safeText(row.content, 4000),
      source: row.source,
      telegram_message_id: row.telegram_message_id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAllPushTokens(sb: SupabaseClient, excludeUserId?: string | null) {
  const { data: rows } = await sb.from("push_tokens").select("token, user_id");
  const tokens = [...new Set(
    (rows || [])
      .filter((r) => r.token && (!excludeUserId || r.user_id !== excludeUserId))
      .map((r) => r.token),
  )];
  return tokens;
}

export async function sendExpoPush(tokens: string[], payload: Record<string, unknown>) {
  if (!tokens.length) return;
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(chunk.map((to) => ({ to, ...payload }))),
    });
  }
}

export async function notifyTelegramChatPush(
  sb: SupabaseClient,
  { senderName, content, excludeUserId }: { senderName: string; content: string; excludeUserId?: string | null },
) {
  const tokens = await fetchAllPushTokens(sb, excludeUserId);
  const preview = safeText(content, 160);
  await sendExpoPush(tokens, {
    title: `Telegram · ${safeText(senderName, 40)}`,
    body: preview,
    sound: "default",
    priority: "high",
    channelId: "chat",
    data: { type: "telegram_chat", senderName },
  });
}

export function telegramSenderName(from: Record<string, unknown> | undefined): string {
  if (!from || typeof from !== "object") return "Telegram";
  const first = String(from.first_name || "").trim();
  const last = String(from.last_name || "").trim();
  const user = String(from.username || "").trim();
  const full = [first, last].filter(Boolean).join(" ");
  return full || (user ? `@${user}` : "Telegram");
}

export async function findProfileByTelegramUserId(
  sb: SupabaseClient,
  telegramUserId: number | string | null | undefined,
) {
  if (telegramUserId == null || telegramUserId === "") return null;
  const { data } = await sb
    .from("profiles")
    .select("id, name, telegram_username")
    .eq("telegram_user_id", Number(telegramUserId))
    .maybeSingle();
  return data || null;
}

export async function linkTelegramAccount(
  sb: SupabaseClient,
  {
    token,
    telegramUserId,
    telegramUsername,
  }: {
    token: string;
    telegramUserId: number;
    telegramUsername?: string | null;
  },
) {
  const now = new Date().toISOString();
  const { data: row, error } = await sb
    .from("telegram_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (error || !row) return { ok: false as const, error: "invalid_token" };
  if (row.used_at) return { ok: false as const, error: "token_used" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false as const, error: "token_expired" };
  }

  const { data: taken } = await sb
    .from("profiles")
    .select("id")
    .eq("telegram_user_id", telegramUserId)
    .neq("id", row.user_id)
    .maybeSingle();
  if (taken) return { ok: false as const, error: "telegram_already_linked" };

  const { error: updErr } = await sb
    .from("profiles")
    .update({
      telegram_user_id: telegramUserId,
      telegram_username: telegramUsername || null,
      telegram_linked_at: now,
    })
    .eq("id", row.user_id);
  if (updErr) return { ok: false as const, error: "profile_update_failed" };

  await sb
    .from("telegram_link_tokens")
    .update({ used_at: now })
    .eq("id", row.id);

  const { data: profile } = await sb
    .from("profiles")
    .select("id, name")
    .eq("id", row.user_id)
    .maybeSingle();

  return { ok: true as const, profile };
}

export async function handleIncomingTelegramChat(
  sb: SupabaseClient,
  msg: Record<string, unknown>,
  text: string,
) {
  const from = (msg.from && typeof msg.from === "object" ? msg.from : {}) as Record<string, unknown>;
  if (from.is_bot) return { saved: false, reason: "bot_message" };

  const tgId = typeof from.id === "number" ? from.id : Number(from.id);
  const linked = Number.isFinite(tgId) ? await findProfileByTelegramUserId(sb, tgId) : null;
  const senderName = linked?.name
    ? safeText(linked.name, 120)
    : telegramSenderName(from);
  const messageId = typeof msg.message_id === "number" ? msg.message_id : null;

  if (messageId) {
    const { data: dup } = await sb
      .from("telegram_chat_messages")
      .select("id")
      .eq("telegram_message_id", messageId)
      .maybeSingle();
    if (dup) return { saved: false, reason: "duplicate" };
  }

  await insertTelegramChatMessage(sb, {
    sender_id: linked?.id || null,
    sender_name: senderName,
    content: text,
    source: "telegram",
    telegram_message_id: messageId,
  });

  await notifyTelegramChatPush(sb, {
    senderName,
    content: text,
    excludeUserId: linked?.id || null,
  });
  return { saved: true, linked: !!linked };
}
