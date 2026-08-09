# Gennetex ERP

React Native + Expo дээр бүтээсэн талбайн ажилтны удирдлагын апп.

## Боломжууд

| Таб | Тайлбар |
|-----|---------|
| 📦 **Бараа** | Бараа материалын бүртгэл — нэмэх, тоо хэмжээ +/−, устгах, нийт үнэлгээ |
| ⛽ **Бензин** | Явсан км-ээр бензиний зарлага тооцох (100км-т зарцуулах литр × үнэ), түүх хадгалах |
| 📍 **Байршил** | Ажилтны байршлыг **real-time** GPS-ээр газрын зураг дээр харуулах |
| 🗺️ **Дуудлага** | Дуудлага өгсөн айлуудыг **Google Maps** дээр цэгээр харуулах, чиглүүлэх, залгах |
| 📸 **Ирц** | Урд камерын **selfie (царай)**-гээр ирц бүртгэх, зургийг Supabase Storage-д хадгалах, түүхтэй |
| 💬 **Чат** | Ажилчид хоорондоо **real-time** мессеж + **📹 апп доторх видео дуудлага** (WebView + Jitsi) |
| 🔐 **Нэвтрэлт** | Ажилтан өөрийн имэйл/нууц үгээр нэвтэрнэ. **Админ** шинэ ажилчдыг бүртгэнэ (role-тэй) |
| 🏠 **Нүүр** | Timely-шиг dashboard: мэндчилгээ, цаг бүртгэх, модулиудын grid |

## Эрх (role)

- **employee** (ажилтан): өөрийн профайл, ирц, чат, модулиуд.
- **admin**: дээрхээс гадна **Ажилчид** цэсээр шинэ хэрэглэгч үүсгэнэ.

Эхний админ болгох: ажилтан бүртгүүлсний дараа Supabase SQL Editor дээр:

```sql
update public.profiles set role = 'admin' where email = 'admin@company.mn';
```

Бүх өгөгдөл төхөөрөмж дээр `AsyncStorage`-д хадгалагдана.

## Суулгах

```bash
npm install
```

## Ажиллуулах

```bash
npm start
```

Дараа нь:
- Утсан дээрээ **Expo Go** апп суулгаад QR кодыг уншуулна, эсвэл
- `npm run android` / `npm run ios` командыг ашиглана.

> ⚠️ Газрын зураг (react-native-maps) болон бодит GPS нь вэб дээр бүрэн ажиллахгүй. **Утасны төхөөрөмж дээр** туршина уу.

## Supabase (ажилтан + бараа материал)

Бараа материал болон ажилтны мэдээллийг **Supabase** (үүлэн өгөгдлийн сан)-д хадгална. Тохируулаагүй бол апп автоматаар **локал горим** (AsyncStorage)-оор ажиллана.

### Тохируулах

1. [supabase.com](https://supabase.com) дээр төсөл үүсгэнэ.
2. **SQL Editor** нээгээд `supabase/schema.sql` файлыг бүхэлд нь ажиллуулна (staff, inventory хүснэгт + жишээ өгөгдөл үүснэ).
3. **Project Settings → API**-аас `Project URL` болон `anon public key`-г хуулна.
4. Төслийн язгуурт `.env` файл үүсгэнэ (`.env.example`-г хуулж болно):

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

5. Апп-ыг дахин эхлүүлнэ: `npm start -c` (cache цэвэрлэх).

Дараа нь:
- **Бараа** таб — өөрчлөлт бүр Supabase-д хадгалагдана, доош татаж сэргээж болно (pull-to-refresh).
- **Байршил** таб — ажилчид Supabase-ээс ирнэ, өөрчлөлт **real-time** шинэчлэгдэнэ (☁️ тэмдэг).

> ⚠️ `schema.sql` доторх RLS policy нь эхлэлд зориулж бүх эрхийг нээсэн. Production дээр эрхийг заавал чангатгана уу.

### Ирц, Чат, Видео дуудлага

- **Ирц (📸)** — `schema.sql` нь `attendance` хүснэгт болон `attendance` нэртэй нийтийн Storage bucket-ыг үүсгэнэ. Selfie зураг тэнд хадгалагдана.
- **Чат (💬)** — `messages` хүснэгт + Realtime. Апп нээхэд эхлээд **нэрээ** оруулна (утсанд хадгалагдана).
- **Видео дуудлага (📹)** — [Jitsi Meet](https://meet.jit.si)-г **апп дотор** (WebView) ажиллуулна. Сервер/API key шаардахгүй, гадаад апп руу шилжихгүй. «📹 Видео» товч дарахад бүх ажилтны нийтлэг өрөө апп дотор нээгдэнэ.
- **Нэвтрэлт (🔐)** — Supabase Auth (имэйл + нууц үг). `schema.sql` нь `profiles` хүснэгт болон шинэ хэрэглэгч бүртгэгдэхэд профайл автоматаар үүсгэх trigger-ийг тохируулна.

> Тайлбар: Selfie/attendance болон real-time чат нь **камер, storage** ашигладаг тул **бодит утас** дээр (Expo Go) туршина. Царайг зурган хэлбэрээр баталгаажуулж хадгалдаг; бүрэн 1:1 царай таних (face-match ML) хэрэгтэй бол дараагийн үе шатанд dev-client + vision модел нэмнэ.

## Google Maps API key

Android/iOS дээр Google Maps ашиглахын тулд `app.json` доторх дараах утгуудыг өөрийн key-ээр солино:

```json
"ios":     { "config": { "googleMapsApiKey": "..." } },
"android": { "config": { "googleMaps": { "apiKey": "..." } } }
```

API key-г [Google Cloud Console](https://console.cloud.google.com/) → *Maps SDK for Android/iOS*-ээс авна.

## Бодит real-time болгох (дараагийн алхам)

Одоо ажилчдын хоорондын real-time хуваалцах хэсэг нь жишээ өгөгдөл (`src/data/mockData.js`) дээр ажиллаж байгаа. Бодит болгохын тулд:

1. **Firebase Firestore / Realtime Database** нэмнэ.
2. `LiveLocationScreen.js` доторх `handlePosition` дотроос байршлыг backend руу бичнэ.
3. Бусад ажилчдын байршлыг `onSnapshot`-оор сонсож газрын зураг дээр шинэчилнэ.

## Файлын бүтэц

```
App.js                      # Навигаци (таб)
src/
  context/AppContext.js     # Апп-ын төлөв + хадгалалт
  data/mockData.js          # Жишээ өгөгдөл
  components/ui.js          # Дундын UI (Card, Button, Field...)
  screens/
    InventoryScreen.js      # Бараа материал
    FuelScreen.js           # Бензиний тооцоо
    LiveLocationScreen.js   # Real-time байршил
    CallsMapScreen.js       # Дуудлага + Google Maps
  theme.js                  # Өнгө, зай
```
# gennetex
