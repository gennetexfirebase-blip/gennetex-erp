const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VerifyMnError,
  normalizeMongolianPhone,
  createVerificationCode,
  createVerifyMnSession,
  pollVerifyMnSession,
} = require('../api/_lib/verify-mn');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

test('Mongolian phone normalization accepts local and +976 forms', () => {
  assert.equal(normalizeMongolianPhone('9911 2233'), '99112233');
  assert.equal(normalizeMongolianPhone('+976 9911-2233'), '99112233');
  assert.throws(() => normalizeMongolianPhone('123'), /8–16/);
});

test('verification code is exactly six numeric digits', () => {
  assert.equal(createVerificationCode(() => 482916), '482916');
  assert.match(createVerificationCode(), /^\d{6}$/);
});

test('create session sends no callback/responseSms and preserves provider instruction verbatim', async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, init, body: JSON.parse(init.body) };
    return jsonResponse(200, {
      sessionId: 'session-1', phone: '99112233', shortcode: '144773',
      text: '482916', smsUri: 'sms:144773?body=482916',
      displayInstruction: '99112233 дугаараас 482916 кодыг илгээнэ үү.',
      expiresAt: '2026-09-23T10:05:00.000Z',
    });
  };
  const result = await createVerifyMnSession({
    phone: '+976 99112233', apiKey: 'test-key', fetchImpl, code: '482916',
  });
  assert.equal(request.url, 'https://api.verify.mn/sessions');
  assert.deepEqual(request.body, { phone: '99112233', text: '482916' });
  assert.equal(request.init.headers.Authorization, 'Bearer test-key');
  assert.equal(result.displayInstruction, '99112233 дугаараас 482916 кодыг илгээнэ үү.');
});

test('polling follows PENDING to VERIFIED and returns true', async () => {
  const statuses = ['PENDING', 'VERIFIED'];
  let now = 0;
  const ok = await pollVerifyMnSession('session-1', {
    expiresAt: '1970-01-01T00:00:10.000Z',
    now: () => now,
    wait: async (ms) => { now += ms; },
    intervalMs: 3000,
    fetchImpl: async () => jsonResponse(200, {
      sessionId: 'session-1', sessionStatus: statuses.shift() || 'VERIFIED',
      callbackStatus: 'PENDING', expiresAt: '1970-01-01T00:00:10.000Z',
    }),
  });
  assert.equal(ok, true);
});

test('polling returns false on EXPIRED and at hard timeout', async () => {
  let now = 0;
  const expired = await pollVerifyMnSession('expired', {
    expiresAt: '1970-01-01T00:00:10.000Z', now: () => now,
    wait: async (ms) => { now += ms; },
    fetchImpl: async () => jsonResponse(200, { sessionStatus: 'EXPIRED' }),
  });
  assert.equal(expired, false);

  now = 0;
  const timedOut = await pollVerifyMnSession('pending', {
    expiresAt: '1970-01-01T00:00:04.000Z', now: () => now,
    wait: async (ms) => { now += ms; },
    intervalMs: 3000,
    fetchImpl: async () => jsonResponse(200, { sessionStatus: 'PENDING' }),
  });
  assert.equal(timedOut, false);
});

test('provider 401 is surfaced as a safe bad-key error', async () => {
  await assert.rejects(
    createVerifyMnSession({
      phone: '99112233', apiKey: 'bad-key', code: '123456',
      fetchImpl: async () => jsonResponse(401, { error: 'Unauthorized' }),
    }),
    (error) => error instanceof VerifyMnError &&
      error.status === 401 && error.code === 'VERIFY_MN_UNAUTHORIZED' &&
      !error.message.includes('bad-key'),
  );
});

test('optional responseSms is sent only when valid printable ASCII', async () => {
  let body;
  const fetchImpl = async (_url, init) => {
    body = JSON.parse(init.body);
    return jsonResponse(200, {
      sessionId: 'reply-session', phone: '83021181', shortcode: '144773',
      text: '123456', smsUri: 'sms:144773?body=123456',
      displayInstruction: 'Заавар', expiresAt: '2026-09-23T10:05:00.000Z',
    });
  };
  await createVerifyMnSession({
    phone: '83021181', apiKey: 'test-key', code: '123456',
    responseSms: 'test message', fetchImpl,
  });
  assert.equal(body.responseSms, 'test message');
  await assert.rejects(
    createVerifyMnSession({
      phone: '83021181', apiKey: 'test-key', code: '123456',
      responseSms: 'Кирилл', fetchImpl,
    }),
    (error) => error.code === 'INVALID_RESPONSE_SMS',
  );
});
