module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET/POST only' });
  const cronSecret = String(process.env.CRON_SECRET || '');
  const authorization = String(req.headers.authorization || '');
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  if (!supabaseUrl) return res.status(500).json({ error: 'SUPABASE_URL missing' });
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/vehicle-compliance-sms`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[vehicle-compliance-cron]', error instanceof Error ? error.message : String(error));
    return res.status(502).json({ error: 'Compliance worker unavailable' });
  }
};
