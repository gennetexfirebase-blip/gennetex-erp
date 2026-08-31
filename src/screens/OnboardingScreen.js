import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
 * Гурван алхам: ирц, агуулах, хамт олон. Нэг удаа үзсэний дараа
 * дахин гарахгүй ("Дахин харуулахгүй" сонголт эсвэл төгсгөл хүртэл
 * үзсэн үед хадгална).
 */
const SLIDES = [
  {
    key: 'attendance',
    icons: ['location', 'time', 'checkmark-circle', 'calendar', 'walk', 'notifications'],
    hero: 'finger-print',
    title: 'Ирцээ утсаараа\nбүртгүүл',
    body: 'Ажлын байрандаа ирээд нэг товшилтоор ирцээ бүртгэнэ. Бүсээс гарахад өөрөө сануулна.',
  },
  {
    key: 'inventory',
    icons: ['cube', 'construct', 'shirt', 'car', 'water', 'document-text'],
    hero: 'cube',
    title: 'Багаж, бараагаа\nхянаж яв',
    body: 'Хэн юу авсан, хэдэн ширхэг үлдсэн бүгд нэг дор. Excel тайлан шууд татна.',
  },
  {
    key: 'team',
    icons: ['chatbubbles', 'people', 'megaphone', 'stats-chart', 'call', 'mail'],
    hero: 'people',
    title: 'Хамт олонтойгоо\nнэг талбарт',
    body: 'Чат, мэдэгдэл, тайлан, дуудлага — ажлын бүх зүйл аппын дотор.',
  },
];

export default function OnboardingScreen({ onDone }) {
  const { colors } = useTheme();
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

  const next = () => {
    if (last) return finish();
    const to = index + 1;
    scrollRef.current?.scrollTo({ x: to * width, animated: true });
    setIndex(to);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Хуруугаараа гүйлгэхэд ч индекс дагана — эс бөгөөс товч
        // буруу алхам руу үсэрнэ.
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.key} style={[styles.slide, { width }]}>
            {/* Дүрсний тор — гол дүрс төвд, бусад нь тойрон */}
            <View style={styles.art}>
              <View style={styles.ring} />
              <View style={styles.heroTile}>
                <Ionicons name={s.hero} size={44} color={colors.onPrimary} />
              </View>
              {s.icons.map((name, i) => {
                const angle = (i / s.icons.length) * Math.PI * 2 - Math.PI / 2;
                const r = 104;
                return (
                  <View
                    key={name}
                    style={[
                      styles.orbit,
                      {
                        transform: [
                          { translateX: Math.cos(angle) * r },
                          { translateY: Math.sin(angle) * r },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name={name} size={19} color={colors.primary} />
                  </View>
                );
              })}
            </View>

            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>

        <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{last ? 'Эхлэх' : 'Дараах'}</Text>
        </TouchableOpacity>

        {/* Сүүлийн алхам дээр "алгасах" утгагүй — тэнд зөвхөн Эхлэх. */}
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
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  art: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  ring: {
    position: 'absolute',
    width: 208,
    height: 208,
    borderRadius: 104,
    borderWidth: 1.5,
    borderColor: colors.primary + '26',
  },
  heroTile: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Гол дүрс нь тойрог доторх бусдаас дээгүүр байх ёстой.
    zIndex: 2,
  },
  orbit: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: colors.text,
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: spacing.md,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15.5,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 320,
  },

  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.outlineVariant,
  },
  dotOn: { width: 22, backgroundColor: colors.primary },

  cta: {
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  ctaText: { color: colors.onPrimary, fontSize: 16.5, fontWeight: '800' },

  skip: { paddingVertical: 14, alignItems: 'center' },
  skipText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
