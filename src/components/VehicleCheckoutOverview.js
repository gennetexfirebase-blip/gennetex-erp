import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Card, Button, StatusPill } from './ui';
import { useTheme } from '../context/ThemeContext';

export default function VehicleCheckoutOverview({ trips = [] }) {
  const { colors } = useTheme();
  const [showHistory, setShowHistory] = useState(false);
  const active = trips.filter((trip) => trip.status === 'active');
  const rows = showHistory ? trips.slice(0, 50) : active;
  const date = (value) => value ? new Date(value).toLocaleString('mn-MN') : '—';
  return <Card>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 19, fontWeight: '700' }}>Машин авч гарсан бүртгэл</Text>
    <Text style={{ color: colors.textMuted, marginTop: 8, marginBottom: 16 }}>Одоо явж байгаа: {active.length} аялал</Text>
    <Button size="sm" variant="ghost" title={showHistory ? 'Одоо явж байгаа' : 'Сүүлийн 50 аяллын түүх'} onPress={() => setShowHistory((value) => !value)} />
    {!rows.length && <Text style={{ color: colors.textMuted, paddingVertical: 20 }}>Энэ төлөвт аяллын бүртгэл алга.</Text>}
    {rows.map((trip) => <View key={trip.id} style={{ paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.border, gap: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{trip.plate_number || 'Дугааргүй'}</Text><StatusPill text={trip.status === 'active' ? 'Явж байгаа' : 'Дууссан'} tone={trip.status === 'active' ? 'info' : 'neutral'} /></View>
      <Text style={{ color: colors.text }}>Авч гарсан: {trip.driver_name || 'Нэр бүртгэгдээгүй'}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Гарсан: {date(trip.started_at)}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Дууссан: {date(trip.ended_at)}</Text>
      <Text style={{ color: colors.primary, fontSize: 12 }}>{Number(trip.distance_km || 0).toFixed(1)} км</Text>
    </View>)}
  </Card>;
}
