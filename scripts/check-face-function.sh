#!/usr/bin/env bash
#
# Царай таних Edge Function ажиллаж байгаа эсэхийг шалгана.
#
# Хэрэглэх:
#   bash scripts/check-face-function.sh
#
# Юу хэлэх вэ:
#   • Функц deploy хийгдсэн эсэх
#   • Storage-д ONNX загварууд байгаа эсэх, хэмжээ нь
#   • Загвар ачаалагдаж байгаа эсэх, хэр удаж байгаа
#   • Унасан бол ЯГ ямар алдаа, аль үе шатанд
#
# Энэ горим нь хувийн мэдээлэл гаргахгүй тул нэвтрэлт шаардахгүй.

set -u

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || { echo "❌ .env олдсонгүй"; exit 1; }

URL=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
KEY=$(grep -E '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')

[ -n "$URL" ] || { echo "❌ EXPO_PUBLIC_SUPABASE_URL .env-д алга"; exit 1; }
[ -n "$KEY" ] || { echo "❌ EXPO_PUBLIC_SUPABASE_ANON_KEY .env-д алга"; exit 1; }

echo "→ $URL/functions/v1/face-verify"
echo "  (эхний дуудалт удаан байж болно — загвар ачаална)"
echo

HTTP=$(curl -sS -w '\n___STATUS___%{http_code}' \
  -X POST "$URL/functions/v1/face-verify" \
  -H "Authorization: Bearer $KEY" \
  -H "apikey: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"health"}' \
  --max-time 120 2>&1)

STATUS=$(printf '%s' "$HTTP" | sed -n 's/.*___STATUS___//p')
BODY=$(printf '%s' "$HTTP" | sed 's/___STATUS___.*//')

echo "HTTP $STATUS"
echo "─────────────────────────────────────────"
if command -v node >/dev/null 2>&1; then
  printf '%s' "$BODY" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try { console.log(JSON.stringify(JSON.parse(s), null, 2)); }
  catch (e) { console.log(s); }
});"
else
  echo "$BODY"
fi
echo "─────────────────────────────────────────"

case "$STATUS" in
  200)
    echo "✅ Функц хариулж байна. Дээрх 'modelsLoaded' талбарыг хараарай."
    ;;
  404)
    echo "❌ Функц deploy хийгдээгүй байна:"
    echo "   npx supabase functions deploy face-verify"
    ;;
  401|403)
    echo "❌ Түлхүүр буруу. .env доторх ANON_KEY-г шалгана уу."
    ;;
  546)
    echo "❌ Санах ойн хязгаараас хэтэрлээ — загвар хэт том."
    ;;
  *)
    echo "⚠️  Дээрх хариуг надад дамжуулна уу."
    ;;
esac
