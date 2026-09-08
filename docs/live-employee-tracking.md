# Ажилтны realtime байршил

Одоо байгаа Supabase authentication, `profiles`, `attendance`, Expo Location/TaskManager болон Leaflet/WebView зурагтай холбосон. Шинэ backend, нэвтрэлт эсвэл давхар Start/End Work үүсгээгүй.

## Асаах

1. Dependency: `npm install` (lockfile-д `expo-battery ~57.0.2` нэмэгдсэн). SDK хувилбарт тааруулан дангаар суулгах бол `npx expo install expo-battery`. `expo-location`, `expo-task-manager`, AsyncStorage, NetInfo, WebView өмнө нь байсан.
2. Одоо байгаа Supabase төсөл дээр `supabase/migrations/20260908120000_live_employee_tracking.sql` migration-ийг хэрэглэнэ. Supabase CLI холбогдсон бол `npx supabase db push`; эсвэл SQL Editor-оор файлыг ажиллуулна. Шатахууны шинэ бүртгэлд `20260907120000_manual_fuel_entries.sql` мөн хэрэгтэй.
3. Supabase дээр `pg_cron` идэвхтэй бол migration өдөр бүр хуучин түүхийг цэвэрлэх job бүртгэнэ. Идэвхгүй бол Cron-ийг асаагаад доорх SQL-ийг ажиллуулна. Ажилтан цэг илгээх бүрд тухайн ажилтны 30 хоногоос өмнөх түүх мөн цэвэрлэгдэнэ. Cron нь ажиллахаа больсон ажилтны түүхийг ч хугацаанд нь устгахад шаардлагатай.

   ```sql
   select cron.schedule('employee-tracking-retention', '17 18 * * *',
     'select public.prune_employee_tracking()');
   ```

4. Android native build-ээ дахин үүсгэнэ: `npx expo run:android`, эсвэл төслийн EAS profile-оор `npx eas build --platform android`. Expo Go нь UI болон foreground GPS туршилтад ашиглагдана; Android background location-ийг Expo Go дэмждэггүй. [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/).
5. Ажилтан нэвтэрч “Ирлээ” бүртгэнэ → байршлын тайлбар/зөвшөөрлийг зөвшөөрнө → Android дээр “Allow all the time” өгнө. Мэдэгдэл: **ERP байршлын үйлчилгээ ажиллаж байна**.
6. Мобайл админ: **Байршил** (`Live` / `LiveTracking`) → marker → **Дэлгэрэнгүй харах** (`EmployeeLiveTracking`). Admin-web: **Байршил** → marker сонгож хэмжилт, route үзнэ.

2026-09-08-нд дээрх хоёр migration-ийг linked Supabase төсөлд хэрэглэж, schema reload хийсэн. Тестүүд тусгаарласан PostgreSQL/PGlite орчинд мөн ажилласан. Бодит Android төхөөрөмж дээр locked-screen, OEM battery settings болон сүлжээ тасрах туршилтыг release-ээс өмнө хийнэ.

Ажилтны картаас **Утасны Maps дээр нээх** товчоор iPhone дээр Apple Maps, Android дээр geo intent дэмждэг суулгасан Maps апп нээгдэнэ. Native апп олдохгүй бол вэб Maps ашиглана. Admin-web мөн төхөөрөмжид тохирсон Apple/Google Maps холбоосыг нээнэ.

## Өгөгдөл ба эрх

`current_locations`: ажилтан бүрийн нэг мөр. `employee_id` нь жинхэнэ `profiles.id` UUID; жишээ EMP001-ийг хиймлээр үүсгээгүй. `profiles.name`-ийг UI-д холбоно. `latitude`, `longitude`, `accuracy` (метр), `speed` (m/s), `heading` (0–359°), `battery` (0–100, мэдэхгүй бол null), `timestamp` (Unix milliseconds), `online` (session presence) хадгална.

`location_history`: `(employee_id, day, timestamp)` түлхүүртэй. `day` нь Asia/Ulaanbaatar. GPS хэмжилтийн анхны цагийг хадгална. Native дээрх сөрөг speed/heading болон олдохгүй батарейг 0 гэж таамаглахгүй, null болгоно. UI speed-ийг `m/s × 3.6`-аар km/h болгоно.

RLS-ээр хоёр хүснэгтийг зөвхөн одоо байгаа `is_admin_user()` эрхтэй хэрэглэгч уншина. Ажилтан хүснэгт рүү шууд insert/update/delete хийж чадахгүй. `ingest_employee_location(p)` болон 100 хүртэл цэгийн `ingest_employee_locations(points)` RPC нь `auth.uid()` болон payload employee ID-г тулгана. Бүх шалгалт сервер дээр хийгдэнэ. Клиент дотор service-role key ашиглахгүй.

RPC нь цэг авсан мөчийн ирцийн хамгийн сүүлийн check-in/check-out-ыг шалгана. Rejected ирц тооцохгүй; pending нь existing attendance-ийнхтай адил идэвхтэйд тооцогдоно. 24 цагаас урт session-ийг автоматаар хүчинтэй гэж үзэхгүй. Хуучин offline цэг тухайн ээлж дууссаны дараа ирсэн ч ээлжийн хугацаанд авсан бол түүхт орно. Current timestamp зөвхөн өснө. Checkout trigger болон timestamp дээрх online logic хуучин replay-гаар ажилтныг дахин online болгохгүй.

## GPS, түүх, offline

- Native GPS 5 секундийн cadence-аар хөдөлгөөнийг ажиглана. Илгээлт машинтай үед 5 секунд, явган үед 12 секунд, зогсоход 30 секунд; 10 м хөдөлбөл 3 секундээс наашгүйгээр илгээнэ. Android нь хүссэн interval-ийг яг таг биелүүлэх баталгаа өгдөггүй.
- Accuracy 100 м-ээс муу, координат хүрээнээс гарсан, ирээдүй 60 секундээс хол, 7 хоногоос хуучин цэгийг хүлээж авахгүй.
- Haversine + хугацаа + 80 m/s дээд хурд + accuracy tolerance ашиглаж өмнөх/дараах цэгтэй харьцуулна. 5 секундэд 3 км үсрэлтийг route-д оруулахгүй. Түүхт 5–20 м-ээс бага өөрчлөлтийг accuracy-аас хамааран хасна; current heartbeat үргэлжилнэ.
- Offline цэг эхлээд AsyncStorage-д баталгаатай бичигдэнэ. Queue нь хэрэглэгч тус бүрээр тусдаа, 7 хоног/12,000 цэгийн дээд хязгаартай; хэтэрвэл хамгийн хуучин цэгийг хасна. Хязгаараас урт offline хугацаанд бүх замыг хадгалах баталгаа байхгүй.
- NetInfo reconnect, 30 секундийн retry, шинэ GPS callback sync-ийг эхлүүлнэ. Хамгийн шинэ цэгийг түрүүлж илгээнэ; дараа нь 100 цэгийн багцаар, нэг удаад 500 хүртэл replay хийнэ. Server timestamp нь current-ийг ухраахгүй. Сервер баталгаажуулах хүртэл queue-г арилгахгүй; давхардсан цэг PK-аар idempotent.
- Ирц дуусахад local tracking identity-г эхэлж цэвэрлээд native task-ийг зогсооно. Үлдсэн queue нь тухайн хэрэглэгч дахин сүлжээнд холбогдох үед sync хийнэ. Өөр хэрэглэгчийн session-аар replay хийхгүй.

## Газрын зураг ба performance

Ерөнхий зураг зөвхөн `current_locations`-ийг subscribe хийнэ. Мобайл detail нь сонгосон ажилтны current мөр болон тухайн өдрийн history-г сонсоно. History-г 500 цэгийн pagination-аар бүрэн татна. Reconnect болон 60 секундийн reconciliation нь алдсан event-ийг нөхнө. [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

Shared `admin-web/live-tracking-map.js` нь Leaflet marker-ийг 1 секундээр зөөлөн хөдөлгөнө, шинэ update өмнөх animation-ийг цуцална, reduced-motion-ийг хүндэтгэнэ. Map HTML-д auth token орохгүй. Нэр/тайлбарыг escape хийнэ. Follow, Route fit, Current center, Satellite, start point, service location markers дэмжинэ. Route дарвал Follow унтарна; гараар pan хийхэд мөн унтарна. Map tiles/CDN-д интернет шаардлагатай.

Online ≤30 секунд; Weak 30–120 секунд; Offline >120 секунд эсвэл ээлж дууссан. Last seen секундээр шинэчлэгдэнэ. Accuracy ≤10 м Excellent, ≤30 м Good, бусад Low accuracy. Өдрийн зай нь хадгалсан GPS route-ийн Haversine нийлбэр; зам дагуу map-matching эсвэл автомашины одометрийн утга биш.

## Дахин асаах ба Android

`app.json` болон Android manifest-д fine/coarse/background location, foreground service/location, notifications зөвшөөрлүүд байна. Expo Location plugin foreground service-ийг тохируулсан. Өмнөх профайлын battery settings/diagnostics удирдлагыг хадгалсан.

Идэвхтэй хэрэглэгч/session expiry дискэнд хадгалагдана. App foreground/restart үед серверийн ирцийг шалгаж сэргээнэ; сүлжээгүй үед зөв хэрэглэгчийн хүчинтэй persisted session-ийг ашиглана. Android force-stop, reboot болон үйлдвэрлэгчийн battery restriction-ийн дараа OS background эхлэлтийг хориглож болно; хэрэглэгч аппыг дахин нээх шаардлагатай байж болно. Код reboot-ийн дараа тасралтгүй GPS авахыг батлахгүй. [Expo background location limitations](https://docs.expo.dev/versions/latest/sdk/location/#background-location).

## Шалгалт

```sh
node --test tests/fuel-entry.test.cjs tests/tracking.test.cjs tests/tracking-queue.test.cjs
npm install --prefix tmp/tracking-validation --no-save @electric-sql/pglite
node tests/tracking-database.cjs
npx tsc --noEmit
npx expo export --platform android --output-dir tmp/mobile-tracking-export --max-workers 2
```

Release smoke test: check-in → background notification → админ marker → утас түгжих → хөдөлгөөн → Wi-Fi/mobile data таслах → хөдөлгөөн → reconnect → бүтэн route/current timestamp → check-out → notification зогсох → өөр ажилтнаар нэвтрэхэд өмнөх queue дамжихгүй байх. Бодит төхөөрөмж дээр battery optimization тохиргоо тус бүрийг шалгана.
