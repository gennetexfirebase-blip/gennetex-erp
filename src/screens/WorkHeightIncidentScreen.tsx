import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import { useStyles, useTheme } from '../context/ThemeContext';
import * as UI from '../components/ui';
import { radius, spacing } from '../theme';
import * as api from '../modules/workHeightRisk/service';
import type { IncidentSeverity, IncidentType } from '../modules/workHeightRisk/types';

const TYPES: [IncidentType, string][] = [['unsafe_condition', 'Аюултай нөхцөл'], ['near_miss', 'Осол дөхсөн'], ['accident', 'Осол']];
const SEVERITIES: [IncidentSeverity, string][] = [['low', 'Бага'], ['medium', 'Дунд'], ['serious', 'Ноцтой'], ['critical', 'Маш ноцтой']];
const { Button, Card, Field, ScreenHeader, SectionTitle } = UI as any;

export default function WorkHeightIncidentScreen({ navigation, route }: any) {
  const styles = useStyles(makeStyles); const { colors } = useTheme(); const { currentUser, authProfile } = useApp() as any;
  const assessment = route.params?.assessment;
  const [type, setType] = useState<IncidentType>('unsafe_condition'); const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [description, setDescription] = useState(''); const [locationName, setLocationName] = useState(assessment?.location_name || '');
  const [coords, setCoords] = useState<any>({ latitude: assessment?.latitude || null, longitude: assessment?.longitude || null });
  const [photos, setPhotos] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  const captureLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return Alert.alert('Зөвшөөрөл', 'Байршлын зөвшөөрөл шаардлагатай.');
    const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCoords({ latitude: point.coords.latitude, longitude: point.coords.longitude });
  };
  const addPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Зөвшөөрөл', 'Камер ашиглах зөвшөөрөл шаардлагатай.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false });
    if (!result.canceled && result.assets[0]?.uri) setPhotos((rows) => [...rows, result.assets[0].uri]);
  };
  const submit = async () => {
    if (!description.trim() || !locationName.trim()) return Alert.alert('Мэдээлэл дутуу', 'Тайлбар болон байршил шаардлагатай.');
    setSaving(true);
    try {
      const id = await api.reportIncident({ assessment_id: assessment?.id || null, reporter_id: currentUser?.id, reporter_name: authProfile?.name || currentUser?.name, incident_type: type, severity, description: description.trim(), location_name: locationName.trim(), latitude: coords.latitude, longitude: coords.longitude, occurred_at: new Date().toISOString() });
      for (const uri of photos) await api.uploadEvidence(uri, { assessmentId: assessment?.id, incidentId: id, type: 'incident', caption: description.trim().slice(0, 120) });
      Alert.alert('Бүртгэгдлээ', ['serious', 'critical'].includes(severity) ? 'Ноцтой зөрчлийн мэдэгдэл илгээгдэж, холбогдох ажил автоматаар зогслоо.' : 'Осол, зөрчлийн мэдээлэл хадгалагдлаа.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) { Alert.alert('Алдаа', api.mapWorkHeightError(error)); } finally { setSaving(false); }
  };
  return <View style={styles.container}><ScreenHeader title="Осол, зөрчил бүртгэх" subtitle={assessment?.location_name || 'Өндөрт ажиллах ХАБЭА'} /><ScrollView contentContainerStyle={styles.body}>
    <Card><SectionTitle>Төрөл</SectionTitle><View style={styles.chips}>{TYPES.map(([key, label]) => <Choice key={key} label={label} active={type === key} onPress={() => setType(key)} colors={colors} styles={styles} />)}</View><SectionTitle>Ноцтой байдал</SectionTitle><View style={styles.chips}>{SEVERITIES.map(([key, label]) => <Choice key={key} label={label} active={severity === key} danger={['serious', 'critical'].includes(key)} onPress={() => setSeverity(key)} colors={colors} styles={styles} />)}</View></Card>
    <Card><Field label="Тайлбар" required value={description} onChangeText={setDescription} multiline inputStyle={{ minHeight: 120, textAlignVertical: 'top' }} placeholder="Юу болсон, ямар аюул илэрсэн..." /><Field label="Байршил" required value={locationName} onChangeText={setLocationName} /><Button title={coords.latitude ? 'Байршил авсан ✓' : 'GPS байршил авах'} variant="ghost" onPress={captureLocation} /></Card>
    <Card><SectionTitle>Фото нотолгоо</SectionTitle><View style={styles.photos}>{photos.map((uri) => <Image key={uri} source={{ uri }} style={styles.photo} />)}</View><Button title="Камераар зураг авах" variant="ghost" onPress={addPhoto} /></Card>
    <Button title="Зөрчил бүртгэх" variant={['serious', 'critical'].includes(severity) ? 'danger' : 'primary'} loading={saving} onPress={submit} />
  </ScrollView></View>;
}

function Choice({ label, active, danger, onPress, colors, styles }: any) { const c = danger ? colors.danger : colors.primary; return <Pressable onPress={onPress} style={[styles.choice, { borderColor: active ? c : colors.border, backgroundColor: active ? `${c}18` : colors.surfaceAlt }]}><Text style={{ color: active ? c : colors.text, fontWeight: '700' }}>{label}</Text></Pressable>; }
const makeStyles = ({ colors }: any) => StyleSheet.create({ container: { flex: 1, backgroundColor: colors.bg }, body: { padding: spacing.lg, paddingBottom: 50 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }, choice: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 10 }, photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }, photo: { width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.surfaceAlt } });
