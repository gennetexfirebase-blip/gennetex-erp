#!/usr/bin/env bash
# Supabase Edge Function deploy (сонголттой — Vercel /api/autobox ашиглавал шаардлагагүй).
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_REF="${SUPABASE_PROJECT_REF:-xhxyrzzgmksjlibfrmlx}"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN тохируулна уу (Dashboard → Account → Access Tokens)"
  echo "  export SUPABASE_ACCESS_TOKEN=..."
  exit 1
fi
npx supabase functions deploy autobox-vehicle --project-ref "$PROJECT_REF" --no-verify-jwt
echo "OK: https://${PROJECT_REF}.supabase.co/functions/v1/autobox-vehicle"
