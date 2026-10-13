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

const OriginalSwitch = ReactNative.Switch;

function ThemedSwitch({ trackColor, thumbColor, ios_backgroundColor, ...props }) {
  // Дизайн (.tgl): асаалттай = ok ногоон, унтраалттай = line.
  const { colors } = useTheme();
  const off = colors.line;
  return React.createElement(OriginalSwitch, {
    ...props,
    trackColor: { false: off, true: colors.ok },
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
