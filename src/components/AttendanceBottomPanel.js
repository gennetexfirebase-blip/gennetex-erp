import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/** Map screen-ийн доод, rounded-top цагаан панел — товч 2 + өнөөдрийн хуваарийн мөр. */
export default function AttendanceBottomPanel({
  colors,
  onPressSummary,
  onPressRequest,
  dateLabel,
  scheduleLabel,
}) {
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface }]}>
      <View style={styles.handle} />
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={onPressSummary}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Цаг бүртгэл</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.primarySoft }]}
          onPress={onPressRequest}
          activeOpacity={0.85}
        >
          <Text style={[styles.secondaryText, { color: colors.primary }]}>Хүсэлт</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.scheduleRow}>
        <Text style={[styles.scheduleLeft, { color: colors.text }]}>Өнөөдөр</Text>
        <Text style={[styles.scheduleRight, { color: colors.textMuted }]}>
          {dateLabel} · {scheduleLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 14,
  },
  row: { flexDirection: 'row', gap: 12 },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '700' },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  scheduleLeft: { fontSize: 13, fontWeight: '600' },
  scheduleRight: { fontSize: 13 },
});
