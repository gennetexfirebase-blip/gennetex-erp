import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendLogsPdfToTelegram } from "./logsPdf.ts";
import {
  broadcastBody,
  findProfileByTelegramUserId,
  handleIncomingTelegramChat,
  isBroadcastCommand,
  linkTelegramAccount,
  telegramSenderName,
} from "../_shared/chatBridge.ts";
import { isAuthorizedDeviceApprover, parseDeviceDecision } from "../_shared/deviceApproval.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

let cachedBotUsername: string | null = null;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeText(v: unknown, max = 500) {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

async function getBotUsername(botToken: string): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    cachedBotUsername = (data?.result?.username || "").toLowerCase() || null;
    return cachedBotUsername;
  } catch {
    return null;
  }
}

/** Групп дээр /log@Bot, @Bot log зэргийг энгийн текст болгоно */
function normalizeIncomingText(raw: string, botUsername: string | null): string {
  let t = raw.trim();
  if (t.startsWith("/")) {
    const m = t.match(/^\/([^\s@]+)(?:@[\w_]+)?(?:\s+(.*))?$/s);
    if (m) {
      const cmd = m[1] || "";
      const rest = (m[2] || "").trim();
      t = rest || cmd;
    }
  }
  if (botUsername) {
    t = t.replace(new RegExp(`@${botUsername}\\b`, "gi"), "").trim();
  }
  return t;
}

function isLogPdfCommand(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === "log" ||
    lower === "лог" ||
    lower === "pdf" ||
    lower === "лог pdf" ||
    lower === "pdf log" ||
    lower.startsWith("log ") ||
    lower.startsWith("лог ")
  );
}

function chatIdStr(id: unknown): string {
  return String(id ?? "");
}

function isGroupChat(chatType: string): boolean {
  return chatType === "group" || chatType === "supergroup";
}

function isAuthorizedChat(chatId: unknown, chatType: string): boolean {
  const id = chatIdStr(chatId);
  const logGroup = Deno.env.get("TELEGRAM_LOG_GROUP_ID") || "";
  const adminChat = Deno.env.get("TELEGRAM_CHAT_ID") || "";

  if (logGroup && id === logGroup) return true;
  if (adminChat && id === adminChat && chatType === "private") return true;
  return false;
}

async function sendExpoPush(tokens: string[], payload: Record<string, unknown>) {
  if (!tokens.length) return;
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        chunk.map((to) => ({
          to,
          ...payload,
        })),
      ),
    });
  }
}

async function sendTelegramReply(botToken: string, chatId: number | string, text: string) {
  if (!botToken || !chatId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: safeText(text, 900) }),
  }).catch(() => {});
}

async function answerCallback(botToken: string, callbackId: string, text: string, showAlert = false) {
  if (!botToken || !callbackId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text, show_alert: showAlert }),
  }).catch(() => {});
}

async function handleDeviceCallback(
  update: Record<string, unknown>,
  botToken: string,
  webhookSecret: string,
  sb: ReturnType<typeof createClient>,
) {
  const callback = update.callback_query as Record<string, unknown>;
  const callbackId = String(callback.id || "");
  const decision = parseDeviceDecision(callback.data);
  if (!decision) {
    await answerCallback(botToken, callbackId, "Танигдаагүй товч.", true);
    return jsonResponse({ ok: false, error: "invalid_callback" }, 400);
  }
  if (!webhookSecret) {
    await answerCallback(botToken, callbackId, "Ботын хамгаалалт тохируулаагүй байна.", true);
    return jsonResponse({ ok: false, error: "webhook_secret_required" }, 503);
  }

  const from = (callback.from || {}) as Record<string, unknown>;
  const message = (callback.message || {}) as Record<string, unknown>;
  const chat = (message.chat || {}) as Record<string, unknown>;
  const telegramId = Number(from.id);
  const { data: approver } = Number.isSafeInteger(telegramId)
    ? await sb.from("profiles").select("id,name,role,telegram_user_id")
      .eq("telegram_user_id", telegramId).maybeSingle()
    : { data: null };
  const allowed = isAuthorizedDeviceApprover({
    chatId: chat.id,
    chatType: chat.type,
    fromId: from.id,
    configuredAdminChatId: Deno.env.get("TELEGRAM_CHAT_ID"),
    profileRole: approver?.role,
    profileTelegramUserId: approver?.telegram_user_id,
  });
  if (!allowed) {
    await answerCallback(botToken, callbackId, "Зөвхөн эрхтэй админ хувийн чатаас шийднэ.", true);
    return jsonResponse({ ok: false, error: "approver_forbidden" }, 403);
  }

  const { data: row, error } = await sb.from("device_approvals").update({
    status: decision.status,
    decided_at: new Date().toISOString(),
    decided_by: approver?.role === "superadmin" ? approver.id : null,
    decided_by_name: approver?.role === "superadmin" ? approver.name : "Telegram админ",
  }).eq("id", decision.requestId).eq("status", "pending").select("id,user_name,device_model").maybeSingle();
  if (error) {
    await answerCallback(botToken, callbackId, "Шийдвэр хадгалагдсангүй. Дахин оролдоно уу.", true);
    return jsonResponse({ ok: false, error: "decision_failed" }, 500);
  }
  if (!row) {
    await answerCallback(botToken, callbackId, "Энэ хүсэлтийг аль хэдийн шийдсэн байна.", true);
    return jsonResponse({ ok: true, already_decided: true });
  }

  const outcome = decision.status === "approved" ? "✅ Зөвшөөрлөө" : "⛔ Татгалзлаа";
  await answerCallback(botToken, callbackId, outcome);
  if (chat.id && message.message_id) {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat.id,
        message_id: message.message_id,
        text: `🔐 Gennetex ERP · Шинэ төхөөрөмж\nАжилтан: ${safeText(row.user_name || "Ажилтан", 80)}\nТөхөөрөмж: ${safeText(row.device_model || "—", 80)}\n${outcome}`,
      }),
    }).catch(() => {});
  }
  return jsonResponse({ ok: true, action: "device_decision", status: decision.status });
}

async function fetchAllTokens(sb: ReturnType<typeof createClient>) {
  const { data: rows } = await sb.from("push_tokens").select("token");
  return [...new Set((rows || []).map((r) => r.token).filter(Boolean))];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  if (WEBHOOK_SECRET) {
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (headerSecret !== WEBHOOK_SECRET) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  let update: Record<string, unknown> = {};
  try {
    update = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ ok: false, error: "supabase_not_configured" }, 503);
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  if (update.callback_query && typeof update.callback_query === "object") {
    return await handleDeviceCallback(update, BOT_TOKEN, WEBHOOK_SECRET, sb);
  }

  const msg = (update.message && typeof update.message === "object" ? update.message : {}) as Record<string, unknown>;
  const chat = (msg.chat && typeof msg.chat === "object" ? msg.chat : {}) as Record<string, unknown>;
  const chatId = chat.id as number | string | undefined;
  const chatType = String(chat.type || "private");
  const rawText = safeText(msg.text || msg.caption || "", 500);
  const LOG_GROUP_ID = Deno.env.get("TELEGRAM_LOG_GROUP_ID") || "";

  if (!rawText || !chatId) return jsonResponse({ ok: true, ignored: true });

  const botUsername = await getBotUsername(BOT_TOKEN);
  const text = normalizeIncomingText(rawText, botUsername);
  if (!text) return jsonResponse({ ok: true, ignored: true });

  const from = (msg.from && typeof msg.from === "object" ? msg.from : {}) as Record<string, unknown>;
  const tgUserId = typeof from.id === "number" ? from.id : Number(from.id);
  const tgUsername = String(from.username || "").trim() || null;

  // /start link_<token> — ажилтан Telegram холбох
  const linkMatch = text.match(/^start\s+link_([a-f0-9]{16,64})$/i) ||
    text.match(/^link_([a-f0-9]{16,64})$/i);
  if (linkMatch && chatType === "private" && Number.isFinite(tgUserId)) {
    const result = await linkTelegramAccount(sb, {
      token: linkMatch[1],
      telegramUserId: tgUserId,
      telegramUsername: tgUsername,
    });
    if (result.ok) {
      const name = result.profile?.name || telegramSenderName(from);
      await sendTelegramReply(
        BOT_TOKEN,
        chatId,
        `✅ Холбогдлоо, ${name}!\n\nОдоо эндээс мессеж бичвэл Gennetex апп → Telegram чат руу орно.\nГрупп эсвэл аппаас ч чатлана.`,
      );
      return jsonResponse({ ok: true, action: "telegram_link", user_id: result.profile?.id });
    }
    const errMap: Record<string, string> = {
      invalid_token: "Холбох код буруу эсвэл олдсонгүй. Аппаас дахин «Telegram холбох» дарна уу.",
      token_used: "Энэ код аль хэдийн ашиглагдсан. Аппаас шинэ код авна уу.",
      token_expired: "Кодын хугацаа дууссан (15 мин). Аппаас дахин холбоно уу.",
      telegram_already_linked: "Энэ Telegram өөр ажилтантай холбогдсон байна.",
      profile_update_failed: "Профайл шинэчлэхэд алдаа гарлаа. Дахин оролдоно уу.",
    };
    await sendTelegramReply(BOT_TOKEN, chatId, `❌ ${errMap[result.error] || result.error}`);
    return jsonResponse({ ok: false, action: "telegram_link", error: result.error });
  }

  const linkedProfile = Number.isFinite(tgUserId)
    ? await findProfileByTelegramUserId(sb, tgUserId)
    : null;
  const authorized = isAuthorizedChat(chatId, chatType);
  const privateLinked = chatType === "private" && !!linkedProfile;

  if (!authorized && !privateLinked) {
    if (isGroupChat(chatType)) {
      const norm = text.toLowerCase().trim();
      if (norm === "id" || norm === "chatid") {
        await sendTelegramReply(
          BOT_TOKEN,
          chatId,
          `Энэ группийн ID: ${chatId}\n\n.env: TELEGRAM_LOG_GROUP_ID=${chatId}\nДараа нь: ./scripts/setup-telegram.sh`,
        );
        return jsonResponse({ ok: true, action: "group_id", chat_id: chatId });
      }
    }
    if (chatType === "private") {
      await sendTelegramReply(
        BOT_TOKEN,
        chatId,
        "Telegram хараахан холбогдоогүй.\nGennetex апп → Telegram чат → «Telegram холбох» дарна уу.",
      );
      return jsonResponse({ ok: true, ignored: true, reason: "not_linked" });
    }
    return jsonResponse({ ok: true, ignored: true, reason: "unauthorized_chat" });
  }

  const lower = text.toLowerCase().trim();
  if (lower === "start" || lower === "help" || lower === "тусламж") {
    const groupHint = isGroupChat(chatType)
      ? "Групп дээр: /log эсвэл @GennetexBot log"
      : linkedProfile
        ? `Холбогдсон: ${linkedProfile.name || "ажилтан"}`
        : "Хувийн чат эсвэл бүртгэлтэй групп";
    await sendTelegramReply(
      BOT_TOKEN,
      chatId,
      [
        "✅ Gennetex Admin bot",
        "",
        `📍 ${groupHint}`,
        "",
        "📋 log → 24ц PDF тайлан",
        "💬 Энгийн мессеж → Telegram чат (апп + групп)",
        "📢 !мессеж → бүх ажилтанд push зарлал",
        "",
        "Групп ID: " + (LOG_GROUP_ID || String(chatId)),
        "",
        "⚠️ Групп дээр бүх мессеж харах:",
        "BotFather → /setprivacy → Disable",
      ].join("\n"),
    );
    return jsonResponse({ ok: true, action: "start_help" });
  }

  if (isLogPdfCommand(text)) {
    if (!authorized) {
      await sendTelegramReply(BOT_TOKEN, chatId, "PDF лог зөвхөн админ/группээс.");
      return jsonResponse({ ok: false, error: "log_not_allowed" });
    }
    const pdfTarget = LOG_GROUP_ID || (isGroupChat(chatType) ? chatIdStr(chatId) : "");
    if (!pdfTarget) {
      await sendTelegramReply(
        BOT_TOKEN,
        chatId,
        "❌ TELEGRAM_LOG_GROUP_ID тохируулаагүй.\nГрупп дотор «id» бичээд ID-г авч setup-telegram.sh ажиллуулна.",
      );
      return jsonResponse({ ok: false, error: "log_group_not_configured" });
    }

    await sendTelegramReply(BOT_TOKEN, chatId, "📋 24 цагийн лог PDF бэлдэж байна...");
    const result = await sendLogsPdfToTelegram(BOT_TOKEN, pdfTarget, sb);
    if (result.ok) {
      const c = result.counts;
      const note = chatIdStr(chatId) !== pdfTarget
        ? `✅ PDF групп руу илгээгдлээ\n🚗 ${c.vehicles} машин · 📍 ${c.employees_with_coords} координат · 🕐 ${c.attendance} ирц`
        : `✅ PDF илгээгдлээ\n🚗 ${c.vehicles} машин · 📍 ${c.employees_with_coords} координат · 🕐 ${c.attendance} ирц`;
      await sendTelegramReply(BOT_TOKEN, chatId, note);
    } else {
      await sendTelegramReply(BOT_TOKEN, chatId, `❌ PDF алдаа: ${result.error || "unknown"}`);
    }
    return jsonResponse({ ok: result.ok, action: "log_pdf", target: pdfTarget, ...result.counts, error: result.error || null });
  }

  const tokens = await fetchAllTokens(sb);

  if (isBroadcastCommand(text)) {
    if (!authorized) {
      await sendTelegramReply(BOT_TOKEN, chatId, "Зарлал зөвхөн админ/группээс.");
      return jsonResponse({ ok: false, error: "broadcast_not_allowed" });
    }
    const pushBody = broadcastBody(text);
    await sendExpoPush(tokens, {
      title: "Gennetex",
      body: pushBody,
      sound: "default",
      priority: "high",
      channelId: "feed",
      data: { type: "telegram_broadcast", text: pushBody },
    });
    await sendTelegramReply(BOT_TOKEN, chatId, `✅ Зарлал илгээгдлээ (${tokens.length} төхөөрөмж)`);
    return jsonResponse({ ok: true, action: "broadcast", tokens: tokens.length });
  }

  // Групп эсвэл холбогдсон ажилтны хувийн чат → апп Telegram чат
  if (isGroupChat(chatType) || privateLinked) {
    const chatResult = await handleIncomingTelegramChat(sb, msg, text);
    // Хувийн чатаас ирсэн мессежийг групп рүү ч илгээнэ (апптай ижил)
    if (privateLinked && chatResult.saved && LOG_GROUP_ID && BOT_TOKEN) {
      const name = linkedProfile?.name || telegramSenderName(from);
      await sendTelegramReply(
        BOT_TOKEN,
        LOG_GROUP_ID,
        `📱 ${name}\n${text}`,
      );
      await sendTelegramReply(BOT_TOKEN, chatId, "✅ Апп + групп рүү илгээгдлээ");
    }
    return jsonResponse({ ok: true, action: "telegram_chat", ...chatResult });
  }

  await sendTelegramReply(
    BOT_TOKEN,
    chatId,
    "Хувийн чат: log → PDF, !мессеж → зарлал.\nЧат: Telegram групп эсвэл апп → Telegram чат.",
  );
  return jsonResponse({ ok: true, ignored: true, chat_type: chatType });
});
