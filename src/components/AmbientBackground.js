import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Cyan / violet радиал гэрэлтэлт — DESIGN.md ambient glow (зөвхөн чимэглэл)
export default function AmbientBackground() {
  const { colors, isDark } = useTheme();
  if (!isDark) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          top: -120,
          left: -120,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: colors.primaryContainer,
          opacity: 0.06,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -140,
          right: -120,
          width: 340,
          height: 340,
          borderRadius: 170,
          backgroundColor: colors.secondaryContainer,
          opacity: 0.06,
        }}
      />
    </View>
  );
}
