import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useStyles } from '../context/ThemeContext';
import AttendanceClockCard from './AttendanceClockCard';
import { Avatar, Box, IconRow, ModuleTile, RoundButton, SectionHeader } from './ds';

/**
 * Ажилтны «Ирц» таб (design §4 Ирц — ажилтан).
 * Header (зураг → Профайл, нэр, компани, мэдэгдэл, тохиргоо) → том карт →
 * Чөлөө хүсэх / Хуваарь / Тайлан → түүх, нэгтгэл.
 */
export default function EmployeeAttendanceSummary({
  profile,
  shiftStatus,
  busy,
  scheduleLabel,
  onCheckIn,
  onCheckOut,
  onRefresh,
  error,
  targetMinutes,
  location = {},
  companyLabel = 'Женнетекс ХХК',
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();

  const quick = [
    { key: 'AttendanceRequestForm', label: 'Чөлөө хүсэх', icon: 'calendar-plus', tone: 'teal' },
    { key: 'MyShift', label: 'Хуваарь', icon: 'clock', tone: 'indigo' },
    { key: 'AttendanceMonthlySummary', label: 'Тайлан', icon: 'clipboard-text', tone: 'purple' },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={!!busy} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          <View style={styles.ihead}>
            <Pressable onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel="Профайл">
              <Avatar uri={profile?.avatar_url} name={profile?.name} size={46} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>{profile?.name || 'Ажилтан'}</Text>
              <Text style={styles.company} numberOfLines={1}>
                {[companyLabel, location.name].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <RoundButton icon="notifications-outline" onPress={() => navigation.navigate('Notifications')} accessibilityLabel="Мэдэгдэл" />
            <RoundButton icon="settings-outline" onPress={() => navigation.navigate('NotificationSettings')} accessibilityLabel="Тохиргоо" />
          </View>

          <AttendanceClockCard
            shiftStatus={shiftStatus}
            busy={busy}
            onCheckIn={onCheckIn}
            onCheckOut={onCheckOut}
            targetMinutes={targetMinutes}
            locationName={location.name}
            locationDistance={location.distance}
            locationWithin={location.within}
            locationNote={location.note}
            workHoursText={scheduleLabel}
            footer={
              <>
                {busy ? <Text accessibilityLiveRegion="polite" style={[styles.note, { color: colors.brand }]}>Ирц бүртгэж байна…</Text> : null}
                {error ? <Text accessibilityRole="alert" style={[styles.note, { color: colors.bad }]}>{error}</Text> : null}
              </>
            }
          />

          <View style={styles.qa}>
            {quick.map((q) => (
              <Pressable
                key={q.key}
                style={({ pressed }) => [styles.short, pressed && { opacity: 0.8 }]}
                onPress={() => navigation.navigate(q.key)}
                accessibilityRole="button"
              >
                <ModuleTile icon={q.icon} tone={q.tone} size={46} radius={15} iconSize={24} />
                <Text style={styles.shortLabel} numberOfLines={1}>{q.label}</Text>
              </Pressable>
            ))}
          </View>

          <SectionHeader title="Миний ирц" />
          <Box style={{ paddingVertical: 4 }}>
            <IconRow first icon="time-outline" tone="blue" title="Ирцийн түүх" sub="Сүүлийн өдрүүдийн ирсэн, явсан цаг" onPress={() => navigation.navigate('AttendanceHistory')} />
            <IconRow icon="stats-chart-outline" tone="green" title="Сарын нэгтгэл" sub="Ирсэн өдөр, хоцорсон, ажилласан цаг" onPress={() => navigation.navigate('AttendanceMonthlySummary')} />
            <IconRow icon="paper-plane-outline" tone="purple" title="Хүсэлт илгээх" sub="Нөхөж бүртгүүлэх, зайнаас бүртгүүлэх" onPress={() => navigation.navigate('AttendanceRequestForm')} />
          </Box>
          <Text style={styles.hint}>
            Ирэхдээ товчийг баруун тийш, ажлаа дуусгаад зүүн тийш чирнэ. Байршлыг бүртгэх үед шалгана.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    body: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 },
    ihead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingBottom: 18 },
    name: { color: colors.ink, fontSize: 18, fontWeight: '700' },
    company: { color: colors.muted, fontSize: 13 },
    note: { fontSize: 13, textAlign: 'center', marginTop: 10 },
    qa: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    short: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingTop: 14,
      paddingBottom: 12,
      alignItems: 'center',
      gap: 8,
      ...shadow.md,
    },
    shortLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    hint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 4, marginHorizontal: 4 },
  });
