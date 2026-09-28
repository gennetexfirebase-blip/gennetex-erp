const { randomUUID } = require('node:crypto');

const GSM_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
const GSM_EXTENDED = new Set('^{}\\[~]|€');

class SmsError extends Error {
  constructor(message, status = 500, code = 'SMS_ERROR', retryable = false) {
    super(message);
    this.name = 'SmsError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function normalizeMongolianPhone(input) {
  let digits = String(input || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('00976')) digits = digits.slice(5);
  if (digits.startsWith('976') && digits.length === 11) digits = digits.slice(3);
  if (!/^\d{8}$/.test(digits)) {
    throw new SmsError('Монгол утасны дугаар 8 оронтой байх ёстой.', 400, 'INVALID_PHONE');
  }
  return { local: digits, e164: `+976${digits}` };
}

function calculateSmsSegments(message) {
  const text = String(message || '');
  if (!text.length) return { encoding: 'GSM-7', length: 0, segments: 0, perSegment: 160 };
  let septets = 0;
  let gsm = true;
  for (const ch of text) {
    if (GSM_BASIC.has(ch)) septets += 1;
    else if (GSM_EXTENDED.has(ch)) septets += 2;
    else { gsm = false; break; }
  }
  if (gsm) {
    const perSegment = septets <= 160 ? 160 : 153;
    return { encoding: 'GSM-7', length: septets, segments: Math.ceil(septets / perSegment), perSegment };
  }
  const units = Array.from(text).reduce((sum, ch) => sum + (ch.codePointAt(0) > 0xffff ? 2 : 1), 0);
  const perSegment = units <= 70 ? 70 : 67;
  return { encoding: 'UCS-2', length: units, segments: Math.ceil(units / perSegment), perSegment };
}

function configFromEnv(env = process.env) {
  const provider = String(env.SMS_PROVIDER || 'mock').trim().toLowerCase();
  const enabled = String(env.SMS_ENABLED || '').toLowerCase() === 'true';
  const apiUrl = String(env.SMS_API_URL || '').trim() ||
    (provider === 'mambo' ? 'https://api-mongolia.mambosms.com/v1/send-sms' : '');
  return {
    provider,
    enabled,
    apiUrl,
    apiKey: String(env.SMS_API_KEY || '').trim(),
    apiToken: String(env.SMS_API_TOKEN || '').trim(),
    senderId: String(env.SMS_SENDER_ID || '').trim(),
    messageCategory: String(env.SMS_MESSAGE_CATEGORY || 'info').trim(),
  };
}

function validateConfig(config, env = process.env) {
  if (config.provider === 'mock') {
    if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
      throw new SmsError('Production орчинд mock SMS provider ашиглахыг хориглоно.', 500, 'MOCK_IN_PRODUCTION');
    }
    return;
  }
  if (!config.enabled) throw new SmsError('SMS_ENABLED=true тохируулаагүй байна.', 503, 'SMS_DISABLED');
  if (config.provider === 'sendsms') {
    if (!config.apiUrl || !config.apiKey || !config.apiToken) {
      throw new SmsError('SMS_API_URL, SMS_API_KEY, SMS_API_TOKEN тохиргоо дутуу байна.', 500, 'SMS_CONFIG_MISSING');
    }
    return;
  }
  if (!config.apiUrl || !config.apiKey || !config.senderId) {
    throw new SmsError('SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID тохиргоо дутуу байна.', 500, 'SMS_CONFIG_MISSING');
  }
  if (!['mambo', 'generic', 'sendsms'].includes(config.provider)) {
    throw new SmsError(`Дэмжигдээгүй SMS provider: ${config.provider}`, 500, 'SMS_PROVIDER_UNSUPPORTED');
  }
}

async function sendSendsms(config, phone, message, { fetchImpl }) {
  const segments = calculateSmsSegments(message);
  const maxLength = segments.encoding === 'GSM-7' ? 159 : 70;
  if (segments.length > maxLength) {
    throw new SmsError(`sendsms.mn ${segments.encoding} мессеж хамгийн ихдээ ${maxLength} тэмдэгт байна.`, 400, 'MESSAGE_TOO_LONG');
  }
  const response = await fetchWithTimeout(fetchImpl, config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      apiKey: config.apiKey,
      apiToken: config.apiToken,
      phone: phone.local,
      message,
    }),
  });
  const data = await response.json().catch(() => ({}));
  const failed = !response.ok || data?.success === false || data?.status === false ||
    String(data?.status || '').toLowerCase() === 'error';
  if (failed) {
    throw new SmsError(
      response.status === 401 || response.status === 403
        ? 'sendsms.mn API credential хүчингүй байна.'
        : String(data?.message || data?.error || `sendsms.mn алдаа (${response.status})`),
      response.status || 502,
      response.status === 401 || response.status === 403 ? 'SMS_UNAUTHORIZED' : 'SMS_PROVIDER_ERROR',
      false,
    );
  }
  return {
    providerMessageId: String(
      data?.messageId || data?.message_id || data?.data?.messageId || data?.data?.id || `sendsms-${randomUUID()}`,
    ),
    providerResponse: data,
  };
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new SmsError('SMS provider timeout.', 504, 'SMS_TIMEOUT', true);
    throw new SmsError('SMS provider-тэй холбогдож чадсангүй.', 502, 'SMS_NETWORK_ERROR', true);
  } finally {
    clearTimeout(timer);
  }
}

async function sendMambo(config, phone, message, { fetchImpl }) {
  const response = await fetchWithTimeout(fetchImpl, config.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      message,
      recipients: phone.e164,
      message_category: config.messageCategory,
      sender_id: config.senderId,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new SmsError(
      response.status === 401 ? 'SMS_API_KEY хүчингүй байна.' :
        String(data?.messages?.[0] || data?.message || `SMS provider алдаа (${response.status})`),
      response.status || 502,
      response.status === 401 ? 'SMS_UNAUTHORIZED' : 'SMS_PROVIDER_ERROR',
      retryable,
    );
  }
  return {
    providerMessageId: String(data?.data?.message_id || data?.message_id || data?.id || `mambo-${randomUUID()}`),
    providerResponse: data,
  };
}

async function sendGeneric(config, phone, message, { fetchImpl, idempotencyKey }) {
  const response = await fetchWithTimeout(fetchImpl, config.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ to: phone.e164, message, senderId: config.senderId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new SmsError(
      response.status === 401 ? 'SMS_API_KEY хүчингүй байна.' :
        String(data?.error || data?.message || `SMS provider алдаа (${response.status})`),
      response.status || 502,
      response.status === 401 ? 'SMS_UNAUTHORIZED' : 'SMS_PROVIDER_ERROR',
      retryable,
    );
  }
  return {
    providerMessageId: String(data?.messageId || data?.message_id || data?.id || `generic-${randomUUID()}`),
    providerResponse: data,
  };
}

async function sendSms(phoneInput, messageInput, options = {}) {
  const phone = normalizeMongolianPhone(phoneInput);
  const message = String(messageInput || '').trim();
  if (!message || message.length > 1000) {
    throw new SmsError('Мессеж 1–1000 тэмдэгт байх ёстой.', 400, 'INVALID_MESSAGE');
  }
  const segments = calculateSmsSegments(message);
  if (segments.segments > 10) {
    throw new SmsError('Мессеж 10 SMS segment-ээс урт байна.', 400, 'TOO_MANY_SEGMENTS');
  }
  const env = options.env || process.env;
  const config = { ...configFromEnv(env), ...(options.config || {}) };
  validateConfig(config, env);

  if (config.provider === 'mock') {
    return {
      ok: true,
      provider: 'mock',
      providerMessageId: `mock-${randomUUID()}`,
      phone: phone.e164,
      segments,
      mocked: true,
    };
  }

  const sender = config.provider === 'sendsms'
    ? sendSendsms
    : config.provider === 'mambo'
      ? sendMambo
      : sendGeneric;
  // sendsms.mn idempotency key баримтжуулаагүй тул timeout-ын дараа автоматаар
  // давтан илгээвэл хэрэглэгчид давхар SMS, давхар төлбөр үүсэх эрсдэлтэй.
  const configuredAttempts = config.provider === 'sendsms' ? 1 : Number(options.maxAttempts || 3);
  const maxAttempts = Math.max(1, Math.min(configuredAttempts, 3));
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await sender(config, phone, message, {
        fetchImpl: options.fetchImpl || fetch,
        idempotencyKey: options.idempotencyKey,
      });
      return {
        ok: true,
        provider: config.provider,
        phone: phone.e164,
        segments,
        mocked: false,
        ...result,
      };
    } catch (error) {
      lastError = error;
      if (!error?.retryable || attempt === maxAttempts) throw error;
      await (options.wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(250 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

module.exports = {
  SmsError,
  normalizeMongolianPhone,
  calculateSmsSegments,
  configFromEnv,
  sendSms,
};
