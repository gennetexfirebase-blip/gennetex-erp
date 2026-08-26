import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, EmptyState, LoadingState, HeaderButton } from '../components/ui';
import * as attApi from '../services/attendanceService';
import { friendlyError } from '../lib/erpMessages';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

export default function AttendanceWifiScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await attApi.fetchAttendanceWifi());
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = (row) => {
    Alert.alert('Устгах', `${row.name} Wi-Fi-г устгах уу?`, [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          try {
            await attApi.deleteAttendanceWifi(row.id);
            load();
          } catch (e) {
            Alert.alert('Алдаа', friendlyError(e));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader
        title="Wi-Fi тохиргоо"
        right={<HeaderButton icon="+" onPress={() => navigation.navigate('AttendanceWifiForm')} />}
      />
      {loading ? (
        <LoadingState text="Ачаалж байна..." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<EmptyState text="Хоосон" />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                  SSID: {item.ssid}{item.location_name ? ` · ${item.location_name}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => remove(item)}>
                <Text style={{ color: '#ff6b60', fontSize: 20 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: spacing.lg, marginBottom: spacing.sm },
});
