import React from 'react';
import { View, Image } from 'react-native';
import Svg, { Rect, Circle, Line, Path, Ellipse, Text as SvgText } from 'react-native-svg';
import { getInventoryImageKey } from '../data/inventoryImages';

const META = {
  router: { bg: '#e8edff', stroke: '#4f6ef7', label: 'RTR', shape: 'router'},
  switch: { bg: '#e3f2fd', stroke: '#1976d2', label: 'SW8', shape: 'box'},
  'fiber-cable' : { bg: '#fff3e0', stroke: '#f57c00', label: 'FIB', shape: 'cable'},
  'utp-cable' : { bg: '#e8f5e9', stroke: '#388e3c', label: 'UTP', shape: 'cable'},
  rj45: { bg: '#f3e5f5', stroke: '#7b1fa2', label: 'RJ', shape: 'plug'},
  onu: { bg: '#e0f7fa', stroke: '#00838f', label: 'ONU', shape: 'box'},
  'access-point' : { bg: '#ede7f6', stroke: '#5e35b1', label: 'AP', shape: 'ap'},
  'media-converter' : { bg: '#fce4ec', stroke: '#c2185b', label: 'MC', shape: 'box'},
  'patch-panel' : { bg: '#eceff1', stroke: '#455a64', label: 'PP', shape: 'panel'},
  'fiber-patch' : { bg: '#fff8e1', stroke: '#ff8f00', label: 'PC', shape: 'patch'},
  'cable-tray' : { bg: '#efebe9', stroke: '#6d4c41', label: 'CT', shape: 'tray'},
  'power-adapter' : { bg: '#e8eaf6', stroke: '#3949ab', label: '12V', shape: 'adapter'},
  'cable-tie' : { bg: '#f1f8e9', stroke: '#689f38', label: 'TIE', shape: 'tie'},
  'wall-anchor' : { bg: '#fafafa', stroke: '#616161', label: 'ANC', shape: 'anchor'},
  'fiber-adapter' : { bg: '#e1f5fe', stroke: '#0277bd', label: 'SC', shape: 'adapter-small'},
  'crimp-tool' : { bg: '#fff3e0', stroke: '#ef6c00', label: 'CR', shape: 'pliers'},
  'cable-tester' : { bg: '#e8f5e9', stroke: '#2e7d32', label: 'TST', shape: 'tester'},
  'fusion-splicer' : { bg: '#ede7f6', stroke: '#512da8', label: 'FS', shape: 'splicer'},
  cleaver: { bg: '#eceff1', stroke: '#37474f', label: 'CLV', shape: 'cleaver'},
  otdr: { bg: '#e3f2fd', stroke: '#1565c0', label: 'OTDR', shape: 'meter'},
  'power-meter' : { bg: '#f3e5f5', stroke: '#8e24aa', label: 'PM', shape: 'meter'},
  stripper: { bg: '#fffde7', stroke: '#f9a825', label: 'STR', shape: 'stripper'},
  screwdriver: { bg: '#ffebee', stroke: '#c62828', label: 'SCR', shape: 'screwdriver'},
  drill: { bg: '#e0f2f1', stroke: '#00695c', label: 'DRL', shape: 'drill'},
  ladder: { bg: '#fff8e1', stroke: '#ff6f00', label: 'LAD', shape: 'ladder'},
  'default-material' : { bg: '#e8edff', stroke: '#4f6ef7', label: 'MAT', shape: 'box'},
  'default-tool' : { bg: '#fff3e0', stroke: '#ef6c00', label: 'TOL', shape: 'pliers'},
};

function Shape({ shape, stroke }) {
  switch (shape) {
    case 'router' :
      return (
        <>
          <Rect x="18" y="30" width="44" height="24" rx="4" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Line x1="24" y1="54" x2="24" y2="62" stroke={stroke} strokeWidth="2"/>
          <Line x1="32" y1="54" x2="32" y2="62" stroke={stroke} strokeWidth="2"/>
          <Line x1="40" y1="54" x2="40" y2="62" stroke={stroke} strokeWidth="2"/>
          <Circle cx="52" cy="38" r="2" fill={stroke} />
          <Circle cx="58" cy="38" r="2" fill={stroke} />
          <Circle cx="52" cy="46" r="2" fill={stroke} />
        </>
      );
    case 'box' :
      return (
        <>
          <Rect x="20" y="28" width="40" height="28" rx="5" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Circle cx="30" cy="42" r="2.5" fill={stroke} />
          <Circle cx="40" cy="42" r="2.5" fill={stroke} />
          <Circle cx="50" cy="42" r="2.5" fill={stroke} />
        </>
      );
    case 'cable' :
      return (
        <>
          <Path d="M16 44 C28 24, 52 24, 64 44" fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round"/>
          <Circle cx="16" cy="44" r="4" fill={stroke} />
          <Circle cx="64" cy="44" r="4" fill={stroke} />
        </>
      );
    case 'plug' :
      return (
        <>
          <Rect x="28" y="24" width="24" height="32" rx="3" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Rect x="34" y="30" width="4" height="10" fill={stroke} />
          <Rect x="42" y="30" width="4" height="10" fill={stroke} />
          <Rect x="36" y="48" width="8" height="6" fill={stroke} />
        </>
      );
    case 'ap' :
      return (
        <>
          <Ellipse cx="40" cy="52" rx="18" ry="4" fill="none" stroke={stroke} strokeWidth="2"/>
          <Rect x="30" y="30" width="20" height="22" rx="4" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Line x1="40" y1="34" x2="40" y2="28" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
          <Line x1="32" y1="36" x2="28" y2="32" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
          <Line x1="48" y1="36" x2="52" y2="32" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
        </>
      );
    case 'panel' :
      return (
        <>
          <Rect x="16" y="26" width="48" height="32" rx="3" fill="#fff" stroke={stroke} strokeWidth="2"/>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Rect key={i} x={20 + i * 6} y="34" width="3" height="8" fill={stroke} />
          ))}
        </>
      );
    case 'patch' :
      return (
        <>
          <Line x1="20" y1="42" x2="60" y2="42" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
          <Rect x="18" y="38" width="6" height="8" rx="1" fill={stroke} />
          <Rect x="56" y="38" width="6" height="8" rx="1" fill={stroke} />
        </>
      );
    case 'tray' :
      return <Path d="M14 46 L66 46 L62 34 L18 34 Z" fill="#fff" stroke={stroke} strokeWidth="2"/>;
    case 'adapter' :
      return (
        <>
          <Rect x="24" y="34" width="32" height="20" rx="3" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Rect x="18" y="40" width="8" height="8" fill={stroke} />
          <Line x1="56" y1="44" x2="66" y2="44" stroke={stroke} strokeWidth="3"/>
        </>
      );
    case 'adapter-small' :
      return (
        <>
          <Rect x="30" y="32" width="20" height="24" rx="3" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Circle cx="40" cy="44" r="6" fill="none" stroke={stroke} strokeWidth="2"/>
        </>
      );
    case 'tie' :
      return (
        <>
          <Path d="M20 38 L60 38 L58 46 L22 46 Z" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Rect x="36" y="34" width="8" height="16" fill={stroke} />
        </>
      );
    case 'anchor' :
      return (
        <>
          <Circle cx="40" cy="34" r="6" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Line x1="40" y1="40" x2="40" y2="56" stroke={stroke} strokeWidth="3"/>
          <Line x1="32" y1="50" x2="48" y2="50" stroke={stroke} strokeWidth="2"/>
        </>
      );
    case 'pliers' :
      return (
        <>
          <Path d="M24 24 L34 54 M56 24 L46 54 M34 54 L46 54" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
          <Circle cx="24" cy="22" r="5" fill="none" stroke={stroke} strokeWidth="2"/>
          <Circle cx="56" cy="22" r="5" fill="none" stroke={stroke} strokeWidth="2"/>
        </>
      );
    case 'tester' :
      return (
        <>
          <Rect x="22" y="28" width="36" height="28" rx="4" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Rect x="28" y="34" width="24" height="10" rx="2" fill={stroke} opacity="0.25"/>
          <Circle cx="32" cy="52" r="2" fill={stroke} />
          <Circle cx="48" cy="52" r="2" fill={stroke} />
        </>
      );
    case 'splicer' :
      return (
        <>
          <Rect x="18" y="32" width="44" height="24" rx="4" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Rect x="24" y="38" width="14" height="12" rx="2" fill={stroke} opacity="0.3"/>
          <Rect x="42" y="38" width="14" height="12" rx="2" fill={stroke} opacity="0.3"/>
        </>
      );
    case 'cleaver' :
      return (
        <>
          <Path d="M20 50 L52 30" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
          <Rect x="48" y="24" width="12" height="8" rx="2" fill="#fff" stroke={stroke} strokeWidth="2"/>
        </>
      );
    case 'meter' :
      return (
        <>
          <Rect x="20" y="26" width="40" height="32" rx="5" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Rect x="26" y="32" width="28" height="14" rx="2" fill={stroke} opacity="0.2"/>
          <Line x1="30" y1="52" x2="50" y2="52" stroke={stroke} strokeWidth="2"/>
        </>
      );
    case 'stripper' :
      return (
        <>
          <Path d="M22 22 L30 58 M58 22 L50 58" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
          <Ellipse cx="40" cy="40" rx="8" ry="12" fill="none" stroke={stroke} strokeWidth="2"/>
        </>
      );
    case 'screwdriver' :
      return (
        <>
          <Line x1="40" y1="20" x2="40" y2="56" stroke={stroke} strokeWidth="4" strokeLinecap="round"/>
          <Rect x="32" y="48" width="16" height="10" rx="3" fill="#fff" stroke={stroke} strokeWidth="2"/>
        </>
      );
    case 'drill' :
      return (
        <>
          <Rect x="34" y="22" width="12" height="28" rx="3" fill="#fff" stroke={stroke} strokeWidth="2"/>
          <Path d="M40 50 L40 62 L36 58 L44 58 Z" fill={stroke} />
          <Circle cx="40" cy="30" r="3" fill={stroke} />
        </>
      );
    case 'ladder' :
      return (
        <>
          <Line x1="28" y1="22" x2="28" y2="58" stroke={stroke} strokeWidth="3"/>
          <Line x1="52" y1="22" x2="52" y2="58" stroke={stroke} strokeWidth="3"/>
          {[30, 40, 50].map((y) => (
            <Line key={y} x1="28" y1={y} x2="52" y2={y} stroke={stroke} strokeWidth="2"/>
          ))}
        </>
      );
    default:
      return <Rect x="22" y="28" width="36" height="28" rx="4" fill="#fff" stroke={stroke} strokeWidth="2"/>;
  }
}

export default function InventoryThumb({ name, category = 'material', size = 46, imageUrl }) {
  if (imageUrl) {
    return (
      <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: '#f1f3f7' }}>
        <Image source={{ uri: imageUrl }} style={{ width: size, height: size }} resizeMode="cover" />
      </View>
    );
  }
  const key = getInventoryImageKey(name, category);
  const item = META[key] || META['default-material'];
  return (
    <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Rect width="80" height="80" rx="14" fill={item.bg} />
        <Shape shape={item.shape} stroke={item.stroke} />
        <SvgText
          x="40"
          y="74"
          textAnchor="middle"
          fontSize="8"
          fontWeight="700"
          fill={item.stroke}
        >
          {item.label}
        </SvgText>
      </Svg>
    </View>
  );
}
