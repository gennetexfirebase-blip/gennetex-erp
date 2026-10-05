import React, { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_KEY = '@gennetex_onboarding_seen_v1';

export async function hasSeenOnboarding() {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'yes';
  } catch {
    return false;
  }
}

const SLIDES = [
  { key: 'work', title: 'Ажлын мэдээлэл нэг дор', body: 'Ирц, байршил, машин, бараа материал болон тайлангаа нэг орчноос удирдана.', tags: ['Ирц ба хуваарь', 'Бараа материал', 'Ажлын тайлан'], icon: 'briefcase-outline' },
  { key: 'team', title: 'Багаа бодит хугацаанд холбоно', body: 'Ажилтны байршил, ажлын явц, мэдэгдэл болон харилцааг тухайн мөчид нь харна.', tags: ['Шууд байршил', 'Мэдэгдэл', 'Багийн харилцаа'], icon: 'people-outline' },
  { key: 'insight', title: 'Мэдээлэлд тулгуурлан шийднэ', body: 'Өдрийн үзүүлэлт, нөөц болон гүйцэтгэлийн тайланг ойлгомжтой байдлаар хянана.', tags: ['Гүйцэтгэл', 'Нөөцийн төлөв', 'Тайлан ба экспорт'], icon: 'bar-chart-outline' },
];

export default function OnboardingScreen({ onDone }) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
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
      <StatusBar style="dark" backgroundColor="#f6f8fa" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity onPress={finish} style={styles.skip} accessibilityRole="button">
            <Text style={styles.skipText}>Алгасах</Text>
            <Ionicons name="chevron-forward" size={15} color="#475569" />
          </TouchableOpacity>
        </View>
        <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))} style={styles.pages}>
          {SLIDES.map((slide) => (
            <View key={slide.key} style={[styles.slide, { width }]}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{slide.body}</Text>
              <View style={styles.featurePanel}>
                <View style={styles.featureIcon}><Ionicons name={slide.icon} size={34} color="#0369a1" /></View>
                <View style={styles.tags}>{slide.tags.map((tag) => <View key={tag} style={styles.tagRow}><Ionicons name="checkmark-circle" size={19} color="#047857" /><Text style={styles.tag}>{tag}</Text></View>)}</View>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((slide, dotIndex) => <TouchableOpacity key={slide.key} hitSlop={10} onPress={() => goTo(dotIndex)}><View style={[styles.dot, dotIndex === index && styles.dotActive]} /></TouchableOpacity>)}
          </View>
          <TouchableOpacity style={styles.continueButton} onPress={() => (last ? finish() : goTo(index + 1))} activeOpacity={0.9}>
            <Text style={styles.continueText}>{last ? 'Эхлэх' : 'Үргэлжлүүлэх'}</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8fa' }, safe: { flex: 1 },
  topBar: { height: 88, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 132, height: 78 },
  skip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, gap: 2 }, skipText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  pages: { flex: 1 }, slide: { alignItems: 'stretch', paddingHorizontal: 24, paddingTop: 30 },
  title: { maxWidth: 330, color: '#0f172a', fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7 },
  body: { color: '#475569', fontSize: 15, lineHeight: 22, maxWidth: 350, marginTop: 12 },
  featurePanel: { flex: 1, minHeight: 300, maxHeight: 390, marginTop: 34, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, backgroundColor: '#fff', padding: 22, justifyContent: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 },
  featureIcon: { width: 68, height: 68, borderRadius: 16, backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  tags: { gap: 18 },
  tagRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 11 },
  tag: { flex: 1, color: '#334155', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }, dots: { height: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1' }, dotActive: { width: 24, backgroundColor: '#0369a1' },
  continueButton: { minHeight: 54, borderRadius: 10, backgroundColor: '#0369a1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  continueText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
