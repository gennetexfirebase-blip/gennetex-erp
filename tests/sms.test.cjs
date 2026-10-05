const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SmsError,
  normalizeMongolianPhone,
  calculateSmsSegments,
  sendSms,
} = require('../api/_lib/sms');

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

const sendsmsConfig = {
  provider: 'sendsms',
  enabled: true,
  apiUrl: 'https://api.sendsms.mn/api/user/send',
  apiKey: 'test-api-key',
  apiToken: 'test-api-token',
  senderId: '',
};

test('normalizes Mongolian phone numbers to local and E.164', () => {
  assert.deepEqual(normalizeMongolianPhone('+976 8302-1181'), {
    local: '83021181', e164: '+97683021181',
  });
  assert.throws(() => normalizeMongolianPhone('8302118'), /8 оронтой/);
});

test('calculates GSM-7 and Cyrillic UCS-2 segments', () => {
  assert.deepEqual(calculateSmsSegments('test message'), {
    encoding: 'GSM-7', length: 12, segments: 1, perSegment: 160,
  });
  assert.equal(calculateSmsSegments('Сайн байна уу').encoding, 'UCS-2');
  assert.equal(calculateSmsSegments('ө'.repeat(71)).segments, 2);
});

test('sendsms adapter uses documented endpoint and exact request fields', async () => {
  let called;
  const result = await sendSms('+97683021181', 'test message', {
    config: sendsmsConfig,
    fetchImpl: async (url, init) => {
      called = { url, init, body: JSON.parse(init.body) };
      return response(200, { success: true, messageId: 'provider-123' });
    },
  });
  assert.equal(called.url, 'https://api.sendsms.mn/api/user/send');
  assert.deepEqual(called.body, {
    apiKey: 'test-api-key', apiToken: 'test-api-token',
    phone: '83021181', message: 'test message',
  });
  assert.equal(result.providerMessageId, 'provider-123');
  assert.equal(result.mocked, false);
});

test('sendsms rejects over 159 characters before chargeable request', async () => {
  let calls = 0;
  await assert.rejects(
    sendSms('83021181', 'a'.repeat(160), {
      config: sendsmsConfig,
      fetchImpl: async () => { calls += 1; return response(200, { success: true }); },
    }),
    (error) => error instanceof SmsError && error.code === 'MESSAGE_TOO_LONG',
  );
  assert.equal(calls, 0);
});

test('sendsms rejects Cyrillic over one 70-character provider message', async () => {
  let calls = 0;
  await assert.rejects(
    sendSms('83021181', 'ө'.repeat(71), {
      config: sendsmsConfig,
      fetchImpl: async () => { calls += 1; return response(200, { success: true }); },
    }),
    (error) => error instanceof SmsError && error.code === 'MESSAGE_TOO_LONG',
  );
  assert.equal(calls, 0);
});

test('sendsms does not retry failed requests and risk duplicate charges', async () => {
  let calls = 0;
  await assert.rejects(
    sendSms('83021181', 'hello', {
      config: sendsmsConfig,
      maxAttempts: 3,
      fetchImpl: async () => { calls += 1; return response(500, { success: false, message: 'down' }); },
      wait: async () => {},
    }),
    /down/,
  );
  assert.equal(calls, 1);
});

test('mock provider never calls network and is forbidden in production', async () => {
  let calls = 0;
  const mocked = await sendSms('83021181', 'hello', {
    env: { NODE_ENV: 'test', SMS_PROVIDER: 'mock' },
    fetchImpl: async () => { calls += 1; },
  });
  assert.equal(mocked.mocked, true);
  assert.equal(calls, 0);
  await assert.rejects(
    sendSms('83021181', 'hello', { env: { NODE_ENV: 'production', SMS_PROVIDER: 'mock' } }),
    (error) => error.code === 'MOCK_IN_PRODUCTION',
  );
});
