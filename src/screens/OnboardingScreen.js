import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

export const ONBOARDING_KEY = '@gennetex_onboarding_seen_v1';

/** Хэрэглэгч танилцуулгыг үзсэн эсэх. */
export async function hasSeenOnboarding() {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'yes';
  } catch {
    // Хадгалалт унтарсан үед танилцуулгыг харуулах нь алгасахаас дээр.
    return false;
  }
}

/**
 * Танилцуулга — аппыг анх нээхэд.
 *
 * Гурван алхам. Дүрслэл нь тухайн алхмын агуулгыг ЯГ илэрхийлнэ:
 * ирц дээр цагийн бөгж, агуулах дээр өрөгдсөн хайрцаг, хамт олон
 * дээр давхарласан аватар. Ерөнхий "тойрсон дүрс" биш.
 */
const SLIDES = [
  {
    key: 'attendance',
    kicker: 'Ирц бүртгэл',
    title: 'Ирснээ нэг\nтовшилтоор',
    body: 'Ажлын байрандаа ирээд товшиход л бүртгэгдэнэ. Бүсээс гарахад өөрөө сануулна.',
  },
  {
    key: 'inventory',
    kicker: 'Агуулах, багаж',
    title: 'Юу хаана\nбайгаа нь тодорхой',
    body: 'Хэн юу авсан, хэдэн ширхэг үлдсэн — бүгд нэг дор. Excel тайлан шууд татна.',
  },
  {
    key: 'team',
    kicker: 'Хамт олон',
    title: 'Ажлын бүх зүйл\nнэг талбарт',
    body: 'Чат, мэдэгдэл, тайлан, дуудлага. Өөр апп нээх шаардлагагүй.',
  },
];

export default function OnboardingScreen({ onDone }) {
  const { colors, gradients } = useTheme();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);

  const last = index === SLIDES.length - 1;

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'yes');
    } catch {
      // Хадгалж чадаагүй ч урагшилна — дараагийн удаа дахин гарна.
    }
    onDone?.();
  };

  const goTo = (to) => {
    scrollRef.current?.scrollTo({ x: to * width, animated: true });
    setIndex(to);
  };

  return (
    <View style={styles.root}>
      {/* Дэвсгэрийн зөөлөн туяа — брэндийн цэнхэр дээрээс доош бүдгэрнэ */}
      <LinearGradient
        colors={[colors.primary + '1A', colors.background + '00']}
        style={styles.glow}
        pointerEvents="none"
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          style={{ flex: 1 }}
        >
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.slide, { width }]}>
              <Art kind={s.key} active={index === i} colors={colors} styles={styles} />

              <Text style={styles.kicker}>{s.kicker}</Text>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <TouchableOpacity
                key={s.key}
                onPress={() => goTo(i)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}-р алхам`}
              >
                <View style={[styles.dot, i === index && styles.dotOn]} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => (last ? finish() : goTo(index + 1))}
            activeOpacity={0.9}
            style={styles.ctaWrap}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>{last ? 'Эхлэх' : 'Дараах'}</Text>
              <Ionicons
                name={last ? 'arrow-forward-circle' : 'arrow-forward'}
                size={19}
                color="#fff"
              />
            </LinearGradient>
          </TouchableOpacity>

          {/* Сүүлийн алхам дээр алгасах утгагүй — зай нь хэвээр
              үлдэж, товч доош үсрэхээс сэргийлнэ. */}
          <TouchableOpacity
            style={styles.skip}
            onPress={finish}
            activeOpacity={0.7}
            disabled={last}
          >
            <Text style={[styles.skipText, last && { opacity: 0 }]}>
              Алгасах · дахин харуулахгүй
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Дүрслэл — алхам бүрд өөр. Идэвхжихэд зөөлөн орж ирнэ.
   ───────────────────────────────────────────────────────────── */
function Art({ kind, active, colors, styles }) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: active ? 1 : 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, enter]);

  const rise = (from) => ({
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
    ],
  });

  return (
    <View style={styles.art}>
      <View style={styles.artPlate} />

      {kind === 'attendance' ? (
        <>
          <Animated.View style={[styles.ring, rise(14)]}>
            <View style={styles.ringInner}>
              <Text style={styles.ringNum}>09:00</Text>
              <Text style={styles.ringCap}>ирлээ</Text>
            </View>
          </Animated.View>
          <Animated.View style={[styles.chipTL, rise(22)]}>
            <Ionicons name="location" size={15} color={colors.primary} />
            <Text style={styles.chipText}>Оффис</Text>
          </Animated.View>
          <Animated.View style={[styles.chipBR, rise(28)]}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.chipText}>Бүртгэгдлээ</Text>
          </Animated.View>
        </>
      ) : null}

      {kind === 'inventory' ? (
        <>
          <Animated.View style={[styles.stack, rise(16)]}>
            {[
              { icon: 'construct', label: 'Шураг эргүүлэгч', qty: '3 ш' },
              { icon: 'cube', label: 'Кабель UTP', qty: '50 м' },
              { icon: 'shirt', label: 'Ажлын хантааз', qty: '2 ш' },
            ].map((row, i) => (
              <View key={row.label} style={[styles.stackRow, i === 0 && styles.stackTop]}>
                <View style={styles.stackIcon}>
                  <Ionicons name={row.icon} size={16} color={colors.primary} />
                </View>
                <Text style={styles.stackLabel} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={styles.stackQty}>{row.qty}</Text>
              </View>
            ))}
          </Animated.View>
          <Animated.View style={[styles.chipBR, rise(26)]}>
            <Ionicons name="download" size={15} color={colors.success} />
            <Text style={styles.chipText}>Excel</Text>
          </Animated.View>
        </>
      ) : null}

      {kind === 'team' ? (
        <>
          <Animated.View style={[styles.avatars, rise(16)]}>
            {['Б', 'М', 'Д', 'А'].map((ch, i) => (
              <View
                key={ch}
                style={[
                  styles.avatar,
                  { marginLeft: i === 0 ? 0 : -16, zIndex: 4 - i },
                ]}
              >
                <Text style={styles.avatarText}>{ch}</Text>
              </View>
            ))}
            <View style={[styles.avatar, styles.avatarMore, { marginLeft: -16 }]}>
              <Text style={styles.avatarMoreText}>+6</Text>
            </View>
          </Animated.View>
          <Animated.View style={[styles.bubble, rise(24)]}>
            <Text style={styles.bubbleText}>Багаж авсан уу?</Text>
          </Animated.View>
          <Animated.View style={[styles.bubbleMine, rise(30)]}>
            <Text style={styles.bubbleMineText}>Авсан ✓</Text>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, isDark }) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  /* ── Дүрслэлийн талбар ─────────────────────────────── */
  art: {
    width: 280,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  artPlate: {
    position: 'absolute',
    width: 224,
    height: 224,
    borderRadius: 64,
    backgroundColor: colors.primary + (isDark ? '14' : '0E'),
    transform: [{ rotate: '12deg' }],
  },

  // Ирц
  ring: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 7,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  ringInner: { alignItems: 'center' },
  ringNum: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  ringCap: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', marginTop: 1 },

  chipTL: {
    position: 'absolute',
    top: 22,
    left: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...cardShadow(colors, isDark),
  },
  chipBR: {
    position: 'absolute',
    bottom: 16,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...cardShadow(colors, isDark),
  },
  chipText: { color: colors.text, fontSize: 12.5, fontWeight: '700' },

  // Агуулах
  stack: { width: 232, gap: 8 },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...cardShadow(colors, isDark),
  },
  stackTop: { borderWidth: 1.5, borderColor: colors.primary + '40' },
  stackIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackLabel: { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: '600' },
  stackQty: { color: colors.primary, fontSize: 13, fontWeight: '800' },

  // Хамт олон
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 19, fontWeight: '800' },
  avatarMore: { backgroundColor: colors.surfaceContainerHigh },
  avatarMoreText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },

  bubble: {
    position: 'absolute',
    top: 24,
    left: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    backgroundColor: colors.surface,
    ...cardShadow(colors, isDark),
  },
  bubbleText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  bubbleMine: {
    position: 'absolute',
    bottom: 22,
    right: 4,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
    borderBottomRightRadius: 5,
    backgroundColor: colors.primary,
  },
  bubbleMineText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  /* ── Бичвэр ────────────────────────────────────────── */
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 37,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: spacing.md,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15.5,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 310,
  },

  /* ── Доод хэсэг ────────────────────────────────────── */
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.outlineVariant,
  },
  dotOn: { width: 26, backgroundColor: colors.primary },

  ctaWrap: { borderRadius: radius.md, overflow: 'hidden' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 17,
  },
  ctaText: { color: '#fff', fontSize: 16.5, fontWeight: '800', letterSpacing: 0.2 },

  skip: { paddingVertical: 15, alignItems: 'center' },
  skipText: { color: colors.textMuted, fontSize: 13.5, fontWeight: '600' },
});

/** Хөвөгч элементийн сүүдэр — хоёр горимд өөр өөр хүчтэй. */
function cardShadow(colors, isDark) {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: isDark ? 6 : 3 },
    default: {},
  });
}
