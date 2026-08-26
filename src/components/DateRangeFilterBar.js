import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/** "📅 2026.08.26 → 2026.08.26" мөр + Filter icon. */
export default function DateRangeFilterBar({ fromLabel, toLabel, onPressDate, onPressFilter, colors }) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.dateBox, { backgroundColor: colors.surfaceContainer }]}
        onPress={onPressDate}
        activeOpacity={0.7}
      >
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
          📅 {fromLabel} {fromLabel !== toLabel ? `→ ${toLabel}` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterBtn, { backgroundColor: colors.surfaceContainer }]}
        onPress={onPressFilter}
        activeOpacity={0.7}
        accessibilityLabel="Шүүлтүүр"
      >
        <Text style={{ color: colors.primary, fontSize: 16 }}></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dateBox: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  filterBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
