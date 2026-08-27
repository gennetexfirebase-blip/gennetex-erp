import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Огноо сонгох мөр — календарь icon + огноо + dropdown сум, баруунд шүүлтүүр. */
export default function DateRangeFilterBar({ fromLabel, toLabel, onPressDate, onPressFilter, colors }) {
  const sameDay = fromLabel === toLabel;
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.dateBox, { backgroundColor: colors.surfaceContainer }]}
        onPress={onPressDate}
        activeOpacity={0.75}
      >
        <Ionicons name="calendar-outline" size={17} color={colors.textMuted} />
        <Text style={[styles.dateText, { color: colors.text }]}>
          {sameDay ? fromLabel : `${fromLabel} → ${toLabel}`}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterBtn, { backgroundColor: colors.surfaceContainer }]}
        onPress={onPressFilter}
        activeOpacity={0.75}
        accessibilityLabel="Шүүлтүүр"
      >
        <Ionicons name="options-outline" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dateBox: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  dateText: { fontSize: 14, fontWeight: '600' },
  filterBtn: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
