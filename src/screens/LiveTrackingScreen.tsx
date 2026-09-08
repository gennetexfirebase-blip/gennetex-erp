import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import TrackingMap from '../tracking/components/TrackingMap';
import TrackingBottomSheet from '../tracking/components/TrackingBottomSheet';
import { useLiveEmployees, useTrackingClock } from '../tracking/hooks/useLiveEmployees';
import { trackingStatus } from '../tracking/utils/locationUtils';
const filters = [['all', 'Бүгд'], ['online', 'Online'], ['offline', 'Offline'], ['moving', 'Замд'], ['stopped', 'Зогсож байна']];
export default function LiveTrackingScreen({ navigation }: any) {
  const { isAdmin, isCloud } = useApp(); const { colors } = useTheme(); const focused = useIsFocused();
  const { employees, loading, error } = useLiveEmployees(isAdmin && isCloud && focused);
  const now = useTrackingClock(); const [filter, setFilter] = useState('all'); const [selected, select] = useState<string>();
  const shown = useMemo(() => employees.filter(p => filter === 'all' ||
    (filter === 'online' && trackingStatus(p, now) === 'online') || (filter === 'offline' && trackingStatus(p, now) === 'offline') ||
    (filter === 'moving' && trackingStatus(p, now) !== 'offline' && (p.speed || 0) >= 0.5) ||
    (filter === 'stopped' && trackingStatus(p, now) !== 'offline' && p.speed != null && p.speed < 0.5)), [employees, filter, now]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
    <View style={{ padding: 16, gap: 10 }}><Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>‹ Буцах</Text></Pressable>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700' }}>LIVE TRACKING</Text>
      <Text style={{ color: colors.textMuted }}>{shown.length} ажилтан · Байршлын шууд хяналт</Text>
    </View>
    {!isAdmin || !isCloud ? <Text style={{ color: colors.text, padding: 20 }}>Энэ хэсэгт нэвтэрсэн админ хандах эрхтэй.</Text> : <>
      <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>{filters.map(([id, label]) => <Pressable key={id} onPress={() => setFilter(id)} accessibilityRole="button" accessibilityState={{ selected: filter === id }} style={{ backgroundColor: filter === id ? colors.primary : colors.surface, padding: 14, borderRadius: 14 }}><Text style={{ color: filter === id ? '#fff' : colors.text }}>{label}</Text></Pressable>)}</ScrollView>
      {loading && <ActivityIndicator color={colors.primary} />}
      {error && <Text accessibilityLiveRegion="polite" style={{ color: colors.danger || '#b91c1c', padding: 12 }}>{error}</Text>}
      {!loading && !shown.length && <Text style={{ padding: 12, color: colors.textMuted }}>Энэ шүүлтэд байршил алга. Ажилтан ирцээ бүртгэж, GPS зөвшөөрсөн үед харагдана.</Text>}
      <TrackingMap employees={shown} now={now} onSelect={select} />
      <TrackingBottomSheet point={employees.find(p => p.employee_id === selected)} now={now} onClose={() => select(undefined)} onDetail={() => { const employeeId = selected; select(undefined); navigation.navigate('EmployeeLiveTracking', { employeeId }); }} />
    </>}
  </SafeAreaView>;
}
