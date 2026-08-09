/**
 * Ажилтны ХУВИЙН Telegram акаунттай (MTProto/GramJS) шууд холбогдох сервис.
 * Bot API биш — жинхэнэ Telegram клиент шиг өөрийн бүх чатыг харна.
 *
 * api_id / api_hash-г https://my.telegram.org → API development tools-оос авч
 * .env дотор EXPO_PUBLIC_TELEGRAM_API_ID, EXPO_PUBLIC_TELEGRAM_API_HASH болгож тавина.
 */
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/StringSession';
import { NewMessage } from 'telegram/events';
import { computeCheck } from 'telegram/Password';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'tg_user_session_v1';

export const TG_API_ID = Number(process.env.EXPO_PUBLIC_TELEGRAM_API_ID || 0);
export const TG_API_HASH = process.env.EXPO_PUBLIC_TELEGRAM_API_HASH || '';

let client = null;
let connecting = null;
const entityCache = new Map();

export function isConfigured() {
  return TG_API_ID > 0 && !!TG_API_HASH;
}

async function loadSessionString() {
  return (await AsyncStorage.getItem(SESSION_KEY)) || '';
}

export async function persistSession() {
  if (!client) return;
  const saved = client.session.save();
  if (saved) await AsyncStorage.setItem(SESSION_KEY, saved);
}

export async function getClient() {
  if (client && client.connected) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    if (!isConfigured()) {
      throw new Error('Telegram API тохируулаагүй. .env-д EXPO_PUBLIC_TELEGRAM_API_ID/HASH нэмнэ үү.');
    }
    const session = new StringSession(await loadSessionString());
    client = new TelegramClient(session, TG_API_ID, TG_API_HASH, {
      connectionRetries: 5,
      useWSS: true,
      deviceModel: 'Gennetex App',
      systemVersion: 'ReactNative',
      appVersion: '1.0',
      langCode: 'mn',
    });
    client.setLogLevel('none');
    await client.connect();
    return client;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export async function isAuthorized() {
  try {
    const c = await getClient();
    return await c.isUserAuthorized();
  } catch {
    return false;
  }
}

/** Утасны дугаар руу нэвтрэх код илгээх */
export async function sendLoginCode(phoneNumber) {
  const c = await getClient();
  const result = await c.sendCode(
    { apiId: TG_API_ID, apiHash: TG_API_HASH },
    phoneNumber,
  );
  return {
    phoneCodeHash: result.phoneCodeHash,
    // Код Telegram апп дотор ирсэн үү, эсвэл SMS-ээр үү
    viaApp: !!result.isCodeViaApp,
  };
}

/**
 * Кодыг дахин илгээх. Telegram энэ үед ихэвчлэн SMS эсвэл дуудлага руу
 * шатлуулж илгээдэг (эхний код Telegram апп дотор ирсэн бол).
 */
export async function resendLoginCode(phoneNumber, phoneCodeHash) {
  const c = await getClient();
  const result = await c.invoke(
    new Api.auth.ResendCode({ phoneNumber, phoneCodeHash }),
  );
  const t = result?.type?.className || '';
  let via = 'app';
  if (t.includes('Sms')) via = 'sms';
  else if (t.includes('Call')) via = 'call';
  else if (t.includes('FlashCall')) via = 'call';
  return {
    phoneCodeHash: result.phoneCodeHash || phoneCodeHash,
    via,
  };
}

/**
 * Код оруулж нэвтрэх. 2FA нууц үг шаардвал { needPassword: true } буцаана.
 */
export async function signInWithCode({ phoneNumber, phoneCodeHash, phoneCode }) {
  const c = await getClient();
  try {
    await c.invoke(
      new Api.auth.SignIn({ phoneNumber, phoneCodeHash, phoneCode }),
    );
    await persistSession();
    return { ok: true };
  } catch (e) {
    const msg = e?.errorMessage || e?.message || '';
    if (msg.includes('SESSION_PASSWORD_NEEDED')) {
      return { ok: false, needPassword: true };
    }
    throw e;
  }
}

/** 2FA нууц үгээр баталгаажуулах */
export async function signInWithPassword(password) {
  const c = await getClient();
  const pwdInfo = await c.invoke(new Api.account.GetPassword());
  const check = await computeCheck(pwdInfo, password);
  await c.invoke(new Api.auth.CheckPassword({ password: check }));
  await persistSession();
  return { ok: true };
}

export async function logout() {
  try {
    if (client) await client.invoke(new Api.auth.LogOut());
  } catch {
    // алдаа гарсан ч локал session-ийг цэвэрлэнэ
  }
  try {
    if (client) await client.disconnect();
  } catch {}
  client = null;
  entityCache.clear();
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getMe() {
  const c = await getClient();
  return c.getMe();
}

function pickText(message) {
  if (!message) return '';
  if (message.message) return message.message;
  if (message.media) return '[Медиа]';
  if (message.action) return '[Үйлдэл]';
  return '';
}

export async function fetchDialogs(limit = 60) {
  const c = await getClient();
  const dialogs = await c.getDialogs({ limit });
  return dialogs
    .filter((d) => d && d.entity)
    .map((d) => {
      const idStr = String(d.id);
      entityCache.set(idStr, d.entity);
      return {
        id: idStr,
        title: d.title || d.name || 'Чат',
        isUser: !!d.isUser,
        isGroup: !!d.isGroup,
        isChannel: !!d.isChannel,
        unreadCount: d.unreadCount || 0,
        lastMessage: pickText(d.message),
        date: d.message?.date ? d.message.date * 1000 : null,
      };
    });
}

async function resolveEntity(idStr) {
  if (entityCache.has(idStr)) return entityCache.get(idStr);
  const c = await getClient();
  const entity = await c.getEntity(idStr);
  entityCache.set(idStr, entity);
  return entity;
}

export async function fetchMessages(idStr, limit = 40) {
  const c = await getClient();
  const entity = await resolveEntity(idStr);
  const messages = await c.getMessages(entity, { limit });
  return messages
    .filter((m) => m)
    .map((m) => ({
      id: m.id,
      text: pickText(m),
      out: !!m.out,
      date: m.date ? m.date * 1000 : null,
      senderId: m.senderId ? String(m.senderId) : null,
    }))
    .reverse();
}

export async function sendMessage(idStr, text) {
  const c = await getClient();
  const entity = await resolveEntity(idStr);
  const res = await c.sendMessage(entity, { message: text });
  return {
    id: res.id,
    text,
    out: true,
    date: res.date ? res.date * 1000 : Date.now(),
  };
}

/** Шинэ мессеж real-time сонсох. cb(idStr) дуудна. */
export async function subscribeNewMessages(cb) {
  const c = await getClient();
  const handler = (event) => {
    try {
      const id = event.message?.chatId || event.message?.peerId;
      cb(id ? String(id) : null, event);
    } catch {}
  };
  const filter = new NewMessage({});
  c.addEventHandler(handler, filter);
  return () => c.removeEventHandler(handler, filter);
}
