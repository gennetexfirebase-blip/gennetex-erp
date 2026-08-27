import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayKey } from '../lib/workHours';

/**
 * Огнооны мөр — өдрөөр урагш/хойш алхах сум, дунд нь огноо, хажууд нь
 * календарь нээх товч.
 *
 * Өмнө нь зөвхөн дарж bottom sheet нээдэг байсан. Өдрөөр алхах нь хамгийн
 * олон давтагддаг үйлдэл тул түүнийг нэг даралт болгов.
 */
export default function DateRangeFilterBar({ fromLabel, onChangeDate, onPressCalendar, onPressFilter, colors }) {
  const today = dayKey();
  const isToday = fromLabel === today;

  const step = (n) => {
    const d = new Date(fromLabel);
    d.setDate(d.getDate() + n);
    const next = dayKey(d);
    // Ирээдүйн ирц гэж байхгүй тул хориглоно.
    if (next > today) return;
    onChangeDate?.(next);
  };

  return (
    <View style={styles.row}>
      <View style={[styles.bar, { backgroundColor: colors.surfaceContainer, borderColor: colors.primary + '55' }]}>
        <TouchableOpacity
          style={[styles.sideBtn, { backgroundColor: colors.primary + '22' }]}
          onPress={onPressCalendar}
          accessibilityLabel="Календарь нээх"
        >
          <Ionicons name="calendar" size={17} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => step(-1)} hitSlop={10} style={styles.arrow}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.center} onPress={onPressCalendar} activeOpacity={0.7}>
          <Text style={[styles.dateText, { color: colors.text }]}>{fromLabel}</Text>
          {isToday ? (
            <View style={[styles.todayChip, { backgroundColor: colors.primary + '28' }]}>
              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>Өнөөдөр</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => step(1)}
          hitSlop={10}
          style={[styles.arrow, isToday && { opacity: 0.3 }]}
          disabled={isToday}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sideBtn, { backgroundColor: colors.primary + '22' }]}
          onPress={onPressFilter}
          accessibilityLabel="Шүүлтүүр"
        >
          <Ionicons name="options-outline" size={17} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  sideBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  arrow: { padding: 4 },
  center: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: 16, fontWeight: '700' },
  todayChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7, marginTop: 2 },
});
