import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { LocationPoint, accuracyLabel, lastSeen } from '../utils/locationUtils';
import TrackingStatusBadge from './TrackingStatusBadge';
import { openLocationInMaps } from '../services/deviceMaps';
import { Avatar } from '../../components/ds';

export default function EmployeeTrackingCard({ point, now }: { point: LocationPoint; now: number }) {
  const { colors } = useTheme();
  const metrics = [['Хурд', point.speed == null ? '—' : `${(point.speed * 3.6).toFixed(1)} км/ц`],
    ['Чиглэл', point.heading == null ? '—' : `${Math.round(point.heading)}°`],
    ['GPS', point.accuracy == null ? '—' : `±${Math.round(point.accuracy)} м · ${accuracyLabel(point.accuracy)}`],
    ['Батарей', point.battery == null ? '—' : `${point.battery}%`]];
  const name = point.name || point.employee_id;
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Avatar name={name} size={56} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }} numberOfLines={1}>{name}</Text>
        <TrackingStatusBadge point={point} now={now} />
      </View>
    </View>
    <Text style={{ color: colors.muted, fontSize: 13.5 }}>
      Сүүлд шинэчлэгдсэн: {lastSeen(point.timestamp, now)} · {new Date(point.timestamp).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}
    </Text>
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 14, flexWrap: 'wrap' }}>
      {metrics.map(([label, value], i) => <View key={label} style={{ width: '50%', padding: 12, borderColor: colors.line, borderLeftWidth: i % 2 ? 1 : 0, borderTopWidth: i > 1 ? 1 : 0 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>)}
    </View>
    <Pressable accessibilityRole="button" onPress={() => openLocationInMaps(point, point.name).catch(error => Alert.alert('Maps нээгдсэнгүй', error.message))} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name="navigate-outline" size={18} color={colors.brand} />
      <Text selectable style={{ color: colors.brand, fontWeight: '600', flex: 1 }}>Maps дээр нээх · {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text>
    </Pressable>
  </View>;
}