import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayKey } from '../lib/workHours';

const WEEKDAYS = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];

function shiftDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/**
 * Огноо сонгох bottom sheet — хурдан сонголт + бүтэн сарын календарь.
 *
 * Төсөлд date-picker сан суугаагүй (`@react-native-community/datetimepicker`
 * алга) тул календарийг өөрсдөө зурав — шинэ хамаарал нэмэхгүй бөгөөд
 * харагдах байдлыг бүрэн удирдана.
 */
export default function DateRangeSheet({ visible, onClose, onSelect, current, colors }) {
  const today = dayKey();
  const [draft, setDraft] = useState(current || today);
  const [cursor, setCursor] = useState(() => new Date(current || today));

  // Sheet нээгдэх бүрд одоогийн сонголт руу буцна.
  useEffect(() => {
    if (visible) {
      setDraft(current || today);
      setCursor(new Date(current || today));
    }
  }, [visible, current]);

  const presets = [
    { key: 'today', label: 'Өнөөдөр', value: today },
    { key: 'yesterday', label: 'Өчигдөр', value: shiftDays(-1) },
    { key: 'week', label: 'Энэ 7 хоног', value: shiftDays(-7) },
    { key: 'month', label: 'Энэ сар', value: shiftDays(-30) },
  ];

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  /** Сарын нүднүүд — өмнөх/дараах сарын үлдэгдэл өдрүүдтэй хамт. */
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startDow = (first.getDay() + 6) % 7; // Даваа = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const out = [];
    for (let i = startDow - 1; i >= 0; i--) {
      out.push({ day: prevDays - i, date: new Date(year, month - 1, prevDays - i), outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, date: new Date(year, month, d), outside: false });
    }
    // Сүүлийн мөрийг бүтэн болгоно
    while (out.length % 7 !== 0) {
      const d = out.length - startDow - daysInMonth + 1;
      out.push({ day: d, date: new Date(year, month + 1, d), outside: true });
    }
    return out;
  }, [year, month]);

  const stepMonth = (n) => setCursor(new Date(year, month + n, 1));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
          <Text style={[styles.title, { color: colors.text }]}>Огноо сонгох</Text>

          {/* Хурдан сонголт */}
          <View style={styles.presetRow}>
            {presets.map((p) => {
              const active = draft === p.value;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.preset,
                    { backgroundColor: active ? colors.primary : colors.surfaceContainer },
                  ]}
                  onPress={() => {
                    setDraft(p.value);
                    setCursor(new Date(p.value));
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.onPrimary : colors.textMuted,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Сар сэлгэх */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => stepMonth(-1)} hitSlop={12} style={styles.monthArrow}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
              {year} оны {month + 1}-р сар
            </Text>
            <TouchableOpacity onPress={() => stepMonth(1)} hitSlop={12} style={styles.monthArrow}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Гарагийн толгой */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={[styles.weekday, { color: colors.textMuted }]}>
                {w}
              </Text>
            ))}
          </View>

          {/* Өдрүүд */}
          <View style={styles.grid}>
            {cells.map((c, i) => {
              const key = dayKey(c.date);
              const selected = key === draft;
              const isToday = key === today;
              const future = key > today;
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.cell}
                  disabled={future}
                  onPress={() => setDraft(key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dayCircle, selected && { backgroundColor: colors.primary }]}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: selected || isToday ? '700' : '400',
                        color: selected
                          ? colors.onPrimary
                          : future || c.outside
                            ? colors.textFaint
                            : colors.text,
                      }}
                    >
                      {c.day}
                    </Text>
                  </View>
                  {isToday && !selected ? (
                    <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Сонгосон огноо */}
          <View style={[styles.selectedRow, { backgroundColor: colors.surfaceContainer }]}>
            <Ionicons name="calendar-outline" size={17} color={colors.textMuted} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{draft}</Text>
            {draft === today ? (
              <View style={[styles.todayChip, { backgroundColor: colors.primary + '28' }]}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Өнөөдөр</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              onSelect(draft);
              onClose();
            }}
          >
            <Text style={{ color: colors.onPrimary, fontSize: 16, fontWeight: '700' }}>Сонгох</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 16 },

  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  preset: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthArrow: { padding: 4 },

  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 5 },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  todayChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 'auto' },
  confirmBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
});
