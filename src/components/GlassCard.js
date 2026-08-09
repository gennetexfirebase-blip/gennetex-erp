import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing } from '../theme';

// Glassmorphism карт — DESIGN.md Level 2 (translucent + blur + light rim)
export default function GlassCard({
  children,
  style,
  intensity = 24,
  glow = false,
  padded = true,
  radiusSize = radius.lg,
}) {
  const { colors, isDark, shadow } = useTheme();

  const inner = (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: radiusSize,
          backgroundColor: colors.glassBg,
          overflow: 'hidden',
        },
        padded && { padding: spacing.lg },
        glow && shadow.glow,
        !glow && shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );

  // BlurView зөвхөн iOS/Android дээр сайн ажиллана; тохиромжгүй үед solid fallback
  if (Platform.OS === 'web') return inner;

  return (
    <View style={[{ borderRadius: radiusSize, overflow: 'hidden' }, glow && shadow.glow, !glow && shadow.sm, style]}>
      <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={[
          {
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: radiusSize,
            backgroundColor: colors.glassBg,
          },
          padded && { padding: spacing.lg },
        ]}
      >
        {children}
      </View>
    </View>
  );
}
