import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { APP_VERSION_LABEL } from '../version';
import { supabase } from '../lib/supabase';
import { callEdge } from '../lib/edgeFunction';

// Telegram-ийн алдааг нэг л удаа мэдэгдэхийн тулд
let warnedTelegram = false;

function safe(v, max = 1200) {
  const s = String(v ?? '');
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function buildContext(extra = {}) {
  const ctx = {
    appVersion: APP_VERSION_LABEL,
    platform: Platform.OS,
    when: new Date().toISOString(),
    ...extra,
    expo: {
      sdkVersion: Constants.expoConfig?.sdkVersion || null,
      projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null,
    },
  };
  return safe(JSON.stringify(ctx, null, 2), 1800);
}

/** GPS асаалт/унтраалтыг Telegram группд мэдэгдэх */
export async function notifyGpsStatus({ userName, userId, enabled, coord } = {}) {
  if (!supabase) return;
  try {
    // Хуучин `x-alert-secret` толгойг хассан: EXPO_PUBLIC_* утга нь аппын
    // bundle дотор ил бичигдэж, APK задлахад хэн ч уншиж чадна. Тиймээс
    // тэр нь нууц биш. supabase.functions.invoke нь нэвтэрсэн хэрэглэгчийн
    // JWT-г автоматаар Authorization толгойд илгээдэг — Edge Function
    // түүгээр таниулна.
    const headers = undefined;
    const who = userName || userId || 'Ажилтан';
    const loc = coord
      ? `Сүүлийн байршил: ${Number(coord.latitude).toFixed(5)}, ${Number(coord.longitude).toFixed(5)}`
      : 'Сүүлийн байршил тодорхойгүй';
    const title = enabled ? '📍 GPS дахин асаалаа' : '⚠️ GPS унтраалаа';
    const message = `${who} байршлын GPS-ээ ${enabled ? 'дахин асаалаа' : 'унтраалаа'}.\n${loc}`;
    await supabase.functions.invoke('telegram-alert', {
      body: {
        title,
        message,
        user: who,
        appVersion: APP_VERSION_LABEL,
        platform: Platform.OS,
        when: new Date().toISOString(),
      },
      headers,
    });
  } catch (e) {
    // чимээгүй алгасна
  }
}

/**
 * Шинэ торгууль илэрсэн үед Telegram группд мэдэгдэнэ.
 *
 * `fines` нь VehicleSpecsScreen-ий fineWithDriver бүтэцтэй мөрүүд —
 * тухайн үед машиныг хэн жолоодож байсныг аяллын түүхээс тааруулсан байдаг.
 */
export async function notifyNewFines({ plate, fines = [] } = {}) {
  if (!supabase || !fines.length) return;
  try {
    // Хуучин `x-alert-secret` толгойг хассан: EXPO_PUBLIC_* утга нь аппын
    // bundle дотор ил бичигдэж, APK задлахад хэн ч уншиж чадна. Тиймээс
    // тэр нь нууц биш. supabase.functions.invoke нь нэвтэрсэн хэрэглэгчийн
    // JWT-г автоматаар Authorization толгойд илгээдэг — Edge Function
    // түүгээр таниулна.
    const headers = undefined;

    const lines = fines.slice(0, 10).map((f, i) => {
      const parts = [
        `${i + 1}. ${f.amount || '—'}`,
        f.violation ? `   Зөрчил: ${f.violation}` : null,
        `   Жолооч: ${f.driver || '—'}`,
        f.where ? `   Байршил: ${f.where}` : null,
        f.date ? `   Огноо: ${f.date}` : null,
        f.status ? `   Төлөв: ${f.status}` : null,
      ];
      return parts.filter(Boolean).join('\n');
    });
    const more = fines.length > 10 ? `\n… нийт ${fines.length} торгууль` : '';

    await supabase.functions.invoke('telegram-alert', {
      body: {
        title: `🚨 Шинэ торгууль · ${plate}`,
        message: safe(`${plate} дугаартай машинд ${fines.length} шинэ торгууль бүртгэгдлээ.\n\n${lines.join('\n\n')}${more}`, 3000),
        user: plate,
        appVersion: APP_VERSION_LABEL,
        platform: Platform.OS,
        when: new Date().toISOString(),
      },
      headers,
    });
  } catch (e) {
    // Мэдэгдэл амжилтгүй болсон нь дэлгэцийн ажиллагааг зогсоох ёсгүй
  }
}

export async function reportSystemError(error, extra = {}) {
  if (!supabase) return;
  try {
    const title = safe(extra.title || 'App error', 120);
    const message = safe(error?.stack || error?.message || String(error), 3200);
    const context = buildContext(extra);
    // Хуучин `x-alert-secret` толгойг хассан: EXPO_PUBLIC_* утга нь аппын
    // bundle дотор ил бичигдэж, APK задлахад хэн ч уншиж чадна. Тиймээс
    // тэр нь нууц биш. supabase.functions.invoke нь нэвтэрсэн хэрэглэгчийн
    // JWT-г автоматаар Authorization толгойд илгээдэг — Edge Function
    // түүгээр таниулна.
    const headers = undefined;
    // ⚠️ `error` нэрийг ДАХИН ашиглаж болохгүй — тэр нь энэ функцийн параметр.
    // Өмнө нь `const { error } = ...` гэж бичсэн тул дээрх мөрүүд (message,
    // context) TDZ-д унаж "Cannot access 'error' before initialization" гэсэн
    // алдаа шиддэг байв. Гадна талын catch түүнийг чимээгүй залгидаг байсан
    // учир КРЭШ МЭДЭЭЛЭХ СИСТЕМ ӨӨРӨӨ ХЭЗЭЭ Ч АЖИЛЛААГҮЙ.
    const { error: sendError } = await callEdge('telegram-alert', {
      title,
      message,
      context,
      user: extra.user || null,
      appVersion: APP_VERSION_LABEL,
      platform: Platform.OS,
      when: new Date().toISOString(),
    }, { headers, silent: true });
    // Telegram мэдэгдэл нь туслах үүрэгтэй — амжилтгүй болсон нь аппын
    // ажиллагаанд нөлөөлөхгүй. Гэхдээ алдааг нэг л удаа мэдэгдэнэ, эс бөгөөс
    // алдаа бүрд давтагдаж консолыг дүүргэдэг байв.
    if (sendError && __DEV__ && !warnedTelegram) {
      warnedTelegram = true;
      console.warn(
        '[alerting] telegram-alert Edge Function 2xx биш хариу өглөө. ' +
          'Шалгах зүйлс: (1) функц deploy хийгдсэн эсэх — ' +
          'npx supabase functions deploy telegram-alert, ' +
          '(2) TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID тохируулсан эсэх, ' +
          '(3) EXPO_PUBLIC_ALERT_SECRET нь функцийнхтэй таарч байгаа эсэх. ' +
          'Дэлгэрэнгүй: ' + sendError
      );
    }
  } catch (e) {
    // avoid recursive crash loops
  }
}
