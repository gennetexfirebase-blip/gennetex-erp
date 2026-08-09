import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { radius, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';

export function Card({ children, style, elevated = true, borderless = false }) {
  const { colors, shadow } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: borderless ? 'transparent' : colors.border,
        },
        elevated && shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  style,
  disabled,
}) {
  const { colors, gradients, shadow } = useTheme();
  const GRADIENT_MAP = {
    primary: gradients.primary,
    success: gradients.success,
    danger: gradients.danger,
    warning: gradients.warning,
  };
  const grad = GRADIENT_MAP[variant];
  const sizeStyle = size === 'sm' ? styles.btnSm : size === 'lg' ? styles.btnLg : styles.btnMd;
  const textSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  // Градиент товч дээр контраст текст; ghost дээр primary
  const fg = grad && !disabled ? colors.onPrimaryContainer : disabled ? colors.textFaint : colors.primary;

  const content = (
    <View style={styles.btnRow}>
      {icon ? <Text style={[styles.btnIcon, { fontSize: textSize + 1, color: fg }]}>{icon}</Text> : null}
      <Text style={[styles.btnText, { fontSize: textSize, color: fg }]}>{title}</Text>
    </View>
  );

  if (grad && !disabled) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[style]}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, sizeStyle, shadow.glow]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        sizeStyle,
        { backgroundColor: disabled ? colors.surfaceAlt : colors.surfaceContainerHigh },
        variant === 'ghost' && {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        style,
      ]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={0.85}
    >
      {content}
    </TouchableOpacity>
  );
}

export function Field({ label, style, variant, labelStyle, inputStyle, ...props }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }, labelStyle]}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: focused ? colors.primaryContainer : colors.outlineVariant,
            color: colors.text,
          },
          focused && { borderWidth: 1.5 },
          inputStyle,
        ]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

export function Badge({ text, color }) {
  const { colors } = useTheme();
  const c = color || colors.primaryContainer;
  return (
    <View style={[styles.badge, { backgroundColor: c + '22', borderColor: c + '66' }]}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.badgeText, { color: c }]}>{text}</Text>
    </View>
  );
}

// Blur толгой — Synthetic Horizon
export function ScreenHeader({ title, subtitle, right, icon, back, onBackPress }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const showBack = back === undefined ? navigation.canGoBack() : back;
  const handleBack = () => {
    if (onBackPress) onBackPress();
    else navigation.goBack();
  };
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surfaceDim, borderBottomColor: colors.outlineVariant + '55' },
      ]}
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <View style={[styles.headerLeft, { flex: 1, minWidth: 0 }]}>
            {showBack ? (
              <TouchableOpacity
                style={[styles.backBtn, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}
                onPress={handleBack}
                hitSlop={8}
              >
                <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
              </TouchableOpacity>
            ) : icon ? (
              <Text style={styles.headerIcon}>{icon}</Text>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          {right ? <View style={styles.headerRight}>{right}</View> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

export function StatCard({ label, value, color, icon }) {
  const { colors, shadow } = useTheme();
  const c = color || colors.primaryContainer;
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow.sm,
      ]}
    >
      {icon ? <Text style={styles.statIcon}>{icon}</Text> : null}
      <Text style={[styles.statValue, { color: c }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children, style }) {
  const { colors } = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.text }, style]}>{children}</Text>;
}

export function EmptyState({ text }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.emptyIconDot, { color: colors.textFaint }]}>·</Text>
      </View>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

export function HeaderButton({ title, icon, onPress }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.headerBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primaryContainer + '40' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon ? <Text style={[styles.headerBtnIcon, { color: colors.primary }]}>{icon}</Text> : null}
      {title ? <Text style={[styles.headerBtnText, { color: colors.primary }]}>{title}</Text> : null}
    </TouchableOpacity>
  );
}

export function formatMNT(value) {
  const n = Math.round(Number(value) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '₮';
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  btnMd: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  btnLg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnIcon: {},
  btnText: { fontWeight: '700' },
  label: {
    marginBottom: spacing.xs,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    fontSize: 15,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerRight: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs, maxWidth: '58%' },
  headerIcon: { fontSize: 30 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  backIcon: { fontSize: 28, fontWeight: '800', marginTop: -4 },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 12, marginTop: 2 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyIconDot: { fontSize: 36, lineHeight: 40, fontWeight: '300' },
  emptyText: { textAlign: 'center', fontSize: 14 },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  headerBtnIcon: { fontSize: 15 },
  headerBtnText: { fontWeight: '700', fontSize: 14 },
});
