import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { ScreenHeader, Card } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as shiftApi from '../services/shiftService';
import { dayKey, formatDuration, calculateDayWork } from '../lib/workHours';
import {
  WEEKDAYS,
  mergeRestDays,
  formatRestDaysSummary,
  weekdayLabel,
  isRestDay,
  isoWeekday,
} from '../lib/breakSchedule';

function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

function formatDayLabel(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  const w = WEEKDAYS.find((x) => x.day === isoWeekday(d));
  return `${w?.label || ''} · ${dateKey}`;
}

export default function MyShiftScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, isCloud } = useApp();
  const [loading, setLoading] = useState(true);
  const [todayShift, setTodayShift] = useState(null);
  const [restDays, setRestDays] = useState([]);
  const [weekShifts, setWeekShifts] = useState([]);
  const [weekAttendance, setWeekAttendance] = useState([]);
  const [dayDetail, setDayDetail] = useState(null);

  const today = dayKey();
  const { from: weekFrom, to: weekTo } = shiftApi.weekRange();

  const load = useCallback(async () => {
    if (!isCloud || !currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [shift, restRows, shifts, attendance] = await Promise.all([
        shiftApi.fetchMyShift(currentUser.id, today),
        shiftApi.fetchBreakScheduleForUser(currentUser.id),
        shiftApi.fetchMyShiftsInRange(currentUser.id, weekFrom, weekTo),
        shiftApi.fetchAttendanceForUserRange(currentUser.id, weekFrom, weekTo),
      ]);
      setTodayShift(shift);
      setRestDays(mergeRestDays(restRows));
      setWeekShifts(shifts);
      setWeekAttendance(attendance);
    } catch (e) {
      // алдааг дэлгэц дээр харуулахгүй
    } finally {
      setLoading(false);
    }
  }, [isCloud, currentUser?.id, today, weekFrom, weekTo]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const todayIsRest = isRestDay(restDays);
  const todayWork = calculateDayWork({
    attendance: weekAttendance,
    dateKey: today,
  });

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const dk = addDays(weekFrom, i);
    weekDays.push(dk);
  }

  const hoursForDate = (dateKey) => {
    const rest = isRestDay(restDays, new Date(`${dateKey}T12:00:00`));
    const summary = calculateDayWork({ attendance: weekAttendance, dateKey });
    return { rest, ...summary };
  };

  const weekTotalMs = weekDays.reduce((sum, dk) => {
    const { rest, netMs } = hoursForDate(dk);
    return sum + (rest ? 0 : netMs);
  }, 0);

  const openDay = (dateKey) => {
    const shift = weekShifts.find((s) => s.shift_date === dateKey) || null;
    const hours = hoursForDate(dateKey);
    setDayDetail({ dateKey, shift, ...hours });
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Хуваарь харах" subtitle="Нэвтэрнэ үү"/>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Хуваарь харах"
        subtitle={currentUser.name || ''}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Өнөөдөр */}
          <Card>
            <Text style={styles.blockTitle}> Өнөөдрийн ажлын хуваарь</Text>
            {todayIsRest ? (
              <Text style={styles.restBadge}> Амралтын өдөр</Text>
            ) : todayShift ? (
              <Text style={styles.shiftLine}>
                {todayShift.start_time} – {todayShift.end_time}
                {todayShift.location_name ? `\n ${todayShift.location_name}` : ''}
              </Text>
            ) : (
              <Text style={styles.muted}>Өнөөдрийн хуваарь оноогдоогүй.</Text>
            )}
            {todayShift?.note ? <Text style={styles.muted}>{todayShift.note}</Text> : null}
          </Card>

          {/* Ажилласан цаг */}
          <Card style={{ marginTop: spacing.sm }}>
            <Text style={styles.blockTitle}>Нийт ажилласан цаг</Text>
            <View style={styles.hoursHero}>
              <View style={styles.hoursCol}>
                <Text style={styles.hoursLabel}>Өнөөдөр</Text>
                <Text style={styles.hoursBig}>
                  {todayIsRest ? '—' : formatDuration(todayWork.netMs)}
                </Text>
              </View>
              <View style={styles.hoursDivider} />
              <View style={styles.hoursCol}>
                <Text style={styles.hoursLabel}>Энэ долоо хоног</Text>
                <Text style={styles.hoursBig}>{formatDuration(weekTotalMs)}</Text>
              </View>
            </View>
            {!todayIsRest && todayWork.pairs.length > 0 ? (
              todayWork.pairs.map((p, i) => (
                <View key={i} style={styles.pairRow}>
                  <Text style={styles.pairText}>
                    {new Date(p.checkIn.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit'})}
                    {' – '}
                    {new Date(p.checkOut.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit'})}
                  </Text>
                  <Text style={styles.pairDur}>{formatDuration(p.ms)}</Text>
                </View>
              ))
            ) : !todayIsRest ? (
              <Text style={styles.muted}>Өнөөдөр ирц бүртгэгдээгүй.</Text>
            ) : null}
          </Card>

          {/* Амралтын өдөр */}
          {restDays.some((d) => d.is_rest) ? (
            <Card style={{ marginTop: spacing.sm }}>
              <Text style={styles.blockTitle}> Амралтын өдөр</Text>
              <Text style={styles.muted}>{formatRestDaysSummary(restDays)}</Text>
            </Card>
          ) : null}

          {/* Долоо хоногийн хуваарь */}
          <Card style={{ marginTop: spacing.sm }}>
            <Text style={styles.blockTitle}> Энэ долоо хоног</Text>
            <Text style={styles.muted}>{weekFrom} – {weekTo}</Text>
            {weekDays.map((dk) => {
              const shift = weekShifts.find((s) => s.shift_date === dk);
              const rest = isRestDay(restDays, new Date(`${dk}T12:00:00`));
              const { netMs } = hoursForDate(dk);
              const isToday = dk === today;
              return (
                <TouchableOpacity
                  key={dk}
                  style={[styles.dayRow, isToday && styles.dayRowToday]}
                  onPress={() => openDay(dk)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayTitle, isToday && styles.dayTitleToday]}>
                      {formatDayLabel(dk)}{isToday ? ' (өнөөдөр)' : ''}
                    </Text>
                    {rest ? (
                      <Text style={styles.restSmall}>Амралтын өдөр</Text>
                    ) : shift ? (
                      <Text style={styles.daySub}>
                        {shift.start_time}–{shift.end_time}
                        {shift.location_name ? ` · ${shift.location_name}` : ''}
                      </Text>
                    ) : (
                      <Text style={styles.daySub}>Хуваарьгүй</Text>
                    )}
                  </View>
                  <Text style={styles.dayHours}>
                    {rest ? '—' : formatDuration(netMs)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Card>
        </ScrollView>
      )}

      <Modal visible={!!dayDetail} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {dayDetail ? (
              <>
                <Text style={styles.sheetTitle}>{formatDayLabel(dayDetail.dateKey)}</Text>
                {dayDetail.rest ? (
                  <Text style={styles.restBadge}> Амралтын өдөр</Text>
                ) : dayDetail.shift ? (
                  <Text style={styles.shiftLine}>
                    Хуваарь: {dayDetail.shift.start_time} – {dayDetail.shift.end_time}
                    {dayDetail.shift.location_name ? `\n ${dayDetail.shift.location_name}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.muted}>Энэ өдөр хуваарь оноогдоогүй.</Text>
                )}
                <Text style={[styles.blockTitle, { marginTop: spacing.md }]}>
                  Ажилласан: {dayDetail.rest ? '—' : formatDuration(dayDetail.netMs)}
                </Text>
                {dayDetail.pairs?.map((p, i) => (
                  <View key={i} style={styles.pairRow}>
                    <Text style={styles.pairText}>
                      {new Date(p.checkIn.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit'})}
                      {' – '}
                      {new Date(p.checkOut.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit'})}
                    </Text>
                    <Text style={styles.pairDur}>{formatDuration(p.ms)}</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setDayDetail(null)}>
                  <Text style={styles.closeText}>Хаах</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 110 },
  blockTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm },
  shiftLine: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '600'},
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  restBadge: { color: colors.accent, fontSize: 15, fontWeight: '800'},
  restSmall: { color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 2 },
  hoursHero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  hoursCol: { flex: 1, alignItems: 'center'},
  hoursDivider: { width: 1, height: 48, backgroundColor: colors.border },
  hoursLabel: { color: colors.textMuted, fontSize: 12 },
  hoursBig: { color: colors.primary, fontSize: 22, fontWeight: '800', marginTop: 4 },
  pairRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pairText: { color: colors.text, fontSize: 14 },
  pairDur: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayRowToday: { backgroundColor: colors.primary + '08', marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md },
  dayTitle: { color: colors.text, fontSize: 14, fontWeight: '700'},
  dayTitleToday: { color: colors.primary },
  daySub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  dayHours: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '75%',
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  closeBtn: { marginTop: spacing.lg, alignItems: 'center', padding: spacing.md },
  closeText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
});
