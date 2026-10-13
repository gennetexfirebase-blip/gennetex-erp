import React, { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SvgXml } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, useStyles } from '../context/ThemeContext';
import WELCOME_ART from '../theme/welcomeArt';

export const ONBOARDING_KEY = '@gennetex_onboarding_seen_v1';

export async function hasSeenOnboarding() {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'yes';
  } catch {
    return false;
  }
}

// Дизайн §4 Welcome: пастел карт (ногоон, шар, ягаан) дээр зураг.
const SLIDES = [
  { key: 'checkin', tint: '#DCEEE4', title: 'Ирцээ нэг товчоор бүртгэ', body: 'Ажилдаа ирэхдээ нэг товч дарахад л болно. Цаг, байршил нь өөрөө бүртгэгдэнэ.' },
  { key: 'track', tint: '#FBEFC8', title: 'Ирц, цагаа өөрөө хянаарай', body: 'Цагтаа ирсэн, хоцорсон өдрүүд, энэ сарын ажилласан цагаа хуанли дээрээс хараарай.' },
  { key: 'leave', tint: '#FBE0D5', title: 'Чөлөө, амралтаа апп-аар хүс', body: 'Хүсэлтээ илгээгээд менежерийн хариуг шууд мэдэгдлээр аваарай.' },
];

export default function OnboardingScreen({ onDone }) {
  const { width } = useWindowDimensions();
  const { isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const scrollRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
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
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          {!last ? (
            <Pressable onPress={() => goTo(SLIDES.length - 1)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>Алгасах</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Пастел карт — өнгө, зураг хуудастай хамт солигдоно */}
        <View style={styles.wcardWrap}>
          {SLIDES.map((s, i) => {
            const range = [(i - 1) * width, i * width, (i + 1) * width];
            const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
            const shift = scrollX.interpolate({ inputRange: range, outputRange: [24, 0, -24], extrapolate: 'clamp' });
            return (
              <Animated.View key={s.key} pointerEvents="none" style={[styles.wcard, { backgroundColor: s.tint, opacity }]}>
                <Animated.View style={{ width: '92%', height: '92%', transform: [{ translateX: shift }] }}>
                  <SvgXml xml={WELCOME_ART[i]} width="100%" height="100%" />
                </Animated.View>
              </Animated.View>
            );
          })}
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
          onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
          style={styles.copy}
        >
          {SLIDES.map((s) => (
            <View key={s.key} style={[styles.slide, { width }]}>
              <Text style={styles.title} accessibilityRole="header">{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </Animated.ScrollView>

        <View style={styles.foot}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <Pressable key={s.key} hitSlop={10} onPress={() => goTo(i)} accessibilityLabel={`${i + 1}-р алхам`}>
                <View style={[styles.dot, i === index && styles.dotOn]} />
              </Pressable>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.98 }] }]}
            onPress={() => (last ? finish() : goTo(index + 1))}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>{last ? 'Эхлэх' : 'Үргэлжлүүлэх'}</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={finish} accessibilityRole="button">
            <Text style={styles.ghostText}>Надад бүртгэл бий</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    safe: { flex: 1 },
    topbar: { height: 44, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20 },
    link: { color: colors.muted, fontSize: 15, fontWeight: '500', paddingVertical: 8, paddingHorizontal: 4 },
    wcardWrap: { flex: 1, minHeight: 200, marginHorizontal: 16 },
    wcard: { ...StyleSheet.absoluteFillObject, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    copy: { flexGrow: 0, paddingTop: 28 },
    slide: { paddingHorizontal: 28 },
    title: { color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.75, marginBottom: 10 },
    body: { color: colors.muted, fontSize: 16, lineHeight: 24, maxWidth: 320 },
    foot: { paddingTop: 22, paddingHorizontal: 24, paddingBottom: 12, gap: 12 },
    dots: { flexDirection: 'row', gap: 6, marginHorizontal: 4, marginBottom: 10 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
    dotOn: { width: 22, backgroundColor: colors.ink },
    btn: { height: 56, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: colors.brandInk, fontSize: 17, fontWeight: '600' },
    ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
    ghostText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  });
