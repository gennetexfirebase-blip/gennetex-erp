import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, Field, Button } from '../components/ui';
import EmployeeSelectSheet from '../components/EmployeeSelectSheet';
import { useApp } from '../context/AppContext';
import * as attApi from '../services/attendanceService';
import { friendlyError } from '../lib/erpMessages';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

export default function AttendanceWifiFormScreen() {
  const navigation = useNavigation();
  const { currentUser, fetchEmployees } = useApp();
  const profile = currentUser;

  const [name, setName] = useState('');
  const [ssid, setSsid] = useState('');
  const [bssid, setBssid] = useState('');
  const [description, setDescription] = useState('');
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    attApi.fetchAttendanceLocations().then(setLocations).catch(() => {});
    fetchEmployees().then(setEmployees).catch(() => {});
  }, []);

  const save = async () => {
    if (!name.trim() || !ssid.trim()) {
      Alert.alert('Дутуу мэдээлэл', 'Нэр болон SSID заавал шаардлагатай.');
      return;
    }
    setBusy(true);
    try {
      const row = await attApi.insertAttendanceWifi({
        name: name.trim(),
        ssid: ssid.trim(),
        bssid: bssid.trim() || null,
        locationId,
        description: description.trim() || null,
        createdBy: profile?.id,
      });
      await attApi.setWifiEmployees(row.id, selectedIds);
      Alert.alert('Хадгаллаа', 'Wi-Fi нэмэгдлээ.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Wi-Fi нэмэх" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Field label="Wi-Fi нэр" placeholder="Ж: Оффисын Wi-Fi" value={name} onChangeText={setName} />
        <Field label="SSID" value={ssid} onChangeText={setSsid} style={{ marginTop: spacing.md }} />
        <Field label="BSSID (заавал биш)" value={bssid} onChangeText={setBssid} style={{ marginTop: spacing.md }} />

        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: spacing.md, marginBottom: 8 }}>Байршил</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: !locationId ? colors.primary : colors.surfaceContainer }]}
              onPress={() => setLocationId(null)}
            >
              <Text style={{ color: !locationId ? colors.onPrimary : colors.text }}>Сонгохгүй</Text>
            </TouchableOpacity>
            {locations.map((l) => (
              <TouchableOpacity
                key={l.id}
                style={[styles.chip, { backgroundColor: locationId === l.id ? colors.primary : colors.surfaceContainer }]}
                onPress={() => setLocationId(l.id)}
              >
                <Text style={{ color: locationId === l.id ? colors.onPrimary : colors.text }}>{l.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Field
          label="Тайлбар"
          value={description}
          onChangeText={setDescription}
          multiline
          style={{ marginTop: spacing.md, minHeight: 80, textAlignVertical: 'top' }}
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
          <Button title="Wi-Fi нэмэх" style={{ flex: 1 }} onPress={save} loading={busy} />
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
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  assignBtn: { height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: spacing.xl },
});
