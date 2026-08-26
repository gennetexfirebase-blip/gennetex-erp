import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/Map';
import { ScreenHeader, EmptyState, LoadingState } from '../components/ui';
import * as attApi from '../services/attendanceService';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

/** "Илгээсэн байршил" — attendance хүснэгтийн lat/lng-тэй мөрүүдийг л феэд болгож харуулна (шинэ хүснэгт үүсгэхгүй). */
export default function LocationSubmissionsScreen() {
  const navigation = useNavigation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 14);
    attApi
      .fetchAttendanceInRange(start.toISOString(), end.toISOString(), 200)
      .then((data) => setRows((data || []).filter((r) => r.latitude != null && r.longitude != null)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Илгээсэн байршлууд" />
      {loading ? (
        <LoadingState text="Ачаалж байна..." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg }}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          ListEmptyComponent={<EmptyState text="Байршлын мэдээлэлтэй бүртгэл алга" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surfaceContainer }]}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate('MapDetail', {
                  latitude: item.latitude,
                  longitude: item.longitude,
                  employeeName: item.staff_name,
                  timestamp: item.created_at,
                  distanceM: item.distance_m,
                })
              }
            >
              <View style={styles.headRow}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.staff_name}</Text>
                <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                  {new Date(item.created_at).toLocaleString('mn-MN')}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                {item.type === 'check_in' ? 'ирлээ' : 'тарсан'}
              </Text>
              <View style={styles.mapPreview} pointerEvents="none">
                <MapView
                  style={StyleSheet.absoluteFillObject}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  initialRegion={{
                    latitude: item.latitude,
                    longitude: item.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker coordinate={{ latitude: item.latitude, longitude: item.longitude }} />
                </MapView>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  mapPreview: { height: 130, borderRadius: 12, overflow: 'hidden' },
});
