/**
 * Апп даяарх `Switch`-ийг брэнд өнгөтэй нэгтгэнэ.
 *
 * ЯАГААД: 8 газар өөр өөр өнгө (ногоон хошуу, цайвар цэнхэр зам, саарал…)
 * гараар өгсөн тул нэг апп дотор асаах товч янз бүр харагддаг байв.
 * Энд нэг удаа: асаалттай зам — брэнд цэнхэр, хошуу — цагаан (iOS-ийн
 * жишиг), унтраалттай — горимд тохирсон саарал. Дуудагчийн `value`,
 * `onValueChange`, `disabled` зэрэг бусад prop хэвээр.
 *
 * index.js-д React mount хийхээс ӨМНӨ импортлох ёстой.
 */
import React from 'react';
import * as ReactNative from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { brand } from '../theme/tokens';

const OriginalSwitch = ReactNative.Switch;

function ThemedSwitch({ trackColor, thumbColor, ios_backgroundColor, ...props }) {
  const { isDark } = useTheme();
  const off = isDark ? '#334155' : '#cbd5e1';
  return React.createElement(OriginalSwitch, {
    ...props,
    trackColor: { false: off, true: isDark ? brand[400] : brand[500] },
    thumbColor: '#ffffff',
    ios_backgroundColor: off,
  });
}

let installed = false;
export function installThemedSwitch() {
  if (installed) return;
  installed = true;
  try {
    Object.defineProperty(ReactNative, 'Switch', { configurable: true, enumerable: true, get: () => ThemedSwitch });
  } catch (e) {
    // Export-ийг өөрчилж чадахгүй бол анхны Switch хэвээр — ажиллагаанд нөлөөгүй.
  }
}

installThemedSwitch();
