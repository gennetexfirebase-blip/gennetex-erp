import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import TrackingMap from '../tracking/components/TrackingMap';
import { useLiveEmployees } from '../tracking/hooks/useLiveEmployees';
import { trackingStatus } from '../tracking/utils/locationUtils';
import { brand } from '../theme/tokens';

/**
 * Нүүр хуудасны багийн байршлын газрын зураг.
 *
 * iPhone дээр Apple Maps (`TrackingMap.ios.tsx`), Android дээр
 * OpenStreetMap. Газрын зураг өөрөө хөдлөхгүй (нүүрийг гүйлгэхэд саад
 * болохгүй) — хаана ч дарахад «Байршил хяналт» дэлгэц нээгдэнэ. Тэр
 * хэсгийн тусдаа хавтан нүүрээс нуугдсан тул энэ нь цорын ганц орц.
 */
export default function HomeLiveMap({ onPress }) {
  const { isAdmin, isCloud } = useApp();
  const { colors, isDark, shadow } = useTheme();
  const focused = useIsFocused();
  const { employees } = useLiveEmployees(isAdmin && isCloud && focused);
  // Нүүрэнд секунд тутам дахин зурах шаардлагагүй — 30 сек тутам.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const online = useMemo(() => employees.filter((p) => trackingStatus(p, now) !== 'offline').length, [employees, now]);

  if (!isAdmin) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, isDark ? shadow.sm : shadow.md]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Platform.OS === 'web' ? <MapPreview /> : <TrackingMap employees={employees} now={now} interactive={false} />}
      </View>
      {/* Дээд/доод бүдэгрэл — текст газрын зураг дээр уншигдана */}
      <LinearGradient pointerEvents="none" colors={['rgba(8,44,64,0.55)', 'rgba(8,44,64,0)']} style={styles.topFade} />
      <View pointerEvents="none" style={styles.topRow}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Шууд байршил</Text>
        </View>
        <View style={styles.countPill}>
          <Ionicons name="people" size={13} color="#fff" />
          <Text style={styles.countText}>{online} онлайн</Text>
        </View>
      </View>
      <View pointerEvents="none" style={styles.openBtn}>
        <Text style={styles.openText}>Газрын зураг</Text>
        <Ionicons name="expand-outline" size={15} color={brand[700]} />
      </View>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Ажилчдын байршил. ${online} онлайн. Газрын зураг нээх`}
      />
    </View>
  );
}

/** Вэб урьдчилсан харагдац (react-native-maps/WebView вэб дээр ажиллахгүй). */
function MapPreview() {
  return (
    <LinearGradient colors={['#dfeefa', '#cfe4f4']} style={StyleSheet.absoluteFill}>
      {[...Array(7)].map((_, i) => (
        <View key={`h${i}`} style={[styles.road, { top: 20 + i * 28, transform: [{ rotate: '-8deg' }] }]} />
      ))}
      {[...Array(6)].map((_, i) => (
        <View key={`v${i}`} style={[styles.roadV, { left: 30 + i * 62 }]} />
      ))}
      {[[90, 110], [210, 80], [260, 140]].map(([l, t], i) => (
        <View key={i} style={[styles.fakePin, { left: l, top: t }]}><View style={styles.liveDotGreen} /></View>
      ))}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { height: 196, borderRadius: 24, overflow: 'hidden', marginBottom: 14 },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0, height: 72 },
  topRow: { position: 'absolute', left: 14, right: 14, top: 12, flexDirection: 'row', justifyContent: 'space-between' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  liveText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  countPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(8,44,64,0.55)' },
  countText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  openBtn: {
    position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4,
  },
  openText: { color: brand[700], fontSize: 13, fontWeight: '700' },
  road: { position: 'absolute', left: -20, right: -20, height: 6, backgroundColor: 'rgba(255,255,255,0.75)' },
  roadV: { position: 'absolute', top: 0, bottom: 0, width: 5, backgroundColor: 'rgba(255,255,255,0.6)' },
  fakePin: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  liveDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a' },
});
