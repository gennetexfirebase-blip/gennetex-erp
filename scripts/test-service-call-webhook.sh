#!/usr/bin/env bash
# JSON webhook туршилт
# Ашиглах:
#   export WEBHOOK_URL="https://YOUR_PROJECT.supabase.co/functions/v1/service-call-webhook"
#   export WEBHOOK_SECRET="your-secret-here"
#   ./scripts/test-service-call-webhook.sh

set -euo pipefail

URL="${WEBHOOK_URL:-}"
SECRET="${WEBHOOK_SECRET:-}"

if [[ -z "$URL" || -z "$SECRET" ]]; then
  echo "WEBHOOK_URL болон WEBHOOK_SECRET тохируулна уu."
  echo 'Жишээ: export WEBHOOK_URL="https://xxx.supabase.co/functions/v1/service-call-webhook"'
  exit 1
fi

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $SECRET" \
  -d '{
    "source": "uservice",
    "external_id": "TEST-001",
    "customer": "Туршилт харилцагч",
    "phone": "99119911",
    "address": "БЗД, 12-р хороо",
    "problem": "Интернет тасарсан",
    "site_kind": "ail",
    "call_type": "repair",
    "latitude": 47.9185,
    "longitude": 106.9176,
    "status": "pending"
  }' | jq .

echo ""
echo "Амжилттай бол admin-web → Дуудлага эсвэл апп → Дуудлага дээр харагдана."
