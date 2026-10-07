# verify.mn утас баталгаажуулалт

Энэ интеграц нь **Mobile-Originated (MO)** баталгаажуулалт. Сервер хэрэглэгчийн
дугаар руу SMS илгээдэггүй. Админ session нээсний дараа дугаарын эзэмшигч өөрийн
SIM-ээс `144773` руу дэлгэцэд гарсан 6 оронтой кодыг илгээнэ (SMS бүр 150₮).

## Production тохиргоо

Vercel-ийн server runtime environment-д дараах утгуудыг тохируулна:

```env
VERIFY_MN_API_KEY=...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=...
```

`VERIFY_MN_API_KEY`-д `EXPO_PUBLIC_` эсвэл `VITE_` угтвар нэмж болохгүй. Тэгвэл
нууц түлхүүр клиент bundle-д ил гарна. Service-role key энэ API-д шаардлагагүй.

Дараа нь `20260923090000_phone_verification_sessions.sql` migration-ийг ажиллуулж,
web төслийг deploy хийнэ. Админ самбарын **Утас баталгаажуулах** хэсэгт өөрийн
дугаарыг оруулаад туршина.

## Урсгал

1. `POST /api/verify-phone` санамсаргүй, дахин ашиглагдахгүй 6 оронтой кодоор
   verify.mn session үүсгэнэ.
2. Provider-ийн `displayInstruction`-ийг өөрчлөлтгүй харуулна. Утаснаас
   `smsUri` холбоосыг дарах нь үндсэн үйлдэл.
3. Web нь `GET /api/verify-phone?sessionId=...`-г 3 секунд тутам шалгана.
4. Зөвхөн verify.mn `sessionStatus: VERIFIED` гэж буцаавал баталгаажсан гэж үзнэ.
5. 300 секунд өнгөрвөл хуучин код хүчингүй; шинэ session шинэ кодтой үүснэ.

Callback URL зориуд бүртгээгүй. Хуурамч эсвэл нээлтгүй callback руу verify.mn
олон дахин хүсэлт явуулахгүй байлгахын тулд одоогийн хувилбар polling ашигладаг.
Reply SMS нь оператороос хамаардаг учраас амжилтын нотолгоо гэж үзэхгүй.

Энэ API нь админаас дурын текстийг хэрэглэгч рүү илгээдэг outbound/MT SMS gateway
биш. Тийм хэрэгцээнд тусдаа MT provider болон гэрээ/credential шаардлагатай.
