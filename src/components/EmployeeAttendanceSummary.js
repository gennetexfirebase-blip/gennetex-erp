import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import HeaderAccountActions from './HeaderAccountActions';
import { Button, Card } from './ui';

export default function EmployeeAttendanceSummary({ profile, shiftStatus, busy, scheduleLabel, dateLabel, onCheckIn, onCheckOut, onRefresh, error }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const time = (value) => value ? new Date(value).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }) : '—';
  const status = shiftStatus.checkedOut ? 'Өнөөдрийн бүртгэл дууссан' : shiftStatus.checkedIn ? 'Ажиллаж байна' : 'Ирцээ бүртгүүлээрэй';
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}><View style={styles.header}><View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.text }]}>Миний ирц</Text><Text style={{ color: colors.textMuted, marginTop: 4 }}>{profile?.name}</Text></View><HeaderAccountActions /></View></SafeAreaView>
    <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={busy} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <Text style={[styles.date, { color: colors.textMuted }]}>{dateLabel}</Text>
      <Card style={{ padding: 24 }}>
        <View style={[styles.statusIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name={shiftStatus.checkedOut ? 'checkmark-done-outline' : 'time-outline'} size={30} color={colors.primary} /></View>
        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.text }]}>{status}</Text>
        <Text style={[styles.schedule, { color: colors.textMuted }]}>Ажлын хуваарь: {scheduleLabel}</Text>
        <View style={[styles.times, { borderColor: colors.border }]}>
          <View style={styles.timeCell}><Text style={{ color: colors.textMuted }}>Ирсэн</Text><Text style={[styles.time, { color: colors.text }]}>{time(shiftStatus.checkInAt)}</Text></View>
          <View style={styles.timeCell}><Text style={{ color: colors.textMuted }}>Явсан</Text><Text style={[styles.time, { color: colors.text }]}>{time(shiftStatus.checkOutAt)}</Text></View>
        </View>
        <View style={styles.actions}>
          <Button title="Ирлээ" icon="→" onPress={onCheckIn} disabled={busy || shiftStatus.checkedIn} style={{ flex: 1 }} size="lg" />
          <Button title="Явлаа" icon="←" onPress={onCheckOut} disabled={busy || !shiftStatus.checkedIn || shiftStatus.checkedOut} style={{ flex: 1 }} size="lg" variant="ghost" />
        </View>
        {busy && <Text accessibilityLiveRegion="polite" style={[styles.schedule, { color: colors.primary }]}>Ирц бүртгэж байна…</Text>}
        {!!error && <Text accessibilityRole="alert" style={[styles.schedule, { color: colors.danger }]}>{error}</Text>}
      </Card>
      <Text style={[styles.hint, { color: colors.textMuted }]}>Ирэхдээ “Ирлээ”, ажлаа дуусгаад “Явлаа” товчийг дарна. Байршлыг бүртгэх үед шалгана.</Text>
      <View style={styles.links}>
        <Button variant="ghost" title="Ирцийн түүх" onPress={() => navigation.navigate('AttendanceHistory')} />
        <Button variant="ghost" title="Сарын нэгтгэл" onPress={() => navigation.navigate('AttendanceMonthlySummary')} />
        <Button variant="ghost" title="Миний хуваарь" onPress={() => navigation.navigate('MyShift')} />
        <Button variant="ghost" title="Хүсэлт илгээх" onPress={() => navigation.navigate('AttendanceRequestForm')} />
      </View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ header: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { fontSize: 24, fontWeight: '700' }, body: { padding: 18, paddingBottom: 140 }, date: { fontSize: 13, marginBottom: 16 }, statusIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }, status: { fontSize: 22, fontWeight: '700', textAlign: 'center', lineHeight: 28 }, schedule: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 }, times: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 22, marginVertical: 24 }, timeCell: { flex: 1, alignItems: 'center' }, time: { fontSize: 28, fontWeight: '700', marginTop: 8, fontVariant: ['tabular-nums'] }, actions: { flexDirection: 'row', gap: 12 }, hint: { fontSize: 13, lineHeight: 21, marginVertical: 12 }, links: { gap: 10, marginTop: 12 } });
