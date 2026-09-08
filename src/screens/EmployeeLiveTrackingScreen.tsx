import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import TrackingMap, { TrackingMapHandle } from '../tracking/components/TrackingMap';
import EmployeeTrackingCard from '../tracking/components/EmployeeTrackingCard';
import { useTrackingClock } from '../tracking/hooks/useLiveEmployees';
import { useEmployeeLocation } from '../tracking/hooks/useEmployeeLocation';
import { useEmployeeRoute } from '../tracking/hooks/useEmployeeRoute';
import { routeDistance, trackingDay } from '../tracking/utils/locationUtils';
export default function EmployeeLiveTrackingScreen({ route, navigation }: any) {
  const { isAdmin, isCloud, calls } = useApp(); const { colors } = useTheme(); const focused = useIsFocused();
  const id = route.params?.employeeId; const now = useTrackingClock(); const allowed = isAdmin && isCloud && focused;
  const { point, error } = useEmployeeLocation(id, allowed);
  const { points, error: routeError } = useEmployeeRoute(allowed ? id : undefined, trackingDay(now));
  const map = useRef<TrackingMapHandle>(null); const [follow, setFollow] = useState(true); const [satellite, setSatellite] = useState(false);
  const distance = useMemo(() => routeDistance(points), [points]);
  const current = useMemo(() => point ? [point] : [], [point]);
  const sites = useMemo(() => ((calls || []) as any[]).filter((c: any) => c.latitude != null && c.longitude != null).map((c: any) => ({ latitude: Number(c.latitude), longitude: Number(c.longitude), name: c.customer })), [calls]);
  const actions: [string, () => void][] = [[`Follow ${follow ? 'ON' : 'OFF'}`, () => { setFollow(!follow); if (!follow) map.current?.command('current'); }], ['Route', () => { setFollow(false); map.current?.command('route'); }], ['Current', () => map.current?.command('current')], [`Satellite ${satellite ? 'ON' : 'OFF'}`, () => setSatellite(!satellite)]];
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={{ padding: 16, minHeight: 48 }}><Text style={{ color: colors.primary }}>‹ Байршил</Text></Pressable>
    {!isAdmin || !isCloud ? <Text style={{ padding: 20, color: colors.text }}>Зөвхөн админ хандах эрхтэй.</Text> :
      <FlatList data={points} keyExtractor={p => String(p.timestamp)} initialNumToRender={12} maxToRenderPerBatch={20}
        ListHeaderComponent={<>
          {(error || routeError) && <Text style={{ padding: 12, color: '#b91c1c' }}>{error || routeError}</Text>}
          {point ? <EmployeeTrackingCard point={point} now={now} /> : <Text style={{ padding: 16, color: colors.textMuted }}>Ажилтны байршил хүлээж байна…</Text>}
          <View style={{ padding: 16 }}><Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Өнөөдөр · {distance.toFixed(2)} км</Text><Text style={{ color: colors.textMuted }}>{trackingDay(now)} · {points.length} GPS цэг</Text></View>
          <View style={{ height: 400 }}><TrackingMap ref={map} employees={current} points={points} sites={sites} selected={id} follow={follow} satellite={satellite} now={now} onPan={() => setFollow(false)} /></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 }}>{actions.map(([label, action]) => <Pressable key={label} onPress={action} accessibilityRole="button" style={{ padding: 14, borderRadius: 14, backgroundColor: colors.surface }}><Text style={{ color: colors.primary }}>{label}</Text></Pressable>)}</View>
          <Text style={{ padding: 16, color: colors.text, fontSize: 20, fontWeight: '700' }}>Өнөөдрийн зам</Text>
        </>}
        ListEmptyComponent={<Text style={{ color: colors.textMuted, padding: 16 }}>Өнөөдрийн замын түүх хараахан бүрдээгүй.</Text>}
        renderItem={({ item, index }) => <View style={{ paddingVertical: 10, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ color: colors.text }}>{new Date(item.timestamp).toLocaleTimeString('mn-MN', { timeZone: 'Asia/Ulaanbaatar', hour: '2-digit', minute: '2-digit', second: '2-digit' })} — {index === 0 ? 'Эхэлсэн байршил' : index === points.length - 1 ? 'Сүүлийн замын цэг' : `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`}</Text>
        </View>} />}
  </SafeAreaView>;
}
