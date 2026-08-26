import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, EmptyState, LoadingState, HeaderButton } from '../components/ui';
import { useApp } from '../context/AppContext';
import * as attApi from '../services/attendanceService';
import { friendlyError } from '../lib/erpMessages';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

export default function AttendanceLocationsScreen({ navigation }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLocations(await attApi.fetchAttendanceLocations());
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = (loc) => {
    Alert.alert('Устгах', `${loc.name} байршлыг устгах уу?`, [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          try {
            await attApi.deleteAttendanceLocation(loc.id);
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
        title="Байршил"
        right={<HeaderButton icon="+" onPress={() => navigation.navigate('AttendanceLocationForm')} />}
      />
      {loading ? (
        <LoadingState text="Ачаалж байна..." />
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<EmptyState text="Байршил бүртгэгдээгүй байна" />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>📍 Радиус: {item.radius_m}м</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('AttendanceLocationForm', { location: item })}
                >
                  <Text style={{ color: '#3fcf8e', fontSize: 20 }}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(item)}>
                  <Text style={{ color: '#ff6b60', fontSize: 20 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
});
