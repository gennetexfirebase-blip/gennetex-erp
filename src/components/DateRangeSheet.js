import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { dayKey } from '../lib/workHours';

function shiftDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/**
 * Огнооны хурдан сонголт — Өнөөдөр / Өчигдөр / 7 хоног / Сар.
 *
 * Төсөлд date-picker сан суугаагүй тул (`package.json`-д
 * `@react-native-community/datetimepicker` алга) урьдчилсан сонголт +
 * өдрөөр урагш/хойш алхах товчоор шийдэв. Ингэснээр шинэ хамаарал
 * нэмэхгүйгээр "өчигдөр рүү орсон бол буцаж чадахгүй" мухардлыг арилгана.
 */
export default function DateRangeSheet({ visible, onClose, onSelect, current, colors }) {
  const options = [
    { key: 'today', label: 'Өнөөдөр', value: dayKey() },
    { key: 'yesterday', label: 'Өчигдөр', value: shiftDays(-1) },
    { key: 'week', label: 'Энэ 7 хоног', value: shiftDays(-7) },
    { key: 'month', label: 'Энэ сар', value: shiftDays(-30) },
  ];

  const step = (n) => {
    const d = new Date(current);
    d.setDate(d.getDate() + n);
    const next = dayKey(d);
    // Ирээдүй рүү явахыг хориглоно — ирээгүй өдрийн ирц гэж байхгүй.
    if (next > dayKey()) return;
    onSelect(next);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
          <Text style={[styles.title, { color: colors.text }]}>Огноо сонгох</Text>

          <View style={styles.stepRow}>
            <TouchableOpacity
              style={[styles.stepBtn, { backgroundColor: colors.surfaceContainer }]}
              onPress={() => step(-1)}
            >
              <Text style={{ color: colors.primary, fontSize: 18 }}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.currentDate, { color: colors.text }]}>{current}</Text>
            <TouchableOpacity
              style={[
                styles.stepBtn,
                { backgroundColor: colors.surfaceContainer, opacity: current >= dayKey() ? 0.4 : 1 },
              ]}
              disabled={current >= dayKey()}
              onPress={() => step(1)}
            >
              <Text style={{ color: colors.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </View>

          {options.map((opt) => {
            const active = current === opt.value;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.row, active && { backgroundColor: colors.primarySoft }]}
                onPress={() => onSelect(opt.value)}
              >
                <Text style={{ color: active ? colors.primary : colors.text, fontWeight: active ? '700' : '400' }}>
                  {opt.label}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{opt.value}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={{ color: colors.onPrimary || '#fff', fontWeight: '700' }}>Хаах</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 16 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  currentDate: { fontSize: 16, fontWeight: '700', minWidth: 110, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  closeBtn: { marginTop: 14, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
