const { SmsError, sendSms } = require('./_lib/sms');

function json(res, status, body) {
  res.status(status).json(body);
}

function envValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value.replace(/\/$/, '');
  }
  return '';
}

async function supabaseRequest(path, token, init = {}) {
  const url = envValue('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new SmsError('Supabase серверийн тохиргоо дутуу байна.', 500, 'SUPABASE_ENV_MISSING');
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

async function requireAdmin(req) {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new SmsError('Нэвтрэх шаардлагатай.', 401, 'AUTH_REQUIRED');
  const authResponse = await supabaseRequest('/auth/v1/user', token);
  const user = await authResponse.json().catch(() => null);
  if (!authResponse.ok || !user?.id) throw new SmsError('Нэвтрэх хугацаа дууссан байна.', 401, 'INVALID_SESSION');
  const profileResponse = await supabaseRequest(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role&limit=1`, token,
  );
  const rows = await profileResponse.json().catch(() => []);
  if (!profileResponse.ok || !['admin', 'superadmin'].includes(String(rows?.[0]?.role || ''))) {
    throw new SmsError('Зөвхөн админ SMS илгээнэ.', 403, 'ADMIN_REQUIRED');
  }
  return { user, token };
}

async function findByIdempotency(token, userId, key) {
  const response = await supabaseRequest(
    `/rest/v1/sms_messages?created_by=eq.${encodeURIComponent(userId)}` +
      `&idempotency_key=eq.${encodeURIComponent(key)}` +
      '&select=id,phone,message,status,provider_message_id,segments,encoding,error_message,created_at&limit=1',
    token,
  );
  const rows = await response.json().catch(() => []);
  return response.ok && Array.isArray(rows) ? rows[0] || null : null;
}

async function countSince(token, userId, iso) {
  const response = await supabaseRequest(
    `/rest/v1/sms_messages?created_by=eq.${encodeURIComponent(userId)}` +
      `&created_at=gte.${encodeURIComponent(iso)}&select=id`,
    token,
    { headers: { Prefer: 'count=exact', Range: '0-0' } },
  );
  if (!response.ok) throw new SmsError('SMS лимит шалгаж чадсангүй.', 500, 'LIMIT_CHECK_FAILED');
  const range = response.headers.get('content-range') || '';
  return Number(range.split('/')[1] || 0);
}

async function enforceLimits(token, userId) {
  const now = Date.now();
  const [minute, day] = await Promise.all([
    countSince(token, userId, new Date(now - 60_000).toISOString()),
    countSince(token, userId, new Date(now - 86_400_000).toISOString()),
  ]);
  if (minute >= 5) throw new SmsError('Нэг минутад хамгийн ихдээ 5 SMS илгээнэ.', 429, 'MINUTE_LIMIT');
  if (day >= 200) throw new SmsError('Өдөрт хамгийн ихдээ 200 SMS илгээнэ.', 429, 'DAILY_LIMIT');
}

async function insertQueued(token, row) {
  const response = await supabaseRequest('/rest/v1/sms_messages', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok || !rows?.[0]) throw new SmsError('SMS бүртгэл үүсгэж чадсангүй.', 500, 'SMS_STORE_FAILED');
  return rows[0];
}

async function updateMessage(token, id, patch) {
  const response = await supabaseRequest(`/rest/v1/sms_messages?id=eq.${encodeURIComponent(id)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new SmsError('SMS төлөв хадгалж чадсангүй.', 500, 'SMS_UPDATE_FAILED');
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'POST ашиглана уу.' });

  let stored;
  let token;
  try {
    const auth = await requireAdmin(req);
    token = auth.token;
    const phone = String(req.body?.phone || '').trim();
    const message = String(req.body?.message || '').trim();
    const consentConfirmed = req.body?.consentConfirmed === true;
    const idempotencyKey = String(
      req.headers['idempotency-key'] || req.body?.idempotencyKey || '',
    ).trim().slice(0, 120);
    if (!consentConfirmed) throw new SmsError('SMS зөвшөөрлийг баталгаажуулна уу.', 400, 'CONSENT_REQUIRED');
    if (!idempotencyKey) throw new SmsError('Idempotency-Key шаардлагатай.', 400, 'IDEMPOTENCY_REQUIRED');

    const duplicate = await findByIdempotency(token, auth.user.id, idempotencyKey);
    if (duplicate) return json(res, 200, { ok: duplicate.status === 'sent', duplicate: true, message: duplicate });
    await enforceLimits(token, auth.user.id);

    stored = await insertQueued(token, {
      created_by: auth.user.id,
      phone,
      message,
      status: 'queued',
      idempotency_key: idempotencyKey,
      consent_confirmed: true,
      provider: String(process.env.SMS_PROVIDER || 'mock').toLowerCase(),
    });

    const result = await sendSms(phone, message, { idempotencyKey });
    const patch = {
      status: 'sent',
      provider: result.provider,
      provider_message_id: result.providerMessageId,
      segments: result.segments.segments,
      encoding: result.segments.encoding,
      sent_at: new Date().toISOString(),
      error_message: null,
    };
    await updateMessage(token, stored.id, patch);
    return json(res, 201, {
      ok: true,
      message: { ...stored, ...patch },
      mocked: result.mocked,
    });
  } catch (error) {
    const status = error instanceof SmsError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'SMS илгээхэд алдаа гарлаа.';
    if (stored?.id && token) {
      await updateMessage(token, stored.id, {
        status: 'failed', error_message: message.slice(0, 500),
      }).catch(() => {});
    }
    if (status >= 500) console.error('[send-sms]', error?.code || 'UNEXPECTED_ERROR', message);
    return json(res, status, { error: message, code: error?.code || 'UNEXPECTED_ERROR' });
  }
}

module.exports = handler;
module.exports._test = { handler };
