import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import EmployeeTrackingCard from './EmployeeTrackingCard';
import { LocationPoint } from '../utils/locationUtils';
export default function TrackingBottomSheet({ point, now, onClose, onDetail }: { point?: LocationPoint; now: number; onClose: () => void; onDetail: () => void }) {
  const { colors } = useTheme(); const insets = useSafeAreaInsets();
  return <Modal visible={!!point} transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
      <Pressable accessibilityLabel="Хаах" accessibilityRole="button" onPress={onClose} style={{ flex: 1 }} />
      <ScrollView style={{ maxHeight: '75%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 16 }}>
        <Pressable onPress={onClose} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}><Text style={{ color: colors.primary }}>Хаах ✕</Text></Pressable>
        {point && <EmployeeTrackingCard point={point} now={now} />}
        <Pressable accessibilityRole="button" onPress={onDetail} style={{ padding: 16, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Дэлгэрэнгүй харах</Text></Pressable>
      </ScrollView>
    </View>
  </Modal>;
}
