import React from 'react';
import Svg, { Path, Circle, Rect, Line, Ellipse } from 'react-native-svg';

const ICONS = {
  dashboard: (c) => (
    <>
      <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.8" fill="none"/>
      <Rect x="13" y="3" width="8" height="5" rx="1.5" stroke={c} strokeWidth="1.8" fill="none"/>
      <Rect x="13" y="12" width="8" height="9" rx="1.5" stroke={c} strokeWidth="1.8" fill="none"/>
      <Rect x="3" y="15" width="8" height="6" rx="1.5" stroke={c} strokeWidth="1.8" fill="none"/>
    </>
  ),
  home: (c) => (
    <Path d="M4 10.5 L12 4 L20 10.5 V19 H4 Z" stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
  ),
  attendance: (c) => (
    <>
      <Rect x="4" y="6" width="16" height="14" rx="2" stroke={c} strokeWidth="1.8" fill="none"/>
      <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.8" fill="none"/>
    </>
  ),
  chat: (c) => (
    <Path d="M4 6 H20 V16 H9 L4 19 V6 Z" stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
  ),
  feed: (c) => (
    <>
      <Rect x="4" y="4" width="16" height="16" rx="2" stroke={c} strokeWidth="1.8" fill="none"/>
      <Line x1="8" y1="9" x2="16" y2="9" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <Line x1="8" y1="13" x2="16" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <Line x1="8" y1="17" x2="13" y2="17" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    </>
  ),
  profile: (c) => (
    <>
      <Circle cx="12" cy="9" r="3.5" stroke={c} strokeWidth="1.8" fill="none"/>
      <Path d="M5 20 C5 16 8 14 12 14 C16 14 19 16 19 20" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </>
  ),
  notifications: (c) => (
    <>
      <Path d="M6 17 H18 L16.5 14 V10 A4.5 4.5 0 0 0 7.5 10 V14 Z" stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <Path d="M10 19 C10.5 21 13.5 21 14 19" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </>
  ),
  inventory: (c) => (
    <>
      <Path d="M4 8 L12 4 L20 8 V18 H4 Z" stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <Line x1="12" y1="11" x2="12" y2="15" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    </>
  ),
  tools: (c) => (
    <Path d="M7 7 L11 17 M17 7 L13 17 M9 12 H15" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
  ),
  allocation: (c) => (
    <>
      <Rect x="5" y="4" width="14" height="17" rx="2" stroke={c} strokeWidth="1.8" fill="none"/>
      <Line x1="8" y1="9" x2="16" y2="9" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <Line x1="8" y1="13" x2="16" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <Line x1="8" y1="17" x2="13" y2="17" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    </>
  ),
  vehicle: (c) => (
    <>
      <Path d="M5 16 L7 11 H17 L19 16" stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <Rect x="3" y="16" width="18" height="4" rx="1" stroke={c} strokeWidth="1.8" fill="none"/>
      <Circle cx="7.5" cy="18.5" r="1.5" fill={c} />
      <Circle cx="16.5" cy="18.5" r="1.5" fill={c} />
    </>
  ),
  fuel: (c) => (
    <>
      <Rect x="6" y="4" width="10" height="16" rx="2" stroke={c} strokeWidth="1.8" fill="none"/>
      <Path d="M16 8 V14 C17.5 14 18 12.5 18 11 V7 L16 6" stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <Rect x="8" y="7" width="6" height="5" rx="1" stroke={c} strokeWidth="1.5" fill="none"/>
    </>
  ),
  calls: (c) => (
    <>
      <Path d="M12 21 C12 21 19 16 19 11 A5 5 0 0 0 9 8 A5 5 0 0 0 5 11 C5 16 12 21 12 21 Z" stroke={c} strokeWidth="1.8" fill="none"/>
      <Circle cx="12" cy="11" r="2" fill={c} />
    </>
  ),
  employees: (c) => (
    <>
      <Circle cx="9" cy="8" r="3" stroke={c} strokeWidth="1.8" fill="none"/>
      <Circle cx="17" cy="9" r="2.5" stroke={c} strokeWidth="1.8" fill="none"/>
      <Path d="M4 19 C4 16 6 14 9 14 S14 16 14 19" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <Path d="M14 19 C14 17 15.5 15.5 17 15.5" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </>
  ),
  qr: (c) => (
    <>
      <Rect x="4" y="4" width="7" height="7" stroke={c} strokeWidth="1.8" fill="none"/>
      <Rect x="13" y="4" width="7" height="7" stroke={c} strokeWidth="1.8" fill="none"/>
      <Rect x="4" y="13" width="7" height="7" stroke={c} strokeWidth="1.8" fill="none"/>
      <Rect x="15" y="15" width="3" height="3" fill={c} />
      <Rect x="19" y="15" width="1" height="1" fill={c} />
      <Rect x="15" y="19" width="1" height="1" fill={c} />
      <Rect x="19" y="19" width="1" height="1" fill={c} />
    </>
  ),
  location: (c) => (
  <>
      <Path d="M12 21 C12 21 19 16 19 11 A7 7 0 1 0 5 11 C5 16 12 21 12 21 Z" stroke={c} strokeWidth="1.8" fill="none"/>
      <Circle cx="12" cy="11" r="2.5" stroke={c} strokeWidth="1.8" fill="none"/>
    </>
  ),
  clock: (c) => (
    <>
      <Circle cx="12" cy="12" r="8" stroke={c} strokeWidth="1.8" fill="none"/>
      <Path d="M12 8 V12 L15 14" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </>
  ),
  online: (c) => <Circle cx="12" cy="12" r="5" fill={c} />,
  report: (c) => (
    <>
      <Rect x="5" y="3" width="14" height="18" rx="2" stroke={c} strokeWidth="1.8" fill="none"/>
      <Line x1="8" y1="8" x2="16" y2="8" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <Line x1="8" y1="12" x2="16" y2="12" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <Line x1="8" y1="16" x2="13" y2="16" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    </>
  ),
  ai: (c) => (
    <>
      <Path d="M12 3 L13.6 8.4 L19 10 L13.6 11.6 L12 17 L10.4 11.6 L5 10 L10.4 8.4 Z" stroke={c} strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
      <Path d="M18 15 L18.8 17.2 L21 18 L18.8 18.8 L18 21 L17.2 18.8 L15 18 L17.2 17.2 Z" fill={c} stroke={c} strokeWidth="0.6" strokeLinejoin="round"/>
    </>
  ),
};

export default function NavIcon({ name, size = 22, color = '#7986a8', active = false, activeColor = '#00f0ff' }) {
  const stroke = active ? activeColor : color;
  const render = ICONS[name];
  if (!render) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {render(stroke)}
    </Svg>
  );
}
