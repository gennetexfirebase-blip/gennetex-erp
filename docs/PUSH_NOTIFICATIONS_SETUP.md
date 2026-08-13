# Gennetex ERP Push Notification setup

Энэ integration нь native FCM token ашиглаж, Supabase Edge Function доторх
Firebase Admin SDK-ээр notification илгээнэ. Firebase private key болон service
account мэдээлэл mobile/web bundle-д хэзээ ч ордоггүй.

## 1. Firebase Console

1. Firebase project үүсгэх эсвэл одоо байгаа project-оо нээнэ.
2. Android app нэмнэ: package name com.gennetex.erp.
3. google-services.json-ийг project root-д байрлуулна.
4. iOS app нэмнэ: bundle ID com.gennetex.erp.
5. GoogleService-Info.plist-ийг project root-д байрлуулна.
6. Project Settings > Cloud Messaging дээр Cloud Messaging API идэвхтэй эсэхийг шалгана.
7. iOS-д Apple Developer-ийн APNs Authentication Key (.p8, Key ID, Team ID)-г
   Firebase Cloud Messaging тохиргоонд upload хийнэ.
8. Project Settings > Service accounts > Generate new private key-ээр server
   credential татна. JSON файлыг repo-д commit хийхгүй.

google-services.json, GoogleService-Info.plist, .p8, private key болон
fcm-service-account.json нь .gitignore-д орсон.

## 2. Supabase server secrets

Repo-оос гадуур түр env файл үүсгэнэ:

~~~env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
~~~

Дараа нь:

~~~powershell
npx supabase secrets set --env-file C:\secure\gennetex-firebase.env --project-ref zkftykocmqzrgdhgwluu --workdir .
npx supabase functions deploy send-push --project-ref zkftykocmqzrgdhgwluu --workdir .
~~~

Эдгээрийг EXPO_PUBLIC_ нэрээр бүү үүсгэ. Expo client-д зөвхөн одоо байгаа
Supabase URL болон publishable/anon key хэрэглэгдэнэ.

## 3. Database

Migration: supabase/migrations/20260809091132_notifications_fcm_and_job_approvals.sql

Шинэ environment дээр:

~~~powershell
npx supabase link --project-ref zkftykocmqzrgdhgwluu --workdir . --yes
npx supabase db push --linked --include-all --workdir . --yes
~~~

Migration нь:

- push_tokens: нэг user олон төхөөрөмж, token uniqueness, platform/device ID,
  active/last seen timestamps, owner-only RLS;
- notifications: notification history, read state, realtime;
- notification_settings: push/messages/orders/payments/tasks/system preference;
- job_applications: admin approval signature/name/date;
- шаардлагатай indexes, updated-at trigger, RLS policies үүсгэнэ.

## 4. Development ба production build

Expo Go нь project-specific native FCM module агуулдаггүй тул remote push test
хийхгүй. Development Build эсвэл Production Build хэрэглэнэ.

~~~powershell
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
npx expo start --dev-client --tunnel
~~~

Internal Android APK:

~~~powershell
npx eas-cli build --profile preview --platform android
~~~

Store production:

~~~powershell
npx eas-cli build --profile production --platform android
npx eas-cli build --profile production --platform ios
~~~

iOS physical device build хийхэд Apple Developer signing болон APNs key
шаардлагатай. Android 13+ болон iOS permission-ийг app анх нээхэд хүснэ.

## 5. Test

1. Development Build-ээр нэвтэрч notification permission-ийг зөвшөөрнө.
2. Supabase Table Editor-ийн push_tokens дээр user ID, android/ios, device_id,
   active FCM token үүссэнийг шалгана.
3. Firebase Console > Messaging-ээс тухайн FCM token руу test message илгээнэ.
4. Foreground, background, killed state тус бүрд banner/sound/tap navigation шалгана.
5. App дотор admin эрхтэй session JWT ашиглан Edge Function-ийг test хийж болно:

~~~powershell
$jwt = '<SIGNED_IN_ADMIN_ACCESS_TOKEN>'
$body = @{
  audience = @{ kind = 'user'; userId = '<TARGET_USER_UUID>' }
  notification = @{
    title = 'Туршилтын мэдэгдэл'
    body = 'FCM болон Notification Center шалгалт'
    type = 'admin'
    screen = 'Notifications'
    entityId = 'test-1'
    channelId = 'urgent'
  }
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri 'https://zkftykocmqzrgdhgwluu.supabase.co/functions/v1/send-push' -Headers @{ Authorization = "Bearer $jwt"; apikey = '<SUPABASE_PUBLISHABLE_OR_ANON_KEY>' } -ContentType 'application/json' -Body $body
~~~

6. Logout хийсний дараа тухайн device-ийн token active=false болсон эсэхийг
   шалгана. FCM invalid/expired token илэрвэл Edge Function автоматаар устгана.

Android channels: default, messages, orders, payments, urgent.
Хуучин feature-үүдийн compatibility-д chat, feed, calls channel хадгалагдсан.

## 6. Гол integration файлууд

- Client lifecycle/token/send API: src/services/notificationService.js
- History/settings data layer: src/services/notificationCenterService.js
- Permission, foreground/background/tap handling:
  src/components/PushNotificationManager.js, index.js
- Notification Center ба Settings:
  src/screens/NotificationCenterScreen.js, src/screens/NotificationSettingsScreen.js
- Bell/badge/navigation: src/components/TabBar.js, src/components/NavIcon.js,
  src/lib/navigationRef.js, App.js
- Secure sender: supabase/functions/send-push/index.ts,
  supabase/functions/_shared/push.ts
- Expo/native config: app.config.js, app.json, package.json

## 7. Error diagnosis

- Token үүсэхгүй: Firebase platform file, physical device, permission,
  Development Build ашиглаж байгаа эсэхийг шалгана.
- Edge Function 500: Supabase dashboard-ийн Edge Function log-оос Firebase
  secret format шалгана.
- iOS delivery байхгүй: Firebase дээр APNs key, bundle ID, provisioning profile
  таарч байгаа эсэхийг шалгана.
- Android sound/channel буруу: app-ийг uninstall/reinstall хийж channel config-ийг
  дахин үүсгэнэ. Android channel property анх үүссэний дараа immutable байдаг.
