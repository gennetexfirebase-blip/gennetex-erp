import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { radius, spacing, touch, type } from '../theme';
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
  loading = false,
  accessibilityLabel,
}) {
  const { colors, gradients, shadow } = useTheme();
  const GRADIENT_MAP = {
    primary: gradients.primary,
    success: gradients.success,
    danger: gradients.danger,
    warning: gradients.warning,
  };
  const grad = GRADIENT_MAP[variant];
  const inert = disabled || loading;
  const sizeStyle = size === 'sm' ? styles.btnSm : size === 'lg' ? styles.btnLg : styles.btnMd;
  const textSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  // Градиент товч дээр контраст текст; ghost дээр primary
  const fg = grad && !inert ? colors.onPrimaryContainer : disabled ? colors.textFaint : colors.primary;

  const content = (
    <View style={styles.btnRow}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Text style={[styles.btnIcon, { fontSize: textSize + 1, color: fg }]}>{icon}</Text>
      ) : null}
      <Text style={[styles.btnText, { fontSize: textSize, color: fg }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );

  const a11y = {
    accessibilityRole: 'button',
    accessibilityLabel: accessibilityLabel || title,
    accessibilityState: { disabled: !!inert, busy: !!loading },
  };

  if (grad && !inert) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [style, pressed && styles.pressed]}
        {...a11y}
      >
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, sizeStyle, shadow.glow]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        sizeStyle,
        { backgroundColor: inert ? colors.surfaceAlt : colors.surfaceContainerHigh },
        variant === 'ghost' && {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        style,
        pressed && !inert && styles.pressed,
      ]}
      onPress={inert ? undefined : onPress}
      {...a11y}
    >
      {content}
    </Pressable>
  );
}

export function Field({
  label,
  style,
  variant,
  labelStyle,
  inputStyle,
  error,
  hint,
  required,
  ...props
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primaryContainer
      : colors.outlineVariant;
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }, labelStyle]}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={label}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor,
            color: colors.text,
          },
          focused && { borderWidth: 1.5 },
          inputStyle,
        ]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {error ? (
        <Text style={[styles.fieldMsg, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.fieldMsg, { color: colors.textFaint }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Badge({ text, color }) {
  const { colors } = useTheme();
  const c = color || colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: c + '22', borderColor: c + '66' }]}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.badgeText, { color: c }]}>{text}</Text>
    </View>
  );
}

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
        { backgroundColor: colors.surfaceDim, borderBottomColor: colors.outlineVariant },
      ]}
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <View style={[styles.headerLeft, { flex: 1, minWidth: 0 }]}>
            {showBack ? (
              <Pressable
                style={({ pressed }) => [
                  styles.backBtn,
                  {
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: colors.outlineVariant,
                  },
                  pressed && styles.pressed,
                ]}
                onPress={handleBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Буцах"
              >
                <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
              </Pressable>
            ) : icon ? (
              <Text style={styles.headerIcon}>{icon}</Text>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[styles.headerTitle, { color: colors.onSurface }]}
                numberOfLines={2}
                accessibilityRole="header"
              >
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
  const c = color || colors.primary;
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow.sm,
      ]}
      accessibilityLabel={`${label}: ${value}`}
    >
      {icon ? <Text style={styles.statIcon}>{icon}</Text> : null}
      <Text style={[styles.statValue, { color: c }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({ children, style }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: colors.text }, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function EmptyState({ text, icon = '·', action, actionLabel }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.emptyIcon, { color: colors.textFaint }]}>{icon}</Text>
      </View>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{text}</Text>
      {action && actionLabel ? (
        <Button title={actionLabel} onPress={action} size="sm" style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  );
}

/** Ачаалж буйг илэрхийлэх төлөв — хоосон дэлгэцийн оронд. */
export function LoadingState({ text = 'Ачаалж байна…' }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty} accessibilityLabel={text}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: spacing.md }]}>
        {text}
      </Text>
    </View>
  );
}

/** Алдааны төлөв — дахин оролдох боломжтой. */
export function ErrorState({ text = 'Алдаа гарлаа', onRetry, retryLabel = 'Дахин оролдох' }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: colors.danger + '1f' }]}>
        <Text style={[styles.emptyIcon, { color: colors.danger, fontSize: 26 }]}>!</Text>
      </View>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{text}</Text>
      {onRetry ? (
        <Button
          title={retryLabel}
          onPress={onRetry}
          variant="ghost"
          size="sm"
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </View>
  );
}

/** Контентын хэлбэрийг барих гялалзсан хайрцаг — spinner-ээс тайван. */
export function Skeleton({ width = '100%', height = 16, style, rounded = radius.sm }) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: rounded,
          backgroundColor: colors.surfaceContainerHigh,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
        },
        style,
      ]}
    />
  );
}

/** Жагсаалт ачаалж байх үеийн skeleton мөрүүд. */
export function SkeletonList({ count = 4 }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Skeleton width={40} height={40} rounded={20} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton width="65%" height={13} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function HeaderButton({ title, icon, onPress, accessibilityLabel }) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.headerBtn,
        { backgroundColor: colors.primarySoft, borderColor: colors.primary + '40' },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title || 'Товч'}
    >
      {icon ? <Text style={[styles.headerBtnIcon, { color: colors.primary }]}>{icon}</Text> : null}
      {title ? <Text style={[styles.headerBtnText, { color: colors.primary }]}>{title}</Text> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Жагсаалтын хэв маяг — цэсний мөр, бүлэг, шошго
// ---------------------------------------------------------------------------

/** Бүлгийн дээрх жижиг саарал гарчиг. Ж: "БАЙГУУЛЛАГЫН ДОТООД ЦЭС" */
export function GroupLabel({ children, style }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.groupLabel, { color: colors.textFaint }, style]}>{children}</Text>
  );
}

/**
 * Дугуйрсан карт дотор мөрүүдийг багцлана — мөр хооронд нимгэн зураас.
 * Тусад нь `divider` зурах шаардлагагүй, өөрөө хийнэ.
 */
export function ListGroup({ children, style }) {
  const { colors } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? (
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
          ) : null}
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * Цэсний нэг мөр: [дүрс] Гарчиг ......... утга ›
 * `onPress` өгвөл дарж болно, эс бөгөөс зөвхөн харуулна.
 */
export function ListRow({
  icon,
  label,
  value,
  onPress,
  accent: accentColor,
  danger,
  disabled,
  right,
  chevron = true,
}) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : accentColor || colors.primary;
  const labelColor = disabled ? colors.textFaint : danger ? colors.danger : colors.text;

  const body = (
    <View style={styles.rowInner}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: tint + '16' }]}>
          <Text style={[styles.rowIconText, { color: tint }]}>{icon}</Text>
        </View>
      ) : null}
      <Text style={[styles.rowLabel, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
      {value != null ? (
        <Text style={[styles.rowValue, { color: colors.textMuted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && chevron ? (
        <Text style={[styles.rowChevron, { color: colors.textFaint }]}>›</Text>
      ) : null}
    </View>
  );

  if (!onPress || disabled) return <View style={styles.row}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      {body}
    </Pressable>
  );
}

/** Төлөвийн жижиг шошго. Ж: Зөвшөөрсөн · Хүлээгдэж буй · Татгалзсан */
export function StatusPill({ text, tone = 'neutral' }) {
  const { colors } = useTheme();
  const TONES = {
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.primary,
    neutral: colors.textMuted,
  };
  const c = TONES[tone] || TONES.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: c + '1a' }]}>
      <Text style={[styles.pillText, { color: c }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** Шүүлтүүрийн товч. Ж: "Бүх төлөв ▾" */
export function FilterChip({ label, active, onPress }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.primarySoft : 'transparent',
          borderColor: active ? colors.primary : colors.outlineVariant,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text
        style={[styles.chipText, { color: active ? colors.primary : colors.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[styles.chipCaret, { color: active ? colors.primary : colors.textFaint }]}>
        ⌄
      </Text>
    </Pressable>
  );
}

/** Доогуур зураастай таб. Ж: Илгээсэн | Хүлээн авсан */
export function SegmentTabs({ tabs, value, onChange }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segWrap, { borderBottomColor: colors.outlineVariant }]}>
      {tabs.map((t) => {
        const key = t.key ?? t;
        const label = t.label ?? t;
        const on = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={styles.segItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text
              style={[styles.segText, { color: on ? colors.primary : colors.textMuted }]}
              numberOfLines={1}
            >
              {label}
            </Text>
            <View
              style={[
                styles.segBar,
                { backgroundColor: on ? colors.primary : 'transparent' },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Дэлгэцийн доод талд наалдсан үйлдлийн зурвас. */
export function BottomBar({ children, style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.bottomBar,
        { backgroundColor: colors.surface, borderTopColor: colors.outlineVariant },
        style,
      ]}
    >
      <SafeAreaView edges={['bottom']}>
        <View style={styles.bottomBarRow}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Брэнд өнгөт толгой хэсэг — дээр нь өнгөт талбар, доор нь цагаан контент.
 * Профайл / Нэвтрэх дэлгэцэд ашиглана.
 */
export function BrandHeader({ children, height, style }) {
  const { gradients } = useTheme();
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }, height && { height }, style]}
    >
      <SafeAreaView edges={['top']}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

export function formatMNT(value) {
  const n = Math.round(Number(value) || 0);
  // Сөрөг тоонд хасах тэмдэг оронгийн тусгаарлагчид баригдахаас сэргийлнэ.
  const sign = n < 0 ? '-' : '';
  return (
    sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '₮'
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  btn: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSm: {
    minHeight: touch.compact,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  btnMd: {
    minHeight: touch.min,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  btnLg: {
    minHeight: 52,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnIcon: {},
  btnText: { fontWeight: '700' },
  label: {
    marginBottom: spacing.xs,
    ...type.label,
  },
  input: {
    minHeight: touch.min,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    fontSize: 15,
  },
  fieldMsg: { marginTop: 5, fontSize: 12, fontWeight: '500' },
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerRight: {
    flexShrink: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    maxWidth: '58%',
  },
  headerIcon: { fontSize: 30 },
  backBtn: {
    width: touch.icon,
    height: touch.icon,
    borderRadius: touch.icon / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  backIcon: { fontSize: 28, fontWeight: '800', marginTop: -4 },
  headerTitle: { ...type.h2, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { ...type.caption, fontSize: 13, marginTop: 2 },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 12, marginTop: 2, textAlign: 'center' },
  sectionTitle: {
    ...type.h3,
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
  emptyIcon: { fontSize: 32, lineHeight: 38, fontWeight: '600' },
  emptyText: { textAlign: 'center', fontSize: 14, paddingHorizontal: spacing.xl },
  headerBtn: {
    minHeight: touch.compact,
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

  // --- Жагсаалтын хэв маяг ---
  groupLabel: {
    ...type.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  row: { minHeight: touch.min + 8 },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touch.min + 8,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: { fontSize: 15 },
  rowLabel: { ...type.body, flex: 1, minWidth: 0 },
  rowValue: { ...type.caption, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  rowChevron: { fontSize: 22, fontWeight: '600', marginLeft: 2 },

  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  pillText: { fontSize: 11, fontWeight: '700' },

  chip: {
    minHeight: touch.compact,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipCaret: { fontSize: 12, marginTop: -3 },

  segWrap: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  segItem: { flex: 1, alignItems: 'center', paddingTop: spacing.md, gap: spacing.sm },
  segText: { fontSize: 14, fontWeight: '700' },
  segBar: { height: 2, alignSelf: 'stretch', borderRadius: 1 },

  bottomBar: { borderTopWidth: StyleSheet.hairlineWidth },
  bottomBarRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
});
