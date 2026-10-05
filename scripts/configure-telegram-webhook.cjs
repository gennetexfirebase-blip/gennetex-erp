/** Configure the existing bot for message and inline-button updates.
 * Reads TELEGRAM_BOT_TOKEN from the local ignored .env; never prints it.
 * Generates a new webhook secret, uploads it to Supabase, and deletes the
 * temporary env file even if Telegram configuration fails.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
const tokenLine = env.split(/\r?\n/).find((line) => /^TELEGRAM_BOT_TOKEN=/.test(line));
const token = tokenLine?.slice('TELEGRAM_BOT_TOKEN='.length).trim().replace(/^["']|["']$/g, '');
const chatLine = env.split(/\r?\n/).find((line) => /^TELEGRAM_CHAT_ID=/.test(line));
const chatId = chatLine?.slice('TELEGRAM_CHAT_ID='.length).trim().replace(/^["']|["']$/g, '');
if (!/^[0-9]+:[A-Za-z0-9_-]+$/.test(token || '')) throw new Error('TELEGRAM_BOT_TOKEN missing or invalid in local .env');
if (!/^[1-9][0-9]*$/.test(chatId || '')) throw new Error('Private TELEGRAM_CHAT_ID missing or invalid in local .env');
const projectRef = fs.readFileSync(path.join(root, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new Error('Invalid linked Supabase project ref');

const tempFile = path.join(root, 'tmp', '.telegram-webhook-secret.env');
const secret = crypto.randomBytes(32).toString('hex');
fs.mkdirSync(path.dirname(tempFile), { recursive: true });
fs.writeFileSync(tempFile, `TELEGRAM_WEBHOOK_SECRET=${secret}\nTELEGRAM_BOT_TOKEN=${token}\nTELEGRAM_CHAT_ID=${chatId}\n`, { mode: 0o600 });

(async () => {
  try {
    const escapedTempFile = tempFile.replace(/'/g, "''");
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `& npx.cmd supabase secrets set --env-file '${escapedTempFile}'`], {
      cwd: root,
      windowsHide: true,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000,
    });
    if (result.status !== 0) {
      const detail = String(result.stderr || result.stdout || result.error?.message || '')
        .replaceAll(secret, '[redacted]').replaceAll(token, '[redacted]').replaceAll(chatId, '[redacted]').slice(0, 500);
      throw new Error(`Could not save Telegram webhook secret in Supabase: ${detail}`);
    }

    const api = `https://api.telegram.org/bot${token}`;
    const configured = await fetch(`${api}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `https://${projectRef}.supabase.co/functions/v1/telegram-webhook`,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query'],
      }),
    }).then((res) => res.json());
    if (!configured.ok) throw new Error(`Telegram setWebhook failed: ${configured.description || 'unknown error'}`);

    const info = await fetch(`${api}/getWebhookInfo`).then((res) => res.json());
    const actual = info?.result || {};
    if (!info.ok || !actual.allowed_updates?.includes('callback_query')) {
      throw new Error('Telegram webhook does not accept callback_query');
    }
    console.log('Telegram webhook configured for message and callback_query.');
    console.log(`Webhook host: ${new URL(actual.url).host}`);
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
})().catch((error) => {
  console.error(error.message || 'Telegram webhook setup failed');
  process.exitCode = 1;
});
