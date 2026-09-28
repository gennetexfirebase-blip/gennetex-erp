const { randomInt } = require('node:crypto');

const VERIFY_MN_API_URL = 'https://api.verify.mn';

class VerifyMnError extends Error {
  constructor(message, status = 500, code = 'VERIFY_MN_ERROR') {
    super(message);
    this.name = 'VerifyMnError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Монгол дугаарыг verify.mn-ийн зөвшөөрдөг зөвхөн цифрэн хэлбэрт оруулна.
 * +976 99112233, 97699112233, 99112233 гурвыг нэг 8 оронтой утга болгоно.
 */
function normalizeMongolianPhone(input) {
  let digits = String(input || '').trim().replace(/[^0-9]/g, '');
  if (digits.startsWith('00976') && digits.length === 13) digits = digits.slice(5);
  if (digits.startsWith('976') && digits.length === 11) digits = digits.slice(3);
  if (!/^\d{8,16}$/.test(digits)) {
    throw new VerifyMnError('Утасны дугаар 8–16 оронтой байх ёстой.', 400, 'INVALID_PHONE');
  }
  return digits;
}

function createVerificationCode(random = randomInt) {
  return String(random(100000, 1000000));
}

function requireApiKey(env = process.env) {
  const apiKey = String(env.VERIFY_MN_API_KEY || '').trim();
  if (!apiKey) {
    throw new VerifyMnError(
      'VERIFY_MN_API_KEY тохируулаагүй байна.',
      500,
      'VERIFY_MN_API_KEY_MISSING',
    );
  }
  return apiKey;
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;

  if (response.status === 401) {
    throw new VerifyMnError(
      'verify.mn API key хүчингүй байна.',
      401,
      'VERIFY_MN_UNAUTHORIZED',
    );
  }
  const safeMessage = response.status >= 500
    ? 'verify.mn үйлчилгээ түр алдаатай байна.'
    : String(data?.message || data?.error || `verify.mn алдаа (${response.status})`);
  throw new VerifyMnError(safeMessage, response.status, 'VERIFY_MN_UPSTREAM');
}

async function createVerifyMnSession({ phone, apiKey, fetchImpl = fetch, code, responseSms }) {
  const normalizedPhone = normalizeMongolianPhone(phone);
  const verificationCode = code || createVerificationCode();
  if (!/^\d{6}$/.test(verificationCode)) {
    throw new VerifyMnError('Баталгаажуулах код 6 оронтой байх ёстой.', 500, 'INVALID_CODE');
  }

  if (responseSms != null && (!/^[\x20-\x7E]{1,160}$/.test(String(responseSms)))) {
    throw new VerifyMnError(
      'responseSms нь 1–160 ASCII printable тэмдэгт байх ёстой.',
      400,
      'INVALID_RESPONSE_SMS',
    );
  }
  const body = { phone: normalizedPhone, text: verificationCode };
  if (responseSms != null) body.responseSms = String(responseSms);

  const response = await fetchImpl(`${VERIFY_MN_API_URL}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    // Callback зориуд оруулаагүй. Callback байхгүй үед клиент polling хийнэ.
    // responseSms өгсөн байсан ч оператороос хамаардаг тул баталгаажуулалтын
    // үр дүн гэж хэзээ ч ашиглахгүй.
    body: JSON.stringify(body),
  });
  const data = await readJson(response);
  if (!data?.sessionId || !data?.displayInstruction || !data?.expiresAt) {
    throw new VerifyMnError('verify.mn бүрэн бус хариу буцаалаа.', 502, 'VERIFY_MN_INVALID_RESPONSE');
  }
  return { ...data, phone: normalizedPhone };
}

async function getVerifyMnSession(sessionId, { fetchImpl = fetch } = {}) {
  if (!sessionId) throw new VerifyMnError('sessionId шаардлагатай.', 400, 'SESSION_ID_REQUIRED');
  const response = await fetchImpl(
    `${VERIFY_MN_API_URL}/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Accept: 'application/json' } },
  );
  return readJson(response);
}

/** Серверийн цэвэр polling helper. Автомат тест бодит SMS огт явуулахгүй. */
async function pollVerifyMnSession(sessionId, {
  fetchImpl = fetch,
  intervalMs = 3000,
  expiresAt,
  now = () => Date.now(),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const hardDeadline = expiresAt ? new Date(expiresAt).getTime() : now() + 300000;
  if (!Number.isFinite(hardDeadline)) {
    throw new VerifyMnError('expiresAt буруу байна.', 400, 'INVALID_EXPIRY');
  }

  while (now() < hardDeadline) {
    const session = await getVerifyMnSession(sessionId, { fetchImpl });
    if (session.sessionStatus === 'VERIFIED') return true;
    if (session.sessionStatus === 'EXPIRED') return false;
    await wait(Math.min(intervalMs, Math.max(0, hardDeadline - now())));
  }
  return false;
}

module.exports = {
  VERIFY_MN_API_URL,
  VerifyMnError,
  normalizeMongolianPhone,
  createVerificationCode,
  requireApiKey,
  createVerifyMnSession,
  getVerifyMnSession,
  pollVerifyMnSession,
};
