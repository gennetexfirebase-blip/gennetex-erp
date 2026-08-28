import React from 'react';
import { Image } from 'react-native';

/**
 * Microsoft Excel-ийн албан ёсны тэмдэг.
 *
 * Excel-тэй холбоотой БҮХ товч, толгой энэ компонентыг ашиглана —
 * ингэснээр лого нэг эх сурвалжтай болж, солиход нэг л газар засна
 * (өмнө нь зарим газар `document-text` дүрс, зарим нь 📗 emoji байв).
 *
 * Эх зураг 500×514 тул өндөр нь өргөнөөс арай их — харьцааг хадгална.
 */
const SRC = require('../../assets/excel-icon.png');
const RATIO = 514 / 500;

export default function ExcelIcon({ size = 20, style }) {
  return (
    <Image
      source={SRC}
      style={[{ width: size, height: Math.round(size * RATIO) }, style]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
