/**
 * Апп даяарх үсгийн фонт — дизайн (DESIGN_HANDOFF §2): iOS дээр системийн
 * SF Pro, бусад дээр **Golos Text**.
 *
 * Android дээр custom фонтод `fontWeight` ажилладаггүй (жин бүр тусдаа файл),
 * тиймээс `fontFamily` өгөөгүй Text/TextInput бүрт жингээс нь хамааруулж
 * GolosText_400Regular … 700Bold-ийг сонгоно. Вэб дээр Google Fonts-оос
 * ачаалж CSS жинг шууд ашиглана. Лого бичиг (Fredoka) зэрэг тусгайлан
 * fontFamily өгсөн текстэд хүрэхгүй.
 *
 * index.js-д React mount хийхээс ӨМНӨ импортлох ёстой.
 */
import React from 'react';
import * as ReactNative from 'react-native';

const { Platform, StyleSheet } = ReactNative;

const ANDROID_BY_WEIGHT = {
  100: 'GolosText_400Regular', 200: 'GolosText_400Regular', 300: 'GolosText_400Regular',
  400: 'GolosText_400Regular', normal: 'GolosText_400Regular',
  500: 'GolosText_500Medium',
  600: 'GolosText_600SemiBold',
  700: 'GolosText_700Bold', bold: 'GolosText_700Bold', 800: 'GolosText_700Bold', 900: 'GolosText_700Bold',
};

function withFont(style) {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) return style;
  if (Platform.OS === 'android') {
    const family = ANDROID_BY_WEIGHT[String(flat.fontWeight || '400')] || ANDROID_BY_WEIGHT[400];
    // Жинг файл өөрөө илэрхийлнэ — давхар bold болохоос сэргийлж normal.
    return [style, { fontFamily: family, fontWeight: 'normal' }];
  }
  return [{ fontFamily: '"Golos Text", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }, style];
}

function wrap(Original) {
  const Wrapped = React.forwardRef(function GolosText(props, ref) {
    return React.createElement(Original, { ...props, ref, style: withFont(props.style) });
  });
  Wrapped.displayName = Original.displayName || 'Text';
  // TextInput.State г.м статик гишүүд хэвээр байх ёстой.
  Object.getOwnPropertyNames(Original).forEach((key) => {
    if (!(key in Wrapped)) {
      try { Wrapped[key] = Original[key]; } catch (e) { /* read-only */ }
    }
  });
  return Wrapped;
}

function loadWebFonts() {
  if (typeof document === 'undefined' || document.getElementById('gx-fonts')) return;
  const link = document.createElement('link');
  link.id = 'gx-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=Fredoka:wght@400..600&display=swap';
  document.head.appendChild(link);
}

let installed = false;
export function installThemedText() {
  if (installed || Platform.OS === 'ios') return;
  installed = true;
  if (Platform.OS === 'web') loadWebFonts();
  try {
    const Text = wrap(ReactNative.Text);
    const TextInput = wrap(ReactNative.TextInput);
    // eslint-disable-next-line no-import-assign
    Object.defineProperty(ReactNative, 'Text', { configurable: true, enumerable: true, get: () => Text });
    // eslint-disable-next-line no-import-assign
    Object.defineProperty(ReactNative, 'TextInput', { configurable: true, enumerable: true, get: () => TextInput });
  } catch (e) {
    // Солиж чадахгүй бол системийн фонт хэвээр — ажиллагаанд нөлөөгүй.
  }
}

installThemedText();
