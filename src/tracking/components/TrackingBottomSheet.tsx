import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import EmployeeTrackingCard from './EmployeeTrackingCard';
import { LocationPoint } from '../utils/locationUtils';

/** Дизайн BottomSheet: radius 26, дээд талд grab зураас, бүдэг дэвсгэр дарахад хаагдана. */
export default function TrackingBottomSheet({ point, now, onClose, onDetail }: { point?: LocationPoint; now: number; onClose: () => void; onDetail: () => void }) {
  const { colors } = useTheme(); const insets = useSafeAreaInsets();
  return <Modal visible={!!point} transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,14,20,0.45)' }}>
      <Pressable accessibilityLabel="Хаах" accessibilityRole="button" onPress={onClose} style={{ flex: 1 }} />
      <ScrollView style={{ maxHeight: '75%', backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 16 }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 14 }} />
        {point && <EmployeeTrackingCard point={point} now={now} />}
        <Pressable accessibilityRole="button" onPress={onDetail} style={({ pressed }) => ({ height: 52, backgroundColor: colors.brand, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12, opacity: pressed ? 0.85 : 1 })}><Text style={{ color: colors.brandInk, fontWeight: '600', fontSize: 16 }}>Дэлгэрэнгүй харах</Text></Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" style={{ height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}><Text style={{ color: colors.muted, fontWeight: '600' }}>Хаах</Text></Pressable>
      </ScrollView>
    </View>
  </Modal>;
}
