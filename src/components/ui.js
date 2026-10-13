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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { radius, spacing, touch, type } from '../theme';
import { useTheme } from '../context/ThemeContext';

export function Card({ children, style, elevated = true, borderless = false }) {
  const { colors, shadow } = useTheme();
  // Дизайн: `card` дэвсгэр, radius 20, padding 16, маш бага сүүдэр, хүрээгүй.
  void borderless;
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.card,
          padding: spacing.lg,
          marginBottom: spacing.md,
        },
        elevated && shadow.md,
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
  const { colors } = useTheme();
  // Дизайн: градиентгүй, нэг өнгөт дүүргэлт. Үндсэн = brand, аюултай = bad.
  const FILL = {
    primary: [colors.brand, colors.brandInk],
    success: [colors.ok, '#FFFFFF'],
    danger: [colors.bad, '#FFFFFF'],
    warning: [colors.warn, '#FFFFFF'],
  };
  const fill = FILL[variant];
  const inert = disabled || loading;
  const sizeStyle = size === 'sm' ? styles.btnSm : size === 'lg' ? styles.btnLg : styles.btnMd;
  const textSize = size === 'sm' ? 14 : size === 'lg' ? 17 : 16;
  const fg = fill && !inert ? fill[1] : disabled ? colors.faint : variant === 'ghost' ? colors.ink : colors.ink;

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

  if (fill && !inert) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.btn, sizeStyle, { backgroundColor: fill[0] }, style, pressed && styles.pressed]}
        {...a11y}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        sizeStyle,
        { backgroundColor: colors.field },
        variant === 'ghost' && {
          backgroundColor: colors.card,
          borderWidth: 1.5,
          borderColor: colors.line,
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
  onFocus,
  onBlur,
  ...props
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  // ⚠️ Дуудагчид олон мөрт талбарт `style={{ minHeight, textAlignVertical }}`
  //    өгдөг. Тэр нь гаднах хайрцагт очиж, оролтын хүрээ богино хэвээр,
  //    доор нь хоосон зай үлддэг байв. Оролтын хэмжээтэй холбоотой
  //    утгуудыг оролт руу шилжүүлнэ.
  const { minHeight: wantedHeight, textAlignVertical, ...wrapStyle } = StyleSheet.flatten(style) || {};
  const multilineStyle = props.multiline
    ? { minHeight: wantedHeight || 110, textAlignVertical: textAlignVertical || 'top', paddingTop: spacing.md }
    : wantedHeight
      ? { minHeight: wantedHeight }
      : null;
  // Дизайн: `field` дэвсгэр, хүрээгүй; фокуст `ink` хүрээ + `bg` дэвсгэр.
  const borderColor = error ? colors.bad : focused ? colors.ink : 'transparent';
  return (
    <View style={[{ marginBottom: spacing.md }, wrapStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.ink }, labelStyle]}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        style={[
          styles.input,
          {
            backgroundColor: focused ? colors.bg : colors.field,
            borderColor,
            color: colors.ink,
          },
          multilineStyle,
          inputStyle,
        ]}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        {...props}
      />
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.fieldMsg, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.fieldMsg, { color: colors.textFaint }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Badge({ text, color }) {
  const { colors } = useTheme();
  const c = color || colors.brand;
  return (
    <View style={[styles.badge, { backgroundColor: softOf(c, colors), borderColor: 'transparent' }]}>
      <Text style={[styles.badgeText, { color: c }]}>{text}</Text>
    </View>
  );
}

/** Семантик өнгөнд тохирох зөөлөн дэвсгэр (chip). Бусад өнгөнд 12%. */
function softOf(c, colors) {
  if (c === colors.brand) return colors.brandSoft;
  if (c === colors.ok) return colors.okSoft;
  if (c === colors.warn) return colors.warnSoft;
  if (c === colors.bad) return colors.badSoft;
  if (c === colors.ai) return colors.aiSoft;
  if (c === colors.muted || c === colors.textMuted || c === colors.textFaint) return colors.field;
  return typeof c === 'string' && c.length === 7 ? c + '1f' : colors.field;
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
        { backgroundColor: colors.ground, borderBottomColor: 'transparent' },
      ]}
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {showBack ? (
              <Pressable
                style={({ pressed }) => [
                  styles.backBtn,
                  { backgroundColor: colors.bg, borderColor: colors.line },
                  pressed && styles.pressed,
                ]}
                onPress={handleBack}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Буцах"
              >
                <Ionicons name="chevron-back" size={20} color={colors.ink} />
              </Pressable>
            ) : icon ? (
              <Text style={styles.headerIcon}>{icon}</Text>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[styles.headerTitle, { color: colors.ink }]}
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
  // Дизайн (KpiTile): том тоо + шошго. Тоо нь `ink`; семантик өнгө өгсөн
  // үед (ok/warn/bad) тэр өнгөөр.
  const semantic = color && color !== colors.primary && color !== colors.accent;
  const c = semantic ? color : colors.ink;
  return (
    <View
      style={[styles.statCard, { backgroundColor: colors.card }, shadow.md]}
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

export function EmptyState({ text, title, subtitle, icon = 'file-tray-outline', action, actionLabel }) {
  const { colors } = useTheme();
  // Хуучин дуудлагууд '·' эсвэл emoji дамжуулдаг — Ionicons нэр бол дүрс,
  // эс бөгөөс тэмдэгтийг хэвээр зурна.
  const iconName = icon === '·' ? 'file-tray-outline' : GLYPH_ICONS[icon] || (Ionicons.glyphMap?.[icon] ? icon : null);
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: colors.brandSoft }]}>
        {iconName ? (
          <Ionicons name={iconName} size={36} color={colors.brand} />
        ) : (
          <Text style={[styles.emptyIcon, { color: colors.brand }]}>{icon}</Text>
        )}
      </View>
      {/* Гарчиггүй дуудлагад ч дизайн «icon + гарчиг + тайлбар» хэлбэрийг барина. */}
      {!title && (text || subtitle) ? (
        <Text style={[styles.emptyTitle, { color: colors.ink }]}>{text || subtitle}</Text>
      ) : null}
      {/* Зарим дэлгэц `title`/`subtitle` дамжуулдаг — өмнө нь хоосон гардаг байв. */}
      {title ? <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text> : null}
      {title && (text || subtitle) ? <Text style={[styles.emptyText, { color: colors.muted }]}>{text || subtitle}</Text> : null}
      {action && actionLabel ? (
        <Button title={actionLabel} onPress={action} size="sm" style={{ marginTop: spacing.lg, borderRadius: radius.pill }} />
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
        // Дизайн: pill товч — brand дэвсгэр, цагаан бичиг.
        { backgroundColor: colors.brand, borderColor: colors.brand },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title || 'Товч'}
    >
      {icon ? (
        icon === '+' ? (
          <Ionicons name="add" size={18} color={colors.brandInk} />
        ) : Ionicons.glyphMap?.[icon] ? (
          <Ionicons name={icon} size={17} color={colors.brandInk} />
        ) : (
          <Text style={[styles.headerBtnIcon, { color: colors.brandInk }]}>{icon}</Text>
        )
      ) : null}
      {title ? <Text style={[styles.headerBtnText, { color: colors.brandInk }]}>{title}</Text> : null}
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
  const { colors, shadow } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.card,
          paddingVertical: 4,
        },
        shadow.md,
        style,
      ]}
    >
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? (
            <View style={[styles.divider, { backgroundColor: colors.line }]} />
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
// Хуучин дэлгэцүүд дүрсийг Unicode тэмдэгтээр (◧ ▣ ✆ …) дамжуулдаг —
// фонтоос хамаарч янз бүр харагдаж, гар хийцийн биш мэт санагддаг.
// Тэдгээрийг нэгдсэн Ionicons дүрс рүү хөрвүүлнэ.
const GLYPH_ICONS = {
  '◧': 'person-outline', '▣': 'briefcase-outline', '✆': 'call-outline', '◆': 'shield-checkmark-outline',
  '✎': 'create-outline', '◉': 'car-outline', '▤': 'document-text-outline', '🔔': 'notifications-outline',
  '📨': 'mail-unread-outline', '📞': 'call-outline', '📍': 'location-outline', '▦': 'grid-outline',
  '✉': 'mail-outline', '➤': 'send-outline', '▼': 'download-outline', '↗': 'open-outline',
  '⏻': 'log-out-outline', '📥': 'download-outline', '🔧': 'hammer-outline', '🧤': 'shirt-outline', '☀': 'sunny-outline', '☾': 'moon-outline', '⚙': 'settings-outline',
};

function RowIcon({ icon, color }) {
  const name = GLYPH_ICONS[icon] || (Ionicons.glyphMap && Ionicons.glyphMap[icon] ? icon : null);
  if (name) return <Ionicons name={name} size={20} color={color} />;
  return <Text style={[styles.rowIconText, { color }]}>{icon}</Text>;
}

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
  // Дизайн (Профайлын .set мөр): icon хавтан нь `field` дэвсгэр + `ink`;
  // өнгө өгсөн бол тэр өнгөөр, аюултай бол `bad`.
  const tint = danger ? colors.bad : accentColor || colors.ink;
  const tileBg = danger ? colors.badSoft : accentColor ? softOf(accentColor, colors) : colors.field;
  const labelColor = disabled ? colors.faint : danger ? colors.bad : colors.ink;

  const body = (
    <View style={styles.rowInner}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: tileBg }]}>
          <RowIcon icon={icon} color={tint} />
        </View>
      ) : null}
      <Text style={[styles.rowLabel, { color: labelColor }]} numberOfLines={2}>
        {label}
      </Text>
      {value != null ? (
        <Text style={[styles.rowValue, { color: colors.textMuted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && chevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
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
    success: [colors.ok, colors.okSoft],
    warning: [colors.warn, colors.warnSoft],
    danger: [colors.bad, colors.badSoft],
    info: [colors.brand, colors.brandSoft],
    ai: [colors.ai, colors.aiSoft],
    neutral: [colors.muted, colors.field],
  };
  const [c, bg] = TONES[tone] || TONES.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
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
        // Дизайн (FilterChips): идэвхтэй нь `ink` дэвсгэр.
        {
          backgroundColor: active ? colors.ink : colors.card,
          borderColor: active ? colors.ink : colors.line,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text
        style={[styles.chipText, { color: active ? colors.bg : colors.ink }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={active ? colors.bg : colors.muted} />
    </Pressable>
  );
}

/** Доогуур зураастай таб. Ж: Илгээсэн | Хүлээн авсан */
export function SegmentTabs({ tabs, value, onChange }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segWrap, { borderBottomColor: colors.line }]}>
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
              style={[styles.segText, { color: on ? colors.ink : colors.muted }]}
              numberOfLines={1}
            >
              {label}
            </Text>
            <View
              style={[
                styles.segBar,
                { backgroundColor: on ? colors.brand : 'transparent' },
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
        { backgroundColor: colors.bg, borderTopColor: colors.line },
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
  // Дизайн: градиент толгой байхгүй — `ground` дэвсгэр.
  const { colors } = useTheme();
  return (
    <View
      style={[{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.ground }, height && { height }, style]}
    >
      <SafeAreaView edges={['top']}>{children}</SafeAreaView>
    </View>
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
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSm: {
    minHeight: touch.compact,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  btnMd: {
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  btnLg: {
    minHeight: 56,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnIcon: {},
  btnText: { fontWeight: '600' },
  label: {
    marginBottom: spacing.xs,
    ...type.label,
  },
  input: {
    minHeight: 54,
    borderRadius: radius.input,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    fontSize: 16,
  },
  fieldMsg: { marginTop: 5, fontSize: 12, fontWeight: '500' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 12,
    borderWidth: 0,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0,
  },
  // Гарчиг дор хаяж ~200pt авна; үйлдлийн товчнууд багтахгүй бол
  // гарчигтай давхцахын оронд ДООШОО шинэ мөрөнд буулгана.
  // Prototype .subhead: буцах · гарчиг (2 мөр хүртэл) · баруун товчнууд нэг мөрөнд.
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    gap: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 0 },
  headerRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerIcon: { fontSize: 30 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  backIcon: { fontSize: 28, fontWeight: '800', marginTop: -4 },
  headerTitle: { fontSize: 21, lineHeight: 25, fontWeight: '700', letterSpacing: -0.4 },
  headerSub: { ...type.caption, fontSize: 13, marginTop: 2 },
  statCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  statAccent: { position: 'absolute', top: 0, left: '30%', right: '30%', height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  sectionTitle: {
    ...type.h3,
    marginBottom: spacing.md,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyIcon: { fontSize: 32, lineHeight: 38, fontWeight: '600' },
  emptyTitle: { textAlign: 'center', fontSize: 18, fontWeight: '700', marginBottom: 6, paddingHorizontal: spacing.xl },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 20, paddingHorizontal: spacing.xl },
  headerBtn: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  headerBtnIcon: { fontSize: 15 },
  headerBtnText: { fontWeight: '700', fontSize: 14 },

  // --- Жагсаалтын хэв маяг ---
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
  },
  divider: { height: 1 },
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
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: { fontSize: 15 },
  rowLabel: { ...type.bodyStrong, flex: 1, minWidth: 0 },
  rowValue: { fontSize: 14, flexShrink: 1, textAlign: 'right' },
  rowChevron: { fontSize: 22, fontWeight: '600', marginLeft: 2 },

  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    height: 24,
    justifyContent: 'center',
    borderRadius: 12,
  },
  pillText: { fontSize: 12, fontWeight: '700' },

  chip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  chipCaret: { fontSize: 12, marginTop: -3 },

  segWrap: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  segItem: { flex: 1, alignItems: 'center', paddingTop: spacing.md, gap: spacing.sm },
  segText: { fontSize: 14, fontWeight: '600' },
  segBar: { height: 3, alignSelf: 'stretch', marginHorizontal: '18%', borderRadius: 3 },

  bottomBar: { borderTopWidth: StyleSheet.hairlineWidth },
  bottomBarRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
});
