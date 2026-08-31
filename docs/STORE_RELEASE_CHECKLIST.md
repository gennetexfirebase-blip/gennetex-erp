# App Store / Google Play — гаргахын өмнөх шалгах хуудас

Аудит: 2026-08-21 · Апп: Gennetex ERP v1.2.9 · `com.gennetex.erp`
Framework: Expo SDK 54 (React Native 0.81, Hermes, New Architecture)

Энэ файл нь **зөвхөн эзэмшигчээс хамаарах** ажлуудыг жагсаана. Кодоор
засах боломжтой бүхнийг аль хэдийн зассан (доорх «Кодод зассан» хэсэг).

---

## 🔴 1. ЗААВАЛ — Supabase-ийн нээлттэй өгөгдлийг хаах

**Одоогийн байдал:** нэвтрээгүй хүн аппын нийтийн түлхүүрээр (APK-аас
задалж авч болно) дараахыг уншиж байна:

| Хүснэгт | Мөр | Юу задарч байна |
|---|---|---|
| `location_logs` | 1855 | ажилтны GPS координат, нэр, цаг |
| `activity_logs` | 2292 | хэн хэзээ ямар дэлгэц нээсэн |
| `messages` | 187 | ажилтан хоорондын чатын бүтэн агуулга |
| `attendance` | 7 | ирцийн selfie зургийн URL, байршил |
| `conversations`, `products`, `stock_movements` | 37 | — |

Энэ нь Apple 5.1.1/5.1.2, Google Play User Data policy-ийн шууд зөрчил.
**Аль ч дэлгүүр рүү илгээхээс өмнө засна.**

### Хэрхэн засах (5 минут)

1. https://supabase.com/dashboard/project/zkftykocmqzrgdhgwluu/sql → **SQL Editor**
2. `supabase/migrations/20260821110000_anon_lockdown.sql` файлыг бүтнээр нь
   хуулж буулгаад **Run**.
   → Хамгийн доор `OK — anon зөвхөн шаардлагатай 2 эрхтэй үлдлээ` гэж гарна.
3. Дараа нь `supabase/migrations/20260821110100_personal_data_scoping.sql`-ыг
   мөн адил Run хийнэ (ажилтан бусдын чат/байршлыг харахыг хаана).
4. Мөн `supabase/migrations/20260821090000_team_performance.sql`-ыг
   ажиллуулаагүй бол одоо ажиллуулна (Ажилчдын гүйцэтгэлийн импорт).

### Ажилласан эсэхийг шалгах

```bash
# Хаагдсан бол 401 буюу "permission denied" гарна
curl -s -H "apikey: <ANON_KEY>" \
  "https://zkftykocmqzrgdhgwluu.supabase.co/rest/v1/location_logs?select=*&limit=1"
```

### Дараа нь ЗААВАЛ гараар туршина

`20260821110100` нь нэвтэрсэн хэрэглэгчийн эрхийг хатууруулдаг тул:

- [ ] Хоёр ажилтан хоорондоо чат бичих → мессеж харагдаж байна уу
- [ ] Бүлэг чат нээх → түүх ирж байна уу
- [ ] Ажилтан өөрийн ирцийн түүхээ харах
- [ ] Админ вэб → Байршил / Ирц / Нийт лог хэсгүүд
- [ ] Ажилтан ирц бүртгүүлэх (selfie + байршил)

Чат хоосорвол буцаах SQL нь тэр файлын толгойд бичээстэй байгаа.

---

## 🔴 2. ЗААВАЛ — Storage bucket-ууд нээлттэй байна

`attendance`, `avatars`, `chat` bucket-ууд `public = true`. Өөрөөр хэлбэл
URL-ыг мэдэж байвал **нэвтрэхгүйгээр** ажилтны selfie болон чатын зургийг
татна. URL нь `attendance` хүснэгтээс задарч байсан (дээрх №1).

№1-ийг зассанаар URL олох зам хаагдана, гэхдээ хуучин URL-ууд хаа нэгтээ
хадгалагдсан бол ажилласаар байна.

**Сонголт A (зөвлөх):** bucket-уудыг хаалттай болгож, зургийг signed URL-ээр
харуулна. Энэ нь аппын код өөрчлөхийг шаардана (одоо DB-д public URL
хадгалдаг) — тусад нь төлөвлөж хийнэ.

**Сонголт B (түр зуурын):** bucket-уудыг хаалттай болгож, эхлээд зөвхөн
`chat`-ыг (хамгийн эмзэг нь) шилжүүлнэ.

> ⚠️ Энэ хоёрын аль нь ч аппын одоогийн зураг харуулах логикийг эвдэх тул
> АВТОМАТААР ЗАСААГҮЙ. Шийдвэрийг эзэмшигч гаргана.

---

## ✅ 3. Google Maps — БҮРЭН ХАСАГДСАН

~~Google Maps API key~~ — **энэ хэсэг хуучирсан.**

2026-08-27-нд газрын зургийг **OpenStreetMap** руу бүрэн шилжүүлэв.
Шалтгаан: Google Maps SDK нь Android дээр `com.google.android.geo.API_KEY`
meta-data ЗААВАЛ шаарддаг бөгөөд байхгүй үед натив талдаа
`IllegalStateException: API key not found` шидэж **бүтэн аппыг унагаадаг**.
Ирц дэлгэц газрын зурагтай тул тэр дэлгэц рүү орох бүрд апп хаагддаг байв.

Одоо `src/components/Map.js` нь Leaflet-ийг WebView дотор ажиллуулдаг тул:

- ямар ч API түлхүүр шаардахгүй
- төлбөртэй Google Cloud данс шаардахгүй
- натив газрын зургийн крэш бүрмөсөн арилсан

`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` нь `.env` болон CI-д үлдсэн ч
**хаана ч уншигддаггүй** — устгаж болно.

---

## 🟠 4. Аппын багц дотор ил үлдэж буй түлхүүрүүд

`EXPO_PUBLIC_*` бүхэн APK/IPA дотор **ил үлддэг** — задалсан хүн уншина.

| Түлхүүр | Байдал | Хийх ажил |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Зөв — ил байхаар зохиогдсон | RLS л хамгаална (№1) |
| `EXPO_PUBLIC_GEMINI_API_KEY` | ⚠️ Задарна | Edge Function руу зөөх; эсвэл Google дээр квот/хязгаар тавих |
| `EXPO_PUBLIC_LUXAND_TOKEN` | ⚠️ Задарна | **`.env`-ээс хасна** — царай таних нь `face-verify` Edge Function-оор ажилладаг тул шаардлагагүй. Хассаны дараа token-оо Luxand дээр rotate хийнэ |
| `EXPO_PUBLIC_TELEGRAM_API_ID/HASH` | ⚠️ Задарна | my.telegram.org дээр rotate; боломжтой бол сервер тал руу |
| `EXPO_PUBLIC_ALERT_SECRET` | ⚠️ Задарна | Edge Function-ий secret rotate |
| `TELEGRAM_BOT_TOKEN` | `.env`-д, git-д ОРООГҮЙ ✅ | Зөвхөн сервер дээр байлга |

`android/gradle.properties` дотор release keystore-ийн нууц үг ил байгаа
боловч `android/` нь `.gitignore`-д орсон тул git-д ороогүй ✅. Тухайн
компьютерийг бусдад өгөхгүй байх л үлдлээ.

---

## 🟡 5. App Store Connect дээр гараар хийх

- [ ] **Bundle ID** `com.gennetex.erp` бүртгэх, App Record үүсгэх
- [ ] **Capabilities**: Push Notifications, Background Modes (Location,
      Remote notifications, VoIP, Audio), Sign in with Apple хэрэггүй
- [ ] **PushKit VoIP entitlement** — `com.apple.developer.pushkit.unrestricted-voip`
      нь тусгай зөвшөөрөл шаарддаг. Apple-аас **урьдчилж** хүсэлт гаргаагүй бол
      build татгалзана → https://developer.apple.com/contact/request/voip-push
- [ ] **App Privacy** (Data types) — доорх жагсаалтыг бөглөнө:
      - Precise Location — App Functionality — Linked — Not used for tracking
      - Name, Email, Phone — App Functionality — Linked
      - Photos or Videos — App Functionality — Linked
      - Other User Content (чат) — App Functionality — Linked
      - Sensitive Info (царайны биометр загвар) — App Functionality — Linked
      - Device ID (push token) — App Functionality — Linked
      - Product Interaction (үйлдлийн лог) — App Functionality — Linked
      *(Энэ жагсаалт нь кодод суулгасан `PrivacyInfo.xcprivacy`-тэй яг таарна)*
- [ ] **Privacy Policy URL**: `https://<домэйн>/privacy`
- [ ] **Support URL**: `https://<домэйн>/contact`
- [ ] **Age Rating**: 4+ (хэрэглэгчийн үүсгэсэн чат байгаа тул 17+ болох
      магадлалтай — Apple-ийн асуулгад «Unrestricted Web Access: No»,
      «User Generated Content: Yes, moderated» гэж хариулна)
- [ ] **Screenshots**: 6.9" (iPhone 17 Pro Max) ба 6.5" — тус бүр 3-10 ширхэг
- [ ] **Review notes** (доорх «Reviewer тэмдэглэл»-ийг хуулна)
- [ ] **Demo account** — заавал (доорх №7)

## 🟡 6. Google Play Console дээр гараар хийх

- [ ] **App bundle (.aab)** — `eas build -p android --profile production` ✅
      (eas.json дээр аль хэдийн `app-bundle`)
- [ ] **Data safety** маягт — App Store-ийн жагсаалттай ижил
- [ ] **Account deletion URL**: `https://<домэйн>/delete-account` ✅ (шинээр нэмэв)
- [ ] **Privacy Policy URL**: `https://<домэйн>/privacy`
- [ ] **Sensitive permissions**:
      - `ACCESS_BACKGROUND_LOCATION` → **Permissions declaration** маягт +
        prominent disclosure дэлгэцийн **видео бичлэг** заавал
        *(prominent disclosure дэлгэц нь `OnboardingPermissionsScreen.js`
          дээр бэлэн, Google-ийн шаардлагын дагуу бичигдсэн ✅)*
      - `USE_FULL_SCREEN_INTENT` → дуудлагын апп гэдгээ тайлбарлана
      - `CALL_PHONE`, `READ_PHONE_STATE`, `MANAGE_OWN_CALLS` → VoIP дуудлагын
        функцээс шалтгаалсан (react-native-callkeep). Тайлбарлахад бэлэн бай
- [ ] **Target audience**: 18+ (ажилчдын систем)
- [ ] **Ads**: No
- [ ] **Content rating** асуулга
- [ ] **App access**: «All functionality is restricted» → demo account өгнө
- [ ] Feature graphic 1024×500, icon 512×512, screenshots ≥2

## 🟡 7. Reviewer demo account (ЗААВАЛ)

Апп нь **бүртгэл үүсгэх боломжгүй** (админ урьдчилж `authorized_users`-д
нэмнэ). Reviewer нэвтэрч чадахгүй бол **шууд татгалзана**.

Бэлдэх зүйл:

1. Жинхэнэ Gmail хаяг үүсгэнэ (ж: `appreview.gennetex@gmail.com`)
2. Админ вэбээс тэр хаягийг `employees` эрхтэйгээр зөвшөөрнө
3. Тухайн бүртгэлд:
   - PIN / царай бүртгэлийг **алгасах** боломжтой эсэхийг шалгана
   - Төхөөрөмж зөвшөөрөл (`device_approvals`) шаардвал **урьдчилж зөвшөөрнө**
     — эс тэгвээс reviewer «төхөөрөмж хүлээгдэж байна» дээр гацна
4. Жишээ өгөгдөл (1-2 дуудлага, бараа, чат) урьдчилж оруулна
5. Шалгасны дараа **энэ бүртгэлийг идэвхгүй болгож болохгүй** —
   аппын шинэчлэлт бүрд дахин хэрэгтэй

### Reviewer тэмдэглэл (хуулж тавих)

```
Gennetex ERP is an internal workforce-management app for a single company.
Accounts are created by company administrators; public sign-up is
intentionally unavailable.

Demo account:
  email: <...>
  password: <...>

Notes for review:
- Location is collected in the background only during work hours and only
  after the user accepts the disclosure screen shown on first launch.
  You can decline location and still use chat, inventory and reports.
- The incoming-call screen uses CallKit/PushKit for real VoIP calls between
  employees; it is never used for advertising.
- Face recognition is used only for attendance check-in and is processed on
  our own Supabase backend. Users can request deletion in
  Profile → Privacy & data → Delete account.
```

---

## 🟢 8. Build хийхийн өмнө

```bash
npx expo install --check     # 4 багцын patch хувилбар зөрүүтэй
npx expo-doctor              # 16/18 → дээрхийг зассаны дараа 17/18
eas build -p android --profile production
eas build -p ios     --profile production
```

`npx expo install --check` нь `expo`, `expo-constants`, `expo-file-system`,
`expo-local-authentication` -ийг SDK 54-ийн зөв patch хувилбар руу татна.
(Одоо ажиллуулаагүй — build эвдрэх эрсдэлийг эзэмшигч өөрөө шийднэ.)

---

## ✅ Кодод аль хэдийн зассан зүйлс

| Асуудал | Засвар | Файл |
|---|---|---|
| Session token нь шифрлэгдээгүй AsyncStorage-д | Keychain / Android Keystore руу шилжүүлж, хуучин session-ийг автоматаар зөөнө | `src/lib/secureSessionStorage.js`, `src/lib/supabase.js` |
| Google-ийн жишээ Maps түлхүүр кодод хатуу бичигдсэн | Орчны хувьсагч руу зөөв | `app.json`, `app.config.js` |
| iOS дээр ашиглагдахгүй `fetch` background mode | Устгав (Apple ашиглагдахгүй горимыг татгалздаг) | `app.json` |
| iOS Privacy Manifest байхгүй | `PrivacyInfo.xcprivacy` үүсгэх тохиргоо + 4 required-reason API + 9 өгөгдлийн төрөл | `app.json` |
| Google Play-д вэб дээрх устгах хаяг байхгүй | `/delete-account` хуудас + footer холбоос | `public-web/src/pages/DeleteAccountPage.jsx` |
| Нууцлалын бодлого аппын дотроос хүрэхгүй | Профайл → Нууцлал дээр холбоос нэмэв | `src/screens/PrivacyScreen.js` |
| Хэрэглэгчид англи техникийн алдаа харагдана | Монгол мессеж рүү хөрвүүлэгч + гол дэлгэцүүдэд холбов | `src/lib/erpMessages.js` |
| `tsc --noEmit` 100+ худал алдаа өгдөг | Зөвхөн аппын кодыг шалгахаар зассан → 0 алдаа | `tsconfig.json` |
| Anon хандалт нээлттэй | Migration бичсэн (ажиллуулах нь эзэмшигчээс) | `supabase/migrations/20260821110000_*.sql` |
| Ажилтан бусдын чат/байршил уншина | Migration бичсэн (ажиллуулах нь эзэмшигчээс) | `supabase/migrations/20260821110100_*.sql` |

---

## 📎 Хавсралт A — Reviewer demo account (SQL бэлэн)

Reviewer-ийн Gmail хаягийг үүсгэсний дараа Supabase → SQL Editor дээр
доорхийг ажиллуулна. `<REVIEWER_EMAIL>`-ийг л солино.

```sql
-- 1) Нэвтрэх эрх нээх (эрх нь энгийн ажилтан — компанийн бодит өгөгдөл
--    задрахгүй, гэхдээ бүх үндсэн дэлгэц нээгдэнэ)
insert into public.authorized_users (email, name, "position", role, active)
values (lower('<REVIEWER_EMAIL>'), 'App Review', 'Store reviewer', 'employee', true)
on conflict (email) do update
  set active = true, role = 'employee', updated_at = now();

-- 2) Тухайн хаягаар нэг удаа нэвтэрсний ДАРАА ажиллуулна:
--    төхөөрөмжийн зөвшөөрлийг урьдчилж баталгаажуулна — эс тэгвээс
--    reviewer «төхөөрөмж хүлээгдэж байна» дэлгэц дээр гацна.
update public.device_approvals d
   set status = 'approved'
 where d.user_id = (
   select p.id from public.profiles p where lower(p.email) = lower('<REVIEWER_EMAIL>')
 );

-- 3) Шалгах
select email, role, active from public.authorized_users
 where email = lower('<REVIEWER_EMAIL>');
```

> ⚠️ Apple/Google-д өгсөн demo account-ыг **шинэчлэлт бүрийн үед идэвхтэй**
> байлгана. Идэвхгүй болговол дараагийн хувилбар татгалзана.

Нэвтрэлтийн урсгалд PIN эсвэл царай шаарддаг бол reviewer-т зориулж
**алгасах** боломж байгаа эсэхийг гараар шалгана уу (`my_pin_policy`,
`AttendanceScreen`).

## 📎 Хавсралт B — Apple VoIP entitlement хүсэлтийн текст

https://developer.apple.com/contact/request/voip-push дээр илгээнэ:

```
App name: Gennetex ERP
Bundle ID: com.gennetex.erp

Our app provides real-time voice and video calling between employees of the
same company (dispatcher ↔ field engineer). We use CallKit together with
PushKit VoIP pushes so that an incoming work call rings and can be answered
from the lock screen, exactly like a regular phone call.

VoIP pushes are sent only when another employee actually starts a call. They
are never used for marketing, background refresh, or silent data delivery.
Call signalling runs over WebRTC (react-native-webrtc) with a TURN relay.
```

## 📎 Хавсралт C — Gemini түлхүүрийг сервер тал руу зөөх

Код бэлэн (`supabase/functions/gemini-proxy/`). Ажиллуулах:

```bash
supabase secrets set GEMINI_API_KEY=<ШИНЭ түлхүүр>
supabase functions deploy gemini-proxy
```

Дараа нь **аппаас түлхүүрийг хасна**:

1. `.env` дотор `EXPO_PUBLIC_GEMINI_API_KEY`-г устгах эсвэл тайлбар болгох
2. EAS дээр: `eas secret:delete --name EXPO_PUBLIC_GEMINI_API_KEY`
3. Google AI Studio дээр ХУУЧИН түлхүүрийг **устгах** (rotate)

Апп нь проксиг олохгүй бол хуучин зам руугаа автоматаар буцдаг тул
deploy хийхээс өмнө ч, дараа ч AI ажиллана.

## 📎 Хавсралт D — Түлхүүр rotate хийх жагсаалт

| Түлхүүр | Хаана rotate хийх | Дараа нь юу хийх |
|---|---|---|
| Luxand token | dashboard.luxand.cloud → Token | `.env`-д унтраасан ✅ — эргүүлж оруулах шаардлагагүй |
| Gemini API key | aistudio.google.com → API keys | Хавсралт C-ийн дагуу серверт тавих |
| Telegram API ID/HASH | my.telegram.org → API development tools | `.env`-ээс хасаж, серверт л ашиглах |
| ALERT_SECRET | `supabase secrets set ALERT_SECRET=…` | `EXPO_PUBLIC_ALERT_SECRET`-ыг аппаас хасах |
| TELEGRAM_BOT_TOKEN | @BotFather → /revoke | Зөвхөн Edge Function-ий secret болгох |

> Rotate хийхээс өмнө шинэ утгыг Edge Function-ий secret-д тавьсан эсэхээ
> шалгана — эс тэгвээс Telegram мэдэгдэл түр тасарна.
