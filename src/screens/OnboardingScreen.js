import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../theme/tokens';

export const ONBOARDING_KEY = '@gennetex_onboarding_seen_v1';

export async function hasSeenOnboarding() {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'yes';
  } catch {
    return false;
  }
}

const SLIDES = [
  {
    key: 'work',
    kicker: 'ИРЦ · МАШИН · АЖИЛ',
    title: 'Ажлын өдөр нэг дор',
    body: 'Ирцээ гулсуулж бүртгээд, өнөөдрийн машинаа сонгоод, ажлаа шууд эхлүүлнэ.',
    Art: AttendanceArt,
  },
  {
    key: 'team',
    kicker: 'БАГ · БАЙРШИЛ',
    title: 'Багаа бодит цагт харна',
    body: 'Ажилчдын байршил, дуудлага, чат болон мэдэгдэл тухайн мөчид нь.',
    Art: MapArt,
  },
  {
    key: 'insight',
    kicker: 'ТАЙЛАН · ГҮЙЦЭТГЭЛ',
    title: 'Тоонд тулгуурлан шийд',
    body: 'Гүйцэтгэл, бараа материал, бензин — ойлгомжтой тайлан, Excel экспорттой.',
    Art: ChartArt,
  },
];

export default function OnboardingScreen({ onDone }) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  // Хэвтээ ScrollView-ийн хуудас өндрөө өөрөө дүүргэдэггүй — хэмжиж өгнө.
  const [pageH, setPageH] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    try { await AsyncStorage.setItem(ONBOARDING_KEY, 'yes'); } catch {}
    onDone?.();
  };
  const goTo = (next) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[brand[500], brand[700], brand[950]]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.orb, styles.orbA]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbB]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View style={styles.logoBadge}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Gennetex" />
          </View>
          {!last ? (
            <TouchableOpacity onPress={finish} style={styles.skip} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.skipText}>Алгасах</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
          onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
          onLayout={(e) => setPageH(e.nativeEvent.layout.height)}
          style={styles.pages}
        >
          {SLIDES.map(({ key, kicker, title, body, Art }, i) => {
            // Хуудас солигдоход дүрслэл зөөлөн томорч, бичвэр гулсаж орно.
            const range = [(i - 1) * width, i * width, (i + 1) * width];
            const scale = scrollX.interpolate({ inputRange: range, outputRange: [0.86, 1, 0.86], extrapolate: 'clamp' });
            const fade = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
            const shift = scrollX.interpolate({ inputRange: range, outputRange: [40, 0, -40], extrapolate: 'clamp' });
            return (
              <View key={key} style={[styles.slide, { width }, pageH ? { height: pageH } : null]}>
                <Animated.View style={[styles.artWrap, { opacity: fade, transform: [{ scale }] }]}>
                  <Art />
                </Animated.View>
                <Animated.View style={{ opacity: fade, transform: [{ translateX: shift }] }}>
                  <Text style={styles.kicker}>{kicker}</Text>
                  <Text style={styles.title} accessibilityRole="header">{title}</Text>
                  <Text style={styles.body}>{body}</Text>
                </Animated.View>
              </View>
            );
          })}
        </Animated.ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((slide, dotIndex) => (
              <TouchableOpacity key={slide.key} hitSlop={10} onPress={() => goTo(dotIndex)} accessibilityLabel={`${dotIndex + 1}-р хуудас`}>
                <View style={[styles.dot, dotIndex === index && styles.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cta} onPress={() => (last ? finish() : goTo(index + 1))} activeOpacity={0.9} accessibilityRole="button">
            <Text style={styles.ctaText}>{last ? 'Эхлэх' : 'Үргэлжлүүлэх'}</Text>
            <View style={styles.ctaArrow}><Ionicons name="arrow-forward" size={18} color="#fff" /></View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ── Дүрслэлүүд: апп-ын жинхэнэ UI-аас сэдэвлэсэн жижиг макет ─────────── */

function Glass({ style, children }) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

function Float({ children, delay = 0, style }) {
  // Зөөлөн дээш доош хөвөх — дүрслэлд амьд мэдрэмж өгнө.
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -6, duration: 1800, delay, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y, delay]);
  return <Animated.View style={[style, { transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

function AttendanceArt() {
  return (
    <View style={styles.art}>
      <Float style={styles.cardMain}>
        <Glass style={styles.cardInner}>
          <Text style={styles.mockLabel}>Өнөөдрийн ирц</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.mockTime}>08:52</Text>
            <View style={styles.ring}><Text style={styles.ringText}>6:14</Text></View>
          </View>
          <View style={styles.statusChip}><View style={styles.greenDot} /><Text style={styles.statusText}>Ажил дээр</Text></View>
          <View style={styles.slider}>
            <View style={styles.sliderKnob}><Ionicons name="arrow-forward" size={18} color={brand[700]} /></View>
            <Text style={styles.sliderText}>Ирлээ  ›››</Text>
          </View>
        </Glass>
      </Float>
      <Float delay={600} style={styles.cardSide}>
        <Glass style={styles.miniCard}>
          <Ionicons name="car-sport" size={18} color="#fff" />
          <Text style={styles.miniText}>7428 АРН</Text>
          <Text style={styles.miniSub}>2/2 баг</Text>
        </Glass>
      </Float>
    </View>
  );
}

function MapArt() {
  const pins = [[38, 30, 'Бат'], [62, 52, 'Сараа'], [24, 66, 'Төгөлдөр'], [72, 22, 'Анар']];
  return (
    <View style={styles.art}>
      <Float style={styles.cardMain}>
        <Glass style={[styles.cardInner, styles.mapCard]}>
          {[...Array(6)].map((_, i) => <View key={`h${i}`} style={[styles.road, { top: `${10 + i * 16}%` }]} />)}
          {[...Array(4)].map((_, i) => <View key={`v${i}`} style={[styles.roadV, { left: `${12 + i * 26}%` }]} />)}
          {pins.map(([l, t, n]) => (
            <View key={n} style={[styles.pin, { left: `${l}%`, top: `${t}%` }]}>
              <View style={styles.greenDot} /><Text style={styles.pinText}>{n}</Text>
            </View>
          ))}
        </Glass>
      </Float>
      <Float delay={500} style={styles.cardSide}>
        <Glass style={styles.miniCard}>
          <Ionicons name="people" size={18} color="#fff" />
          <Text style={styles.miniText}>12 онлайн</Text>
          <Text style={styles.miniSub}>шууд</Text>
        </Glass>
      </Float>
    </View>
  );
}

function ChartArt() {
  const bars = [46, 64, 52, 78, 70, 92, 84];
  return (
    <View style={styles.art}>
      <Float style={styles.cardMain}>
        <Glass style={styles.cardInner}>
          <Text style={styles.mockLabel}>7 хоногийн гүйцэтгэл</Text>
          <Text style={styles.mockTime}>+18%</Text>
          <View style={styles.bars}>
            {bars.map((h, i) => (
              <View key={i} style={styles.barCol}>
                <View style={[styles.bar, { height: `${h}%` }, i === 5 && styles.barHot]} />
              </View>
            ))}
          </View>
        </Glass>
      </Float>
      <Float delay={700} style={styles.cardSide}>
        <Glass style={styles.miniCard}>
          <Ionicons name="document-text" size={18} color="#fff" />
          <Text style={styles.miniText}>Excel</Text>
          <Text style={styles.miniSub}>экспорт</Text>
        </Glass>
      </Float>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand[700] },
  safe: { flex: 1 },
  orb: { position: 'absolute', borderRadius: 999 },
  orbA: { width: 360, height: 360, top: -140, right: -120, backgroundColor: 'rgba(255,255,255,0.08)' },
  orbB: { width: 280, height: 280, bottom: 120, left: -150, backgroundColor: 'rgba(56,189,248,0.14)' },
  topBar: { height: 72, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoBadge: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  logo: { width: 84, height: 44 },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  skipText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pages: { flex: 1 },
  slide: { paddingHorizontal: 28, justifyContent: 'flex-end', paddingBottom: 8 },
  artWrap: { flex: 1, justifyContent: 'center' },
  kicker: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#fff', fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8, marginTop: 8 },
  body: { color: 'rgba(255,255,255,0.84)', fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 360 },
  footer: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 6 },
  dots: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 26, backgroundColor: '#fff' },
  cta: {
    minHeight: 58, borderRadius: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingLeft: 24, paddingRight: 8,
    shadowColor: '#082c40', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 10,
  },
  ctaText: { color: brand[700], fontSize: 17, fontWeight: '800' },
  ctaArrow: { width: 42, height: 42, borderRadius: 14, backgroundColor: brand[600], alignItems: 'center', justifyContent: 'center' },

  // Дүрслэл
  art: { height: 330, alignItems: 'center', justifyContent: 'center' },
  glass: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', borderRadius: 26 },
  cardMain: { width: '92%' },
  cardInner: { padding: 20 },
  cardSide: { position: 'absolute', right: -6, bottom: 4 },
  miniCard: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, backgroundColor: 'rgba(8,44,64,0.55)', alignItems: 'flex-start', gap: 2 },
  miniText: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 4 },
  miniSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  mockLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  mockTime: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ring: { width: 76, height: 76, borderRadius: 38, borderWidth: 6, borderColor: '#fff', borderLeftColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  ringText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statusChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  slider: { marginTop: 16, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', justifyContent: 'center' },
  sliderKnob: { position: 'absolute', left: 4, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sliderText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  mapCard: { height: 250, padding: 0, overflow: 'hidden' },
  road: { position: 'absolute', left: -10, right: -10, height: 5, backgroundColor: 'rgba(255,255,255,0.16)', transform: [{ rotate: '-8deg' }] },
  roadV: { position: 'absolute', top: 0, bottom: 0, width: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  pin: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  pinText: { color: '#0f172a', fontSize: 11, fontWeight: '800' },
  bars: { height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.4)' },
  barHot: { backgroundColor: '#fff' },
});
