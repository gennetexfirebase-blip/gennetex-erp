import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, LoadingState, ErrorState, EmptyState, StatusPill } from '../components/ui';
import { useApp } from '../context/AppContext';
import * as attApi from '../services/attendanceService';
import { formatDuration } from '../lib/workHours';
import { colors } from '../theme/attendanceLight';
import { spacing } from '../theme';

const STATUS_LABEL = {
  on_time: 'Ирсэн',
  late: 'Хоцорсон',
  early_leave: 'Эрт явсан',
  absent: 'Тасалсан',
  leave: 'Чөлөөтэй',
  rest: 'Амралт',
  upcoming: 'Ирээгүй',
  not_scheduled: 'Хуваарьгүй',
};

const STATUS_TONE = {
  on_time: 'success',
  late: 'danger',
  early_leave: 'warning',
  absent: 'danger',
  leave: 'info',
  rest: 'neutral',
  upcoming: 'neutral',
  not_scheduled: 'neutral',
};

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toKey = (x) => x.toISOString().slice(0, 10);
  return { start: toKey(start), end: toKey(end) };
}

function fmtTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
}

export default function AttendanceHistoryScreen() {
  const route = useRoute();
  const { currentUser } = useApp();
  const profile = currentUser;
  const range = route.params?.start && route.params?.end
    ? { start: route.params.start, end: route.params.end }
    : defaultRange();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setError(null);
    try {
      const data = await attApi.fetchAttendanceSummary(profile.id, range.start, range.end);
      setRows((data || []).slice().reverse());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ScreenHeader title="Ирцийн түүх" />
        <LoadingState text="Ачаалж байна..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Ирцийн түүх" subtitle={`${range.start} – ${range.end}`} />
      {error ? (
        <ErrorState text={error} onRetry={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.work_date}
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<EmptyState text="Ирцийн бүртгэл олдсонгүй" />}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.work_date}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                  {item.shift_start && item.shift_end ? `${item.shift_start} – ${item.shift_end}` : 'Хуваарьгүй'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                  Ирсэн {fmtTime(item.check_in_at)} · Явсан {fmtTime(item.check_out_at)}
                  {item.worked_minutes ? ` · ${formatDuration(item.worked_minutes * 60000)}` : ''}
                </Text>
                {item.late_minutes > 0 ? (
                  <Text style={{ color: colors.danger, fontSize: 12, marginTop: 2 }}>Хоцорсон: {item.late_minutes}м</Text>
                ) : null}
                {item.is_remote ? (
                  <Text style={{ color: colors.primary, fontSize: 12, marginTop: 2 }}>Зайнаас</Text>
                ) : null}
              </View>
              <StatusPill text={STATUS_LABEL[item.status] || item.status} tone={STATUS_TONE[item.status] || 'neutral'} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
