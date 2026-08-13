#!/usr/bin/env bash
# Telegram edge functions deploy
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_REF="${SUPABASE_PROJECT_REF:-xhxyrzzgmksjlibfrmlx}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN тохируулна уу (Dashboard → Account → Access Tokens)"
  echo "  export SUPABASE_ACCESS_TOKEN=..."
  exit 1
fi

echo "SQL эхлээд ажиллуулна уу: supabase/migration_telegram_link.sql (Dashboard → SQL Editor)"
echo ""
echo "Deploying telegram-link, telegram-webhook, telegram-chat-send..."

npx supabase functions deploy telegram-link --project-ref "$PROJECT_REF"
npx supabase functions deploy telegram-webhook --project-ref "$PROJECT_REF" --no-verify-jwt
npx supabase functions deploy telegram-chat-send --project-ref "$PROJECT_REF"

echo ""
echo "OK:"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/telegram-link"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/telegram-webhook"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/telegram-chat-send"
echo ""
echo "Webhook шинэчлэх: ./scripts/setup-telegram.sh"
