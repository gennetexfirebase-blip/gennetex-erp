import React from 'react';
import Svg, { Path, Circle, Rect, Line, G } from 'react-native-svg';

/**
 * Апп-ын дүрсний багц.
 *
 * ДҮРЭМ (бүх дүрс дагана):
 *   • 24×24 сүлжээ, харагдах хэсэг нь 3.5–20.5 хооронд — бүгд ижил оптик хэмжээтэй
 *   • Зузаан ЗӨВХӨН 1.7. Өмнө нь 1.8 / 1.6 / 1.5 / 0.6 холилдож, зарим нь
 *     бүдэг, зарим нь бүдүүн харагддаг байв.
 *   • Бүх үзүүр, булан дугуй (`round`) — хурц булан бүдүүлэг харагдуулдаг
 *   • Дүрс бүр өөр силуэттэй байх. Өмнө нь feed / allocation / report гурав
 *     бүгд "тэгш өнцөгт + 3 зураас" байсан тул ялгагдахгүй байв.
 */

const SW = 1.7;

/** Бүх зурааст дүрсэд нийтлэг шинж — давтахгүйн тулд нэг дор. */
const stroke = (c) => ({
  stroke: c,
  strokeWidth: SW,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

const ICONS = {
  // --- Үндсэн навигаци ---
  home: (c) => (
    <G {...stroke(c)}>
      <Path d="M4 10.2 L12 4 L20 10.2 V19 a1 1 0 0 1-1 1 H5 a1 1 0 0 1-1-1 Z" />
      <Path d="M9.5 20 v-5 h5 v5" />
    </G>
  ),

  dashboard: (c) => (
    <G {...stroke(c)}>
      <Rect x="4" y="4" width="7" height="7" rx="2" />
      <Rect x="13" y="4" width="7" height="4.5" rx="1.8" />
      <Rect x="13" y="10.5" width="7" height="9.5" rx="2" />
      <Rect x="4" y="13" width="7" height="7" rx="2" />
    </G>
  ),

  // Хугацааны тэмдэглэл — цаг + тэмдэг. Календарь биш, ирц гэдгээ илэрхийлнэ.
  attendance: (c) => (
    <G {...stroke(c)}>
      <Rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <Path d="M8 3.5 v3 M16 3.5 v3 M3.5 9.5 h17" />
      <Path d="M9 14.5 l2 2 l4-4" />
    </G>
  ),

  chat: (c) => (
    <G {...stroke(c)}>
      <Path d="M20 12.5 a7.5 6.5 0 0 1-7.5 6.5 a8.6 8.6 0 0 1-2.6-.4 L5 20.5 l1.3-3.4 A6.4 6.4 0 0 1 4.5 12.5 a7.5 6.5 0 0 1 7.5-6.5 a7.5 6.5 0 0 1 8 6.5 Z" />
    </G>
  ),

  // Фийд — зурагтай пост. Ингэснээр "тайлан"-гаас ялгарна.
  feed: (c) => (
    <G {...stroke(c)}>
      <Rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <Circle cx="8.5" cy="9.5" r="1.6" />
      <Path d="M3.5 16.5 l4.5-4 a1.6 1.6 0 0 1 2.2 0 L14 16" />
      <Path d="M13 14.5 l2.2-2 a1.6 1.6 0 0 1 2.2 0 l3.1 2.8" />
    </G>
  ),

  profile: (c) => (
    <G {...stroke(c)}>
      <Circle cx="12" cy="8.5" r="3.6" />
      <Path d="M4.8 20 a7.4 7.4 0 0 1 14.4 0" />
    </G>
  ),

  notifications: (c) => (
    <G {...stroke(c)}>
      <Path d="M6.2 16.8 a1 1 0 0 1-.7-1.7 L6.8 13.8 V10.5 a5.2 5.2 0 0 1 10.4 0 v3.3 l1.3 1.3 a1 1 0 0 1-.7 1.7 Z" />
      <Path d="M10 19.2 a2.2 2.2 0 0 0 4 0" />
    </G>
  ),

  // --- Агуулах ---
  inventory: (c) => (
    <G {...stroke(c)}>
      <Path d="M3.5 8 L12 3.8 L20.5 8 v8 L12 20.2 L3.5 16 Z" />
      <Path d="M3.5 8 L12 12.2 L20.5 8" />
      <Path d="M12 12.2 V20.2" />
    </G>
  ),

  // Багаж — түлхүүр. Өмнөх "Х + зураас" нь юуг ч илэрхийлдэггүй байв.
  tools: (c) => (
    <G {...stroke(c)}>
      <Path d="M14.5 6.2 a4 4 0 1 0 3.3 3.3 l2.7-2.7 -2.1-2.1 -2.7 2.7 a4 4 0 0 0-1.2-1.2 Z" />
      <Path d="M12.4 11.6 L5.2 18.8 a1.8 1.8 0 0 0 2.5 2.5 l7.2-7.2" />
    </G>
  ),

  // Хуваарилалт — жагсаалт + чагт. Тайлангаас ялгарна.
  allocation: (c) => (
    <G {...stroke(c)}>
      <Path d="M4.5 7 h7 M4.5 12 h7 M4.5 17 h5" />
      <Path d="M14.5 8.6 l1.8 1.8 l3.4-3.4" />
      <Path d="M14.5 16.5 l1.8 1.8 l3.4-3.4" />
    </G>
  ),

  // --- Тээвэр ---
  vehicle: (c) => (
    <G {...stroke(c)}>
      <Path d="M4 15.5 l1.6-5 a2 2 0 0 1 1.9-1.4 h9 a2 2 0 0 1 1.9 1.4 l1.6 5" />
      <Path d="M3.5 15.5 h17 v2.8 a1 1 0 0 1-1 1 h-1.6 a1 1 0 0 1-1-1 v-.8 H7.1 v.8 a1 1 0 0 1-1 1 H4.5 a1 1 0 0 1-1-1 Z" />
      <Path d="M6.6 17 h.01 M17.4 17 h.01" />
    </G>
  ),

  fuel: (c) => (
    <G {...stroke(c)}>
      <Path d="M5 20.5 V5.5 a2 2 0 0 1 2-2 h5 a2 2 0 0 1 2 2 v15" />
      <Path d="M4 20.5 h11" />
      <Rect x="7.4" y="6.6" width="4.2" height="3.6" rx="0.8" />
      <Path d="M14 9.5 h2.6 a1.6 1.6 0 0 1 1.6 1.6 v4.6 a1.5 1.5 0 0 0 3 0 V9.2 l-2-2" />
    </G>
  ),

  // --- Хүн, дуудлага ---
  calls: (c) => (
    <G {...stroke(c)}>
      <Path d="M8.2 4.4 a1.4 1.4 0 0 1 1.9.5 l1.4 2.4 a1.4 1.4 0 0 1-.3 1.8 l-1.3 1 a9.6 9.6 0 0 0 4 4 l1-1.3 a1.4 1.4 0 0 1 1.8-.3 l2.4 1.4 a1.4 1.4 0 0 1 .5 1.9 l-1 1.7 a2.4 2.4 0 0 1-2.7 1.1 C11.6 19.2 4.8 12.4 3.4 6.2 A2.4 2.4 0 0 1 4.5 3.5 Z" />
    </G>
  ),

  employees: (c) => (
    <G {...stroke(c)}>
      <Circle cx="9" cy="8.2" r="3.2" />
      <Path d="M3.4 19.5 a5.8 5.8 0 0 1 11.2 0" />
      <Path d="M16.2 6.4 a3 3 0 0 1 0 5.8" />
      <Path d="M17.4 14.6 a5.2 5.2 0 0 1 3.2 4.9" />
    </G>
  ),

  // --- Бусад ---
  qr: (c) => (
    <G {...stroke(c)}>
      <Rect x="4" y="4" width="6.4" height="6.4" rx="1.4" />
      <Rect x="13.6" y="4" width="6.4" height="6.4" rx="1.4" />
      <Rect x="4" y="13.6" width="6.4" height="6.4" rx="1.4" />
      <Path d="M13.6 13.6 h3 v3 M20 13.6 v.01 M13.6 20 v.01 M17.6 20 h2.4 v-2.4" />
    </G>
  ),

  location: (c) => (
    <G {...stroke(c)}>
      <Path d="M12 21 s7-5.6 7-10.4 a7 7 0 1 0-14 0 C5 15.4 12 21 12 21 Z" />
      <Circle cx="12" cy="10.4" r="2.6" />
    </G>
  ),

  clock: (c) => (
    <G {...stroke(c)}>
      <Circle cx="12" cy="12" r="8.2" />
      <Path d="M12 7.2 V12 l3.2 2" />
    </G>
  ),

  // Онлайн — дүүрсэн цэг + гэрэлтэх цагираг, зөвхөн энэ нь дүүргэлттэй
  online: (c) => (
    <G>
      <Circle cx="12" cy="12" r="4.2" fill={c} />
      <Circle cx="12" cy="12" r="7.4" stroke={c} strokeWidth={SW} fill="none" opacity={0.35} />
    </G>
  ),

  // Тайлан — баримт + өсөх график. Жагсаалтаас тодорхой ялгарна.
  report: (c) => (
    <G {...stroke(c)}>
      <Path d="M6 3.5 h7.6 L19 8.9 V19 a1.5 1.5 0 0 1-1.5 1.5 H6 A1.5 1.5 0 0 1 4.5 19 V5 A1.5 1.5 0 0 1 6 3.5 Z" />
      <Path d="M13.4 3.6 v5.2 h5.2" />
      <Path d="M8 16.6 v-2.4 M11.4 16.6 v-4.6 M14.8 16.6 v-1.4" />
    </G>
  ),

  ai: (c) => (
    <G {...stroke(c)}>
      <Path d="M11 4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5-4 l-4-1.5 l4-1.5 Z" />
      <Path d="M17.6 14.4 l.8 2 l2 .8 l-2 .8 l-.8 2 l-.8-2 l-2-.8 l2-.8 Z" />
    </G>
  ),
};

export const ICON_NAMES = Object.keys(ICONS);

// Өнгийг дуудагч тал useTheme()-ээс дамжуулна. Доорх утга нь зөвхөн fallback —
// брэндийн токенуудтай (theme/tokens.js) нийцсэн байх ёстой.
export default function NavIcon({
  name,
  size = 22,
  color = '#77777f',
  active = false,
  activeColor = '#0099db',
}) {
  const tint = active ? activeColor : color;
  const render = ICONS[name];
  if (!render) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {render(tint)}
    </Svg>
  );
}
