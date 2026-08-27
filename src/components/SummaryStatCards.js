import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Өдрийн ирцийн товч үзүүлэлт — НЭГ карт дотор хэсэгчилсэн байрлал.
 *
 * Өмнө нь тус бүр тусдаа карт байсныг загварын дагуу нэгтгэв: өнгөт
 * дөрвөлжин icon + тоо + шошго, хооронд нь босоо тусгаарлагч.
 */
const ICONS = {
  all: { name: 'grid', bg: 'rgba(0,153,219,0.16)', fg: '#2f9fe0' },
  absent: { name: 'calendar-clear', bg: 'rgba(245,140,68,0.16)', fg: '#f58c44' },
  late: { name: 'time', bg: 'rgba(255,107,96,0.16)', fg: '#ff6b60' },
  on_time: { name: 'checkmark-circle', bg: 'rgba(63,207,142,0.16)', fg: '#3fcf8e' },
  leave: { name: 'airplane', bg: 'rgba(143,211,242,0.16)', fg: '#8fd3f2' },
  early_leave: { name: 'exit', bg: 'rgba(245,181,68,0.16)', fg: '#f5b544' },
};

export default function SummaryStatCards({ items, colors, activeKey, onSelect }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
      {items.map((item, i) => {
        const meta = ICONS[item.key] || ICONS.all;
        const active = activeKey === item.key;
        return (
          <React.Fragment key={item.key}>
            {i > 0 ? (
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            ) : null}
            <TouchableOpacity
              style={styles.cell}
              activeOpacity={0.75}
              onPress={() => onSelect?.(item.key)}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: meta.bg },
                  active && { borderWidth: 1.5, borderColor: meta.fg },
                ]}
              >
                <Ionicons name={meta.name} size={16} color={meta.fg} />
              </View>
              <Text
                style={[
                  styles.value,
                  { color: active ? meta.fg : colors.text },
                ]}
              >
                {item.value}
              </Text>
              <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  cell: { flex: 1, alignItems: 'center', gap: 4 },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 11 },
  divider: { width: StyleSheet.hairlineWidth, height: 44 },
});
