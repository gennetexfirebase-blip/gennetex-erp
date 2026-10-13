import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * Өдрийн ирцийн товч үзүүлэлт (prototype «Багийн ирц»):
 * өнгөт дөрвөлжин icon + том тоо + шошго. Идэвхтэй шүүлтүүрийн icon нь
 * дүүрэн өнгөтэй, нүд нь `field` дэвсгэртэй. Дарахад жагсаалтыг шүүнэ.
 */
const TONE = {
  all: ['ok', 'okSoft', 'people-outline'],
  on_time: ['ok', 'okSoft', 'person-check'],
  late: ['warn', 'warnSoft', 'time-alert'],
  absent: ['bad', 'badSoft', 'person-remove'],
  leave: ['tBlue', 'tBlueBg', 'airplane-outline'],
  early_leave: ['warn', 'warnSoft', 'exit-outline'],
};

export default function SummaryStatCards({ items, activeKey, onSelect }) {
  const { colors, shadow } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadow.md]}>
      {items.map((item) => {
        const active = activeKey === item.key;
        const [fg, bg, icon] = TONE[item.key] || TONE.all;
        return (
          <Pressable
            key={item.key}
            style={[styles.cell, active && { backgroundColor: colors.field }]}
            onPress={() => onSelect?.(item.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${item.label}: ${item.value}`}
          >
            <View style={[styles.icon, { backgroundColor: active ? colors[fg] : colors[bg] }]}>
              <Ionicons name={icon} size={19} color={active ? '#FFFFFF' : colors[fg]} />
            </View>
            <Text style={[styles.value, { color: colors.ink }]}>{item.value}</Text>
            <Text style={[styles.label, { color: colors.muted }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: 20, padding: 6 },
  cell: { flex: 1, alignItems: 'center', gap: 2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 2 },
  icon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  value: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { fontSize: 12, fontWeight: '500' },
});
