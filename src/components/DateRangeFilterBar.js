import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayKey } from '../lib/workHours';
import { useTheme } from '../context/ThemeContext';

/**
 * Огнооны мөр (design §4 Ирц — datebar): өмнөх/дараагийн өдрийн дугуй
 * товч (`field`), дунд нь огноо + «Өнөөдөр», хажууд нь календарь,
 * шүүлтүүр. Ирээдүйн өдөр рүү шилжихгүй.
 */
export default function DateRangeFilterBar({ fromLabel, onChangeDate, onPressCalendar, onPressFilter }) {
  const { colors, shadow } = useTheme();
  const today = dayKey();
  const isToday = fromLabel === today;

  const step = (n) => {
    const d = new Date(fromLabel);
    d.setDate(d.getDate() + n);
    const next = dayKey(d);
    if (next > today) return;
    onChangeDate?.(next);
  };

  const round = ({ icon, onPress, disabled, label }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, { backgroundColor: colors.field }, disabled && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={18} color={colors.ink} />
    </Pressable>
  );

  return (
    <View style={[styles.bar, { backgroundColor: colors.card }, shadow.md]}>
      {round({ icon: 'chevron-back', onPress: () => step(-1), label: 'Өмнөх өдөр' })}
      <Pressable style={styles.center} onPress={onPressCalendar} accessibilityRole="button" accessibilityLabel="Календарь нээх">
        <Text style={[styles.dateText, { color: colors.ink }]}>{fromLabel}</Text>
        <Text style={[styles.sub, { color: isToday ? colors.brand : colors.muted }]}>{isToday ? 'Өнөөдөр' : 'Календарь'}</Text>
      </Pressable>
      {round({ icon: 'chevron-forward', onPress: () => step(1), disabled: isToday, label: 'Дараагийн өдөр' })}
      {onPressFilter ? round({ icon: 'options-outline', onPress: onPressFilter, label: 'Шүүлтүүр' }) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 20 },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 12, fontWeight: '600' },
});
