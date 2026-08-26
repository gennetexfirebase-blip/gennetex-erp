import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, LoadingState, ErrorState } from '../components/ui';
import { useApp } from '../context/AppContext';
import * as attApi from '../services/attendanceService';
import { colors } from '../theme/attendanceLight';
import { spacing } from '../theme';

function monthRange(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const toKey = (x) => x.toISOString().slice(0, 10);
  const label = `${toKey(start).replace(/-/g, '.')} - ${toKey(end).replace(/-/g, '.')}`;
  return { start: toKey(start), end: toKey(end), label };
}

function minutesToHours(mins) {
  return Math.round(((mins || 0) / 60) * 10) / 10;
}

export default function AttendanceMonthlySummaryScreen() {
  const navigation = useNavigation();
  const { currentUser } = useApp();
  const profile = currentUser;

  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = useMemo(() => monthRange(offset), [offset]);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await attApi.fetchAttendanceSummary(profile.id, range.start, range.end);
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    let workedMinutes = 0;
    let expectedMinutes = 0;
    let absentDays = 0;
    rows.forEach((r) => {
      // Амралт, чөлөө, ирээгүй, ХУВААРЬГҮЙ өдрийг тооцоонд оруулахгүй.
      if (['rest', 'leave', 'upcoming', 'not_scheduled'].includes(r.status)) return;
      if (r.shift_start && r.shift_end) {
        const [sh, sm] = r.shift_start.split(':').map(Number);
        const [eh, em] = r.shift_end.split(':').map(Number);
        expectedMinutes += Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }
      if (r.worked_minutes) workedMinutes += r.worked_minutes;
      if (r.status === 'absent') absentDays += 1;
    });
    return {
      workedMinutes,
      expectedMinutes,
      pct: expectedMinutes > 0 ? Math.round((workedMinutes / expectedMinutes) * 100) : 0,
      missedMinutes: Math.max(0, expectedMinutes - workedMinutes),
    };
  }, [rows]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Сараар" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => setOffset((o) => o - 1)} style={styles.monthArrow}>
            <Text style={{ color: colors.primary, fontSize: 18 }}></Text>
          </TouchableOpacity>
          <View style={[styles.monthPill, { borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{range.label}</Text>
          </View>
          <TouchableOpacity onPress={() => setOffset((o) => Math.min(0, o + 1))} style={styles.monthArrow}>
            <Text style={{ color: colors.primary, fontSize: 18 }}></Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <LoadingState text="Ачаалж байна..." />
        ) : error ? (
          <ErrorState text={error} onRetry={load} />
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Ажилласан цаг</Text>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                Нийт: {minutesToHours(totals.workedMinutes)}ц / {minutesToHours(totals.expectedMinutes)}ц (
                {totals.pct}%)
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.primarySoft }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.primary, width: `${Math.min(100, totals.pct)}%` },
                  ]}
                />
              </View>
              <View style={styles.rowBetween}>
                <Text style={{ color: colors.textMuted }}>Хуваарьт</Text>
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {minutesToHours(totals.expectedMinutes)}ц {'>'}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.md }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Ажиллаагүй цаг</Text>
                <Text style={{ color: colors.textMuted }}>Нийт: {minutesToHours(totals.missedMinutes)}ц</Text>
              </View>
              <TouchableOpacity
                style={[styles.detailBtn, { borderColor: colors.border }]}
                onPress={() => navigation.navigate('AttendanceHistory', { start: range.start, end: range.end })}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Дэлгэрэнгүй бүртгэл</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: spacing.lg },
  monthArrow: { padding: 8 },
  monthPill: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 },
  card: { borderRadius: 18, padding: spacing.lg },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  detailBtn: { marginTop: spacing.md, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
