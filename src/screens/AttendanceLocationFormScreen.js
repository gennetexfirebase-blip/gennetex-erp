import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from '../components/Map';
import { ScreenHeader, Field, Button } from '../components/ui';
import EmployeeSelectSheet from '../components/EmployeeSelectSheet';
import { useApp } from '../context/AppContext';
import * as attApi from '../services/attendanceService';
import { friendlyError } from '../lib/erpMessages';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

const UB_REGION = { latitude: 47.9184, longitude: 106.9177, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export default function AttendanceLocationFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const editing = route.params?.location || null;
  const { currentUser, fetchEmployees } = useApp();
  const profile = currentUser;

  const [name, setName] = useState(editing?.name || '');
  const [radius, setRadius] = useState(String(editing?.radius_m || 100));
  const [pin, setPin] = useState(
    editing ? { latitude: editing.latitude, longitude: editing.longitude } : null
  );
  const [busy, setBusy] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => {});
    if (editing?.id) {
      attApi.fetchLocationEmployeeIds(editing.id).then(setSelectedIds).catch(() => {});
    }
    if (!editing) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const pos = await Location.getCurrentPositionAsync({});
          setPin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        } catch (e) {}
      })();
    }
  }, []);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Нэр оруулна уу', 'Байршлын нэрийг бичнэ үү.');
      return;
    }
    if (!pin) {
      Alert.alert('Байршил сонгоно уу', 'Газрын зураг дээр дарж байршил тэмдэглэнэ үү.');
      return;
    }
    setBusy(true);
    try {
      let loc;
      if (editing?.id) {
        loc = await attApi.updateAttendanceLocation(editing.id, {
          name: name.trim(),
          latitude: pin.latitude,
          longitude: pin.longitude,
          radius_m: Number(radius) || 100,
        });
      } else {
        loc = await attApi.insertAttendanceLocation({
          name: name.trim(),
          latitude: pin.latitude,
          longitude: pin.longitude,
          radius_m: Number(radius) || 100,
        });
      }
      await attApi.setLocationEmployees(loc.id, selectedIds);
      Alert.alert('Хадгаллаа', 'Байршил хадгалагдлаа.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title={editing ? 'Байршил засах' : 'Байршил нэмэх'} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
          Газрын зураг дээр дарж байршил тэмдэглэнэ.
        </Text>
        <View style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFillObject}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={pin ? { ...pin, latitudeDelta: 0.01, longitudeDelta: 0.01 } : UB_REGION}
            onPress={(e) => setPin(e.nativeEvent.coordinate)}
          >
            {pin ? (
              <>
                <Marker coordinate={pin} />
                <Circle
                  center={pin}
                  radius={Number(radius) || 100}
                  strokeWidth={0}
                  fillColor="rgba(63,207,142,0.25)"
                />
              </>
            ) : null}
          </MapView>
        </View>

        <Field label="Нэр" placeholder="Ж: Төв оффис" value={name} onChangeText={setName} style={{ marginTop: spacing.md }} />
        <Field
          label="Радиус (метр)"
          placeholder="100"
          keyboardType="numeric"
          value={radius}
          onChangeText={setRadius}
          hint="20м – 1000м, анхдагч 100м"
          style={{ marginTop: spacing.md }}
        />

        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: spacing.md, marginBottom: 8 }}>Ажилтнууд</Text>
        <TouchableOpacity
          style={[styles.assignBtn, { borderColor: colors.outlineVariant }]}
          onPress={() => setSheetVisible(true)}
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            Ажилтан сонгох{selectedIds.length ? ` (${selectedIds.length})` : ''}
          </Text>
        </TouchableOpacity>

        <View style={styles.btnRow}>
          <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => navigation.goBack()} />
          <Button title="Хадгалах" style={{ flex: 1 }} onPress={save} loading={busy} />
        </View>
      </ScrollView>

      <EmployeeSelectSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        employees={employees}
        colors={colors}
        initialSelected={selectedIds}
        onConfirm={(ids) => {
          setSelectedIds(ids);
          setSheetVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mapWrap: { height: 240, borderRadius: 18, overflow: 'hidden' },
  assignBtn: { height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: spacing.xl },
});
