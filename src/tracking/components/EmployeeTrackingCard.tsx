import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { LocationPoint, accuracyLabel, lastSeen } from '../utils/locationUtils';
import TrackingStatusBadge from './TrackingStatusBadge';
import { openLocationInMaps } from '../services/deviceMaps';
export default function EmployeeTrackingCard({ point, now }: { point: LocationPoint; now: number }) {
  const { colors } = useTheme();
  const metrics = [['Хурд', point.speed == null ? '—' : `${(point.speed * 3.6).toFixed(1)} km/h`],
    ['Чиглэл', point.heading == null ? '—' : `${Math.round(point.heading)}°`],
    ['GPS', point.accuracy == null ? '—' : `±${Math.round(point.accuracy)}m · ${accuracyLabel(point.accuracy)}`],
    ['Батарей', point.battery == null ? '—' : `${point.battery}%`]];
  return <View style={{ padding: 18, gap: 10, backgroundColor: colors.surface, borderRadius: 20 }}>
    <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>{point.name || point.employee_id}</Text>
    <TrackingStatusBadge point={point} now={now} />
    <Text style={{ color: colors.textMuted }}>Сүүлд шинэчлэгдсэн / Last seen: {lastSeen(point.timestamp, now)}</Text>
    <Text style={{ color: colors.text }}>{new Date(point.timestamp).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}</Text>
    <Text selectable style={{ color: colors.text, fontSize: 17 }}>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text>
    <Pressable accessibilityRole="button" onPress={() => openLocationInMaps(point, point.name).catch(error => Alert.alert('Maps нээгдсэнгүй', error.message))} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colors.primary, fontWeight: '600' }}>Утасны Maps дээр нээх ↗</Text>
    </Pressable>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{metrics.map(([label, value]) => <View key={label} style={{ minWidth: '44%', gap: 4 }}>
      <Text style={{ color: colors.textMuted }}>{label}</Text><Text style={{ color: colors.text, fontWeight: '600' }}>{value}</Text>
    </View>)}</View>
  </View>;
}
