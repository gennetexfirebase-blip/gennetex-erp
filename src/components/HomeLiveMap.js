import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import TrackingMap from '../tracking/components/TrackingMap';
import { useLiveEmployees } from '../tracking/hooks/useLiveEmployees';
import { trackingStatus } from '../tracking/utils/locationUtils';

/**
 * Нүүр хуудасны багийн байршлын газрын зураг.
 *
 * iPhone дээр Apple Maps (`TrackingMap.ios.tsx`), Android дээр
 * OpenStreetMap. Газрын зураг өөрөө хөдлөхгүй (нүүрийг гүйлгэхэд саад
 * болохгүй) — хаана ч дарахад «Байршил хяналт» дэлгэц нээгдэнэ. Тэр
 * хэсгийн тусдаа хавтан нүүрээс нуугдсан тул энэ нь цорын ганц орц.
 */
export default function HomeLiveMap({ onPress }) {
  const { isAdmin, isCloud, currentUser } = useApp();
  const { colors, shadow } = useTheme();
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
    <View style={[styles.card, { backgroundColor: colors.mapBg }, shadow.md]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <TrackingMap employees={employees} now={now} interactive={false} meId={currentUser?.id} />
      </View>
      <View pointerEvents="none" style={styles.topRow}>
        <View style={[styles.pill, { backgroundColor: colors.bg }, shadow.sm]}>
          <View style={[styles.liveDot, { backgroundColor: colors.ok }]} />
          <Text style={[styles.pillText, { color: colors.ink }]}>Шууд</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.bg }, shadow.sm]}>
          <Ionicons name="people-outline" size={14} color={colors.ink} />
          <Text style={[styles.pillText, { color: colors.ink }]}>{online} онлайн</Text>
        </View>
      </View>
      <View pointerEvents="none" style={[styles.openBtn, { backgroundColor: colors.bg }, shadow.md]}>
        <Ionicons name="expand-outline" size={16} color={colors.ink} />
        <Text style={[styles.openText, { color: colors.ink }]}>Газрын зураг</Text>
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
const styles = StyleSheet.create({
  card: { height: 220, borderRadius: 20, overflow: 'hidden', marginBottom: 12 },
  topRow: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 14 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  openBtn: { position: 'absolute', right: 12, bottom: 24, flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 12 },
  openText: { fontSize: 13, fontWeight: '700' },
});