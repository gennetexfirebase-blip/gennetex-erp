import { Linking } from 'react-native';

// Jitsi Meet ашиглан видео дуудлага (тусгай сервер шаардахгүй, Expo Go дээр ажиллана).
const JITSI_BASE = 'https://meet.jit.si';
const ROOM_PREFIX = 'FieldService';

// Хоёр хэрэглэгчийн хооронд тогтвортой өрөөний нэр үүсгэх
export function roomForUsers(idA, idB) {
  const pair = [idA, idB].sort().join('-');
  return `${ROOM_PREFIX}-${sanitize(pair)}`;
}

export function roomLink(room) {
  return `${JITSI_BASE}/${encodeURIComponent(room)}`;
}

export async function startCall(room) {
  const url = roomLink(room);
  const ok = await Linking.canOpenURL(url);
  if (ok) await Linking.openURL(url);
  return url;
}

function sanitize(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '');
}
