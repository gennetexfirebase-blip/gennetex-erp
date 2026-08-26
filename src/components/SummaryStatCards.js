import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

/** Admin dashboard-ийн дээд хэсгийн horizontal scroll статистик карт мөр. */
export default function SummaryStatCards({ items, colors, activeKey, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => {
        const active = activeKey === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.card,
              { backgroundColor: active ? colors.primary : colors.surfaceContainer },
            ]}
            activeOpacity={0.8}
            onPress={() => onSelect?.(item.key)}
          >
            <Text style={[styles.value, { color: active ? colors.onPrimary : colors.text }]}>
              {item.value}
            </Text>
            <Text style={[styles.label, { color: active ? colors.onPrimary : colors.textMuted }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingRight: 8 },
  card: { minWidth: 92, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'flex-start' },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 12, marginTop: 4 },
});
