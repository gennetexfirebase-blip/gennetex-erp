/**
 * Gennetex дизайн системийн нийтлэг компонентууд (design/DESIGN_HANDOFF.md §3).
 *
 * ModuleTile · Wordmark · Chip · Segmented · FilterChips · SectionHeader ·
 * Box · StatGrid · IconRow · RoundButton · Avatar · PillButton
 *
 * Бүх өнгө `useTheme()`-ийн токеноос — хатуу бичсэн өнгө байхгүй.
 */
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import PERSON_AVATARS from '../theme/personAvatars';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme';
import { toneOf, accent } from '../theme/accents';
import PH from '../theme/phosphorDuotone';
import { sanitizeAvatarUrl } from '../lib/avatarUrl';

/** `#RRGGBB` + 0..1 → `#RRGGBBAA` */
export function alpha(hex, a) {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length !== 7) return hex;
  return hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
}

/** `a`-г `b` дээр `t` хувиар холино (color-mix). */
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Phosphor duotone icon
// ---------------------------------------------------------------------------

/** Phosphor duotone дүрс. `duo` — бүдэг хэсгийн өнгө (анхдагч: `color`). */
export function PhIcon({ name, size = 24, color, duo, duoOpacity = 0.22 }) {
  const parts = PH[name];
  if (!parts) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      {parts.map((p, i) =>
        Array.isArray(p) ? (
          <Path key={i} d={p[0]} fill={duo || color} opacity={duoOpacity} />
        ) : (
          <Path key={i} d={p} fill={color} />
        )
      )}
    </Svg>
  );
}

/**
 * Модулийн icon хавтан.
 * Light: дэвсгэр = өнгө 11% (card дээр), icon = өнгө.
 * Dark: дэвсгэр = field, icon = ink, duotone = brand 32%.
 */
export function ModuleTile({ icon, tone = 'green', size = 54, radius, iconSize, style }) {
  const { colors, isDark } = useTheme();
  const c = toneOf(tone);
  const bg = isDark ? colors.field : mix(c, colors.card, 0.11);
  const fg = isDark ? colors.ink : c;
  const r = radius ?? Math.round(size * 0.315);
  const is = iconSize ?? Math.round(size * 0.48);
  return (
    <View style={[{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      {PH[icon] ? (
        <PhIcon name={icon} size={is} color={fg} duo={isDark ? colors.brand : fg} duoOpacity={isDark ? 0.32 : 0.22} />
      ) : (
        <Ionicons name={icon || 'apps-outline'} size={is} color={fg} />
      )}
    </View>
  );
}

/** Жагсаалтын мөрийн 36px өнгөт icon хавтан (Ionicons). */
export function RowIcon({ name, tone = 'blue', size = 36 }) {
  const { colors, isDark } = useTheme();
  const c = accent(tone, isDark);
  const bg = isDark ? alpha(c, 0.16) : mix(toneOf(tone), colors.card, 0.11);
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={Math.round(size * 0.53)} color={c} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Лого бичиг
// ---------------------------------------------------------------------------

/** "Gennetex" (Fredoka) + ногоон "ERP". */
export function Wordmark({ size = 22, sub, logo = true, logoSize = 38 }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wmRow}>
      {logo ? (
        <View style={[styles.wmLogo, { width: logoSize, height: logoSize, borderRadius: logoSize / 2, borderColor: colors.line }]}>
          <Image source={require('../../assets/logo-mark.png')} style={{ width: logoSize, height: logoSize }} resizeMode="cover" />
        </View>
      ) : null}
      <View>
        <Text style={[styles.wmText, { fontSize: size, color: colors.ink, fontFamily: fonts.wordmark }]} numberOfLines={1}>
          Gennetex<Text style={{ color: colors.brand }}> ERP</Text>
        </Text>
        {sub ? <Text style={[styles.wmSub, { color: colors.muted }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chip / товч
// ---------------------------------------------------------------------------

const CHIP_TONES = {
  blue: ['brandSoft', 'brand'],
  brand: ['brandSoft', 'brand'],
  ok: ['okSoft', 'ok'],
  warn: ['warnSoft', 'warn'],
  bad: ['badSoft', 'bad'],
  ai: ['aiSoft', 'ai'],
  muted: ['field', 'muted'],
};

/** 24px өндөр, 12px bold төлөвийн chip. */
export function Chip({ text, tone = 'muted', icon, style }) {
  const { colors } = useTheme();
  const [bgKey, fgKey] = CHIP_TONES[tone] || CHIP_TONES.muted;
  return (
    <View style={[styles.chip, { backgroundColor: colors[bgKey] }, style]}>
      {icon ? <Ionicons name={icon} size={13} color={colors[fgKey]} /> : null}
      <Text style={[styles.chipText, { color: colors[fgKey] }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** Дугуй 40px товч (1px хүрээтэй). Badge дэмжинэ. */
export function RoundButton({ icon, onPress, badge, size = 40, filled = false, accessibilityLabel, color }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: filled ? colors.field : colors.bg, borderColor: filled ? 'transparent' : colors.line },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color || colors.ink} />
      {badge ? <Badge value={badge} style={styles.roundBadge} /> : null}
    </Pressable>
  );
}

/** Улаан тоон badge. */
export function Badge({ value, style, tone = 'bad' }) {
  const { colors } = useTheme();
  const n = typeof value === 'number' && value > 99 ? '99+' : String(value);
  return (
    <View style={[styles.badge, { backgroundColor: tone === 'ink' ? colors.ink : tone === 'brand' ? colors.brand : colors.bad, borderColor: colors.bg }, style]}>
      <Text style={[styles.badgeText, { color: tone === 'ink' ? colors.bg : '#FFFFFF' }]}>{n}</Text>
    </View>
  );
}

/** Pill товч (36px). `soft` — brandSoft дэвсгэр. */
export function PillButton({ title, icon, onPress, soft = false, style }) {
  const { colors } = useTheme();
  const fg = soft ? colors.brand : colors.brandInk;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pill, { backgroundColor: soft ? colors.brandSoft : colors.brand }, pressed && { opacity: 0.75 }, style]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      {title ? <Text style={[styles.pillText, { color: fg }]}>{title}</Text> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Сонголт
// ---------------------------------------------------------------------------

/** `field` дэвсгэр дээр 2–3 сонголт, идэвхтэй нь цагаан карт. */
export function Segmented({ options, value, onChange, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: colors.field }, style]}>
      {options.map((o) => {
        const key = o.key ?? o;
        const on = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segBtn, on && [{ backgroundColor: colors.card }, styles.segOn]]}
          >
            <Text style={[styles.segText, { color: on ? colors.ink : colors.muted }]} numberOfLines={1}>
              {o.label ?? o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Хэвтээ гүйдэг 34px pill-үүд, тоотой. Идэвхтэй нь `ink` дэвсгэр. */
export function FilterChips({ items, value, onChange, style }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ flexGrow: 0 }, style]} contentContainerStyle={styles.fchips}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.fchip, { backgroundColor: on ? colors.ink : colors.card, borderColor: on ? colors.ink : colors.line }]}
          >
            {it.dot ? <View style={[styles.fdot, { backgroundColor: it.dot }]} /> : null}
            <Text style={[styles.fchipText, { color: on ? colors.bg : colors.ink }]}>{it.label}</Text>
            {it.count != null ? (
              <Text style={[styles.fchipCount, { color: on ? colors.bg : colors.muted, opacity: on ? 0.7 : 1 }]}>{it.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Байрлал
// ---------------------------------------------------------------------------

/** Хэсгийн гарчиг 20/700 + баруун талд холбоос/chip. */
export function SectionHeader({ title, chip, chipTone, action, onAction, right, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sec, style]}>
      <View style={styles.secLeft}>
        <Text style={[styles.secTitle, { color: colors.ink }]} accessibilityRole="header">
          {title}
        </Text>
        {chip != null ? <Chip text={String(chip)} tone={chipTone || 'muted'} /> : null}
      </View>
      {right}
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.secAction, { color: colors.brand }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Карт: `card` дэвсгэр, radius 20, маш бага сүүдэр. */
export function Box({ children, style, pad = false, onPress }) {
  const { colors, shadow } = useTheme();
  const st = [styles.box, { backgroundColor: colors.card }, shadow.md, pad && styles.pad, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [st, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={st}>{children}</View>;
}

/** Карт доторх тоон мөр (Өнөөдөр, KPI). Нүд бүрийн хооронд 1px шугам. */
export function StatGrid({ items, size = 24, style, topBorder = false }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statGrid, topBorder && { borderTopWidth: 1, borderTopColor: colors.line }, style]}>
      {items.map((it, i) => (
        <Pressable
          key={it.label}
          onPress={it.onPress}
          disabled={!it.onPress}
          style={[styles.statCell, i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.line }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {it.live ? <View style={[styles.liveDot, { backgroundColor: colors.ok }]} /> : null}
            <Text style={[styles.statValue, { fontSize: size, color: it.color || colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
              {it.value}
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: colors.muted }]} numberOfLines={2}>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Карт доторх мөр: [icon] гарчиг / тайлбар ... chevron | right */
export function IconRow({ icon, tone = 'blue', title, sub, right, onPress, first = false, chevron = true }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.irow, !first && { borderTopWidth: 1, borderTopColor: colors.line }, pressed && { backgroundColor: colors.field }]}
    >
      {icon ? <RowIcon name={icon} tone={tone} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.irowTitle, { color: colors.ink }]} numberOfLines={2}>
          {title}
        </Text>
        {sub ? (
          <Text style={[styles.irowSub, { color: colors.muted }]} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && chevron && !right ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
    </Pressable>
  );
}

const AVATAR_COLORS = ['#8A63D2', '#1F9D74', '#E07A3F', '#3B7DD8', '#C2410C', '#0E8A86', '#DD3F7C', '#4652DE'];

/** Зураг байвал зураг, үгүй бол өнгөт дугуй + 2 үсэг. `online` — ногоон цэг. */
export function Avatar({ uri: rawUri, name = '', size = 40, online = false, ring = false }) {
  const { colors } = useTheme();
  const uri = sanitizeAvatarUrl(rawUri);
  const initials = String(name).replace(/[-.]/g, ' ').trim().split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase() || '?';
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.field }} />
      ) : PERSON_AVATARS.length ? (
        // Зураггүй бол prototype шиг зурсан хүний дүрс (нэрээр тогтмол).
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
          <SvgXml xml={PERSON_AVATARS[h % PERSON_AVATARS.length]} width={size} height={size} />
        </View>
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: Math.round(size * 0.36) }}>{initials}</Text>
        </View>
      )}
      {ring ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: 1, borderColor: colors.line }]} /> : null}
      {online ? (
        <View style={[styles.onlineDot, { backgroundColor: colors.ok, borderColor: colors.card, width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} />
      ) : null}
    </View>
  );
}

/** Хоосон төлөв: icon + гарчиг + тайлбар + үйлдэл. */
export function EmptyBlock({ icon = 'file-tray-outline', ph, title, text, actionLabel, onAction }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyBig, { backgroundColor: colors.brandSoft }]}>
        {ph && PH[ph] ? <PhIcon name={ph} size={38} color={colors.brand} /> : <Ionicons name={icon} size={36} color={colors.brand} />}
      </View>
      {title ? <Text style={[styles.emptyTitle, { color: colors.ink }]}>{title}</Text> : null}
      {text ? <Text style={[styles.emptyText, { color: colors.muted }]}>{text}</Text> : null}
      {actionLabel ? <PillButton title={actionLabel} icon="add" onPress={onAction} style={{ marginTop: 4, alignSelf: 'center' }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  wmLogo: { backgroundColor: '#FFFFFF', borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wmText: { fontWeight: '500', letterSpacing: -0.3 },
  wmSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 12 },
  chipText: { fontSize: 12, fontWeight: '700' },

  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  roundBadge: { position: 'absolute', top: -4, right: -6 },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },

  pill: { height: 36, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  pillText: { fontSize: 14, fontWeight: '700' },

  seg: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { shadowColor: '#0F1722', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 14, fontWeight: '600' },

  fchips: { gap: 8, paddingHorizontal: 16 },
  fchip: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  fchipText: { fontSize: 13.5, fontWeight: '600' },
  fchipCount: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  fdot: { width: 8, height: 8, borderRadius: 4 },

  sec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10, marginHorizontal: 4, gap: 8 },
  secLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  secTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  secAction: { fontSize: 14, fontWeight: '600' },

  box: { borderRadius: 20, marginBottom: 12 },
  pad: { padding: 16 },

  statGrid: { flexDirection: 'row' },
  statCell: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, gap: 2, minWidth: 0 },
  statValue: { fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontWeight: '500', lineHeight: 15 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },

  irow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  irowTitle: { fontSize: 15, fontWeight: '600' },
  irowSub: { fontSize: 13, marginTop: 1 },

  onlineDot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },

  empty: { alignItems: 'center', paddingTop: 36, paddingBottom: 26, paddingHorizontal: 20 },
  emptyBig: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, marginBottom: 18, maxWidth: 260 },
});
