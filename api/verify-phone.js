const {
  VerifyMnError,
  requireApiKey,
  createVerifyMnSession,
  getVerifyMnSession,
} = require('./_lib/verify-mn');

function sendJson(res, status, body) {
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
  const anonKey = envValue(
    'SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
  );
  if (!url || !anonKey) {
    throw new VerifyMnError('Supabase серверийн тохиргоо дутуу байна.', 500, 'SUPABASE_ENV_MISSING');
  }
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
  if (!token) throw new VerifyMnError('Нэвтрэх шаардлагатай.', 401, 'AUTH_REQUIRED');

  const authResponse = await supabaseRequest('/auth/v1/user', token);
  const user = await authResponse.json().catch(() => null);
  if (!authResponse.ok || !user?.id) {
    throw new VerifyMnError('Нэвтрэх хугацаа дууссан байна.', 401, 'INVALID_SESSION');
  }

  const profileResponse = await supabaseRequest(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role&limit=1`,
    token,
  );
  const profiles = await profileResponse.json().catch(() => []);
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profileResponse.ok || !['admin', 'superadmin'].includes(String(profile?.role || ''))) {
    throw new VerifyMnError('Зөвхөн админ ашиглана.', 403, 'ADMIN_REQUIRED');
  }
  return { user, token };
}

async function insertSession(token, userId, provider, subject = {}) {
  const response = await supabaseRequest('/rest/v1/phone_verification_sessions', token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      provider_session_id: provider.sessionId,
      created_by: userId,
      phone: provider.phone,
      session_status: 'PENDING',
      expires_at: provider.expiresAt,
      display_instruction: provider.displayInstruction,
      sms_uri: provider.smsUri || null,
      subject_type: subject.type ? String(subject.type).slice(0, 40) : null,
      subject_id: subject.id ? String(subject.id).slice(0, 120) : null,
    }),
  });
  if (!response.ok) {
    throw new VerifyMnError('Баталгаажуулалтын session хадгалж чадсангүй.', 500, 'SESSION_STORE_FAILED');
  }
}

async function getOwnedSession(token, userId, sessionId) {
  const response = await supabaseRequest(
    `/rest/v1/phone_verification_sessions?provider_session_id=eq.${encodeURIComponent(sessionId)}` +
      `&created_by=eq.${encodeURIComponent(userId)}&select=provider_session_id,expires_at&limit=1`,
    token,
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(rows) || !rows[0]) {
    throw new VerifyMnError('Session олдсонгүй.', 404, 'SESSION_NOT_FOUND');
  }
  return rows[0];
}

async function updateSession(token, sessionId, provider) {
  const status = ['PENDING', 'VERIFIED', 'EXPIRED'].includes(provider.sessionStatus)
    ? provider.sessionStatus
    : 'PENDING';
  const response = await supabaseRequest(
    `/rest/v1/phone_verification_sessions?provider_session_id=eq.${encodeURIComponent(sessionId)}`,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        session_status: status,
        verified_at: provider.verifiedAt || null,
        expires_at: provider.expiresAt,
        callback_status: provider.callbackStatus || null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!response.ok) {
    throw new VerifyMnError('Session төлөв хадгалж чадсангүй.', 500, 'SESSION_UPDATE_FAILED');
  }
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { user, token } = await requireAdmin(req);

    if (req.method === 'POST') {
      const apiKey = requireApiKey();
      const provider = await createVerifyMnSession({
        phone: req.body?.phone,
        apiKey,
      });
      await insertSession(token, user.id, provider, {
        type: req.body?.subjectType,
        id: req.body?.subjectId,
      });
      return sendJson(res, 201, {
        sessionId: provider.sessionId,
        phone: provider.phone,
        shortcode: provider.shortcode,
        smsUri: provider.smsUri,
        // Provider-ийн зааврыг ямар ч өөрчлөлтгүй дамжуулна.
        displayInstruction: provider.displayInstruction,
        expiresAt: provider.expiresAt,
        sessionStatus: 'PENDING',
      });
    }

    if (req.method === 'GET') {
      const sessionId = String(req.query?.sessionId || '').trim();
      await getOwnedSession(token, user.id, sessionId);
      const provider = await getVerifyMnSession(sessionId);
      await updateSession(token, sessionId, provider);
      return sendJson(res, 200, provider);
    }

    return sendJson(res, 405, { error: 'GET эсвэл POST ашиглана уу.' });
  } catch (error) {
    const status = error instanceof VerifyMnError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Дотоод алдаа гарлаа.';
    // API key, Authorization token болон provider request body-г логлохгүй.
    if (status >= 500) console.error('[verify-phone]', error?.code || 'UNEXPECTED_ERROR', message);
    return sendJson(res, status, { error: message, code: error?.code || 'UNEXPECTED_ERROR' });
  }
}

module.exports = handler;
module.exports._test = { requireAdmin, handler };
