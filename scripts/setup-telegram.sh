#!/usr/bin/env bash
# Telegram bot → Supabase Edge Functions тохиргоо.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-xhxyrzzgmksjlibfrmlx}"
SUPABASE_WEBHOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/telegram-webhook"

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "TELEGRAM_BOT_TOKEN тохируулна уу (.env эсвэл export)"
  exit 1
fi

echo "[1/4] Bot шалгаж байна..."
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if not d.get('ok'):
  print('Bot token буруу:', d); sys.exit(1)
r=d['result']
print('OK:', '@'+r.get('username',''), '-', r.get('first_name',''))
"

echo "[1b] Webhook шалгаж байна..."
CURRENT_WEBHOOK=$(curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print((d.get('result') or {}).get('url') or '')
")
if [[ -n "$CURRENT_WEBHOOK" && "$CURRENT_WEBHOOK" != "$SUPABASE_WEBHOOK_URL" ]]; then
  echo "Өөр webhook олдсон: $CURRENT_WEBHOOK"
  echo "Устгаж байна..."
  curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook?drop_pending_updates=false" >/dev/null
fi

pick_chat_id() {
  curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=10&timeout=0" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for u in reversed(d.get('result') or []):
  m=u.get('message') or u.get('edited_message') or {}
  c=(m.get('chat') or {}).get('id')
  if c:
    print(c); break
"
}

pick_group_id() {
  curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=20&timeout=0" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for u in reversed(d.get('result') or []):
  m=u.get('message') or u.get('edited_message') or {}
  c=m.get('chat') or {}
  cid=c.get('id')
  if cid and str(cid).startswith('-'):
    print(cid); break
"
}

echo "[2/4] Chat ID хайж байна..."
CHAT_ID="${TELEGRAM_CHAT_ID:-}"
GROUP_ID="${TELEGRAM_LOG_GROUP_ID:-}"
if [[ -z "$CHAT_ID" ]]; then
  CHAT_ID="$(pick_chat_id || true)"
fi
if [[ -z "$GROUP_ID" ]]; then
  GROUP_ID="$(pick_group_id || true)"
fi

if [[ -z "$CHAT_ID" ]]; then
  echo ""
  echo "=============================================="
  echo " ОДОО Telegram нээгээд @GennetexBot руу /start илгээнэ!"
  echo " (эсвэл групп дээр bot нэмээд мессеж бичнэ)"
  echo "=============================================="
  echo ""
  echo "60 секунд хүлээнэ (мессеж илгээгээрэй)..."
  for i in $(seq 1 12); do
  if [[ -z "$CHAT_ID" ]]; then
  CHAT_ID=$(curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=5&timeout=5" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for u in reversed(d.get('result') or []):
  m=u.get('message') or u.get('edited_message') or {}
  c=(m.get('chat') or {}).get('id')
  if c and not str(c).startswith('-'):
    print(c); break
" || true)
  fi
  if [[ -z "$GROUP_ID" ]]; then
  GROUP_ID=$(curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=5&timeout=5" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for u in reversed(d.get('result') or []):
  m=u.get('message') or u.get('edited_message') or {}
  c=(m.get('chat') or {}).get('id')
  if c and str(c).startswith('-'):
    print(c); break
" || true)
  fi
    if [[ -n "$CHAT_ID" || -n "$GROUP_ID" ]]; then
      break
    fi
    echo "  ... хүлээж байна ($i/12)"
  done
fi

if [[ -z "$CHAT_ID" && -z "$GROUP_ID" ]]; then
  echo ""
  echo "Chat ID олдсонгүй."
  echo ""
  echo "Арга A — хувийн чат:"
  echo "  @userinfobot → Id → @GennetexBot /start"
  echo "  export TELEGRAM_CHAT_ID='123456789'"
  echo ""
  echo "Арга B — Telegram групп:"
  echo "  1) Групп үүсгэж @GennetexBot нэмнэ (админ)"
  echo "  2) BotFather → /setprivacy → @GennetexBot → Disable"
  echo "  3) Групп дотор: /id@GennetexBot эсвэл @GennetexBot id"
  echo "  4) export TELEGRAM_LOG_GROUP_ID='-1001234567890'"
  echo "  5) ./scripts/setup-telegram.sh"
  exit 1
fi
echo "Admin Chat ID: ${CHAT_ID:-—}"
echo "Log Group ID: ${GROUP_ID:-—}"

ALERT_SECRET="${ALERT_SECRET:-${EXPO_PUBLIC_ALERT_SECRET:-$(openssl rand -hex 16 2>/dev/null || echo gennetex-alert-$(date +%s))}}"
WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-$(openssl rand -hex 16 2>/dev/null || echo gennetex-webhook-$(date +%s))}"

echo "[3/4] Supabase secrets..."
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  SECRETS=(TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" ALERT_SECRET="$ALERT_SECRET" TELEGRAM_WEBHOOK_SECRET="$WEBHOOK_SECRET")
  [[ -n "$CHAT_ID" ]] && SECRETS+=(TELEGRAM_CHAT_ID="$CHAT_ID")
  [[ -n "$GROUP_ID" ]] && SECRETS+=(TELEGRAM_LOG_GROUP_ID="$GROUP_ID")
  npx supabase secrets set "${SECRETS[@]}" --project-ref "$PROJECT_REF"
  echo "Secrets OK"
else
  echo "SUPABASE_ACCESS_TOKEN байхгүй — Dashboard → Edge Functions → Secrets:"
  echo "  TELEGRAM_BOT_TOKEN=..."
  [[ -n "$CHAT_ID" ]] && echo "  TELEGRAM_CHAT_ID=$CHAT_ID"
  [[ -n "$GROUP_ID" ]] && echo "  TELEGRAM_LOG_GROUP_ID=$GROUP_ID"
  echo "  ALERT_SECRET=$ALERT_SECRET"
  echo "  TELEGRAM_WEBHOOK_SECRET=$WEBHOOK_SECRET"
fi

echo "[4/4] Supabase webhook тохируулж байна..."
curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${SUPABASE_WEBHOOK_URL}\",\"secret_token\":\"${WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\"]}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Webhook:', 'OK' if d.get('ok') else d)"

echo ""
echo "=== Туршилт ==="
TEST_CHAT="${GROUP_ID:-$CHAT_ID}"
if [[ -n "$TEST_CHAT" ]]; then
curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":\"${TEST_CHAT}\",\"text\":\"✅ Gennetex bot холбогдлоо.\\n\\nГрупп: push + log PDF\\n/log эсвэл log — 24ц лог\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Test message:', 'OK' if d.get('ok') else d)"
fi

echo ""
echo "BotFather: /setprivacy → Disable (групп дээр бүх мессеж харах)"

echo ""
echo "EXPO_PUBLIC_ALERT_SECRET=$ALERT_SECRET  (.env дээр байгаа эсэхийг шалгана уу)"
echo "Deploy: npx supabase functions deploy telegram-alert telegram-webhook --project-ref $PROJECT_REF --no-verify-jwt"
