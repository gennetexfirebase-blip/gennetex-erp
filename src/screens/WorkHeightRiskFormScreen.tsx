import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useStyles, useTheme } from '../context/ThemeContext';
import * as UI from '../components/ui';
import { radius, spacing } from '../theme';
import { fetchAttendanceLocations } from '../services/attendanceService';
import { DEFAULT_HAZARDS, DEFAULT_PPE, maxRiskScore, riskLevel, splitList, validateAssessment } from '../modules/workHeightRisk/domain';
import { PpeChecklist, RiskBadge, ScorePicker } from '../modules/workHeightRisk/components';
import * as api from '../modules/workHeightRisk/service';
import type { WorkHeightAssessment, WorkHeightHazard } from '../modules/workHeightRisk/types';

type Props = { navigation: any; route: any };
const { Button, Card, Field, ScreenHeader, SectionTitle } = UI as any;

function localInput(date: Date) {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocal(value: string) {
  const normalized = value.trim().replace(' ', 'T');
  const date = new Date(`${normalized}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function WorkHeightRiskFormScreen({ navigation, route }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { currentUser, authProfile, isCloud } = useApp() as any;
  const source = route.params?.assessment || route.params?.offlineDraft;
  const now = new Date();
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const [employeeName, setEmployeeName] = useState(source?.employee_name || authProfile?.name || currentUser?.name || '');
  const [employeeCode, setEmployeeCode] = useState(source?.employee_code || authProfile?.employee_code || authProfile?.email || '');
  const [locationId, setLocationId] = useState(source?.location_id || '');
  const [locationName, setLocationName] = useState(source?.location_name || '');
  const [height, setHeight] = useState(String(source?.height_m || ''));
  const [workType, setWorkType] = useState(source?.work_type || 'Шилэн кабель / холбооны угсралт');
  const [startsAt, setStartsAt] = useState(source?.starts_at ? localInput(new Date(source.starts_at)) : localInput(now));
  const [endsAt, setEndsAt] = useState(source?.ends_at ? localInput(new Date(source.ends_at)) : localInput(later));
  const [weather, setWeather] = useState(source?.weather || 'Тогтуун, хур тунадасгүй');
  const [partners, setPartners] = useState((source?.partner_names || []).join(', '));
  const [equipment, setEquipment] = useState((source?.equipment || []).join(', '));
  const [notes, setNotes] = useState(source?.notes || '');
  const [hazards, setHazards] = useState<WorkHeightHazard[]>(source?.hazards?.length ? source.hazards : DEFAULT_HAZARDS.map((item) => ({ ...item })));
  const [ppe, setPpe] = useState(source?.ppe_checks?.length ? source.ppe_checks : DEFAULT_PPE.map((item) => ({ ...item })));
  const [photos, setPhotos] = useState<string[]>((source?.evidence || []).filter((item: any) => item.local_uri).map((item: any) => item.local_uri));
  const [locations, setLocations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    if (isCloud) fetchAttendanceLocations().then(setLocations).catch(() => setLocations([]));
  }, [isCloud]));

  const totalRisk = useMemo(() => maxRiskScore(hazards), [hazards]);
  const level = riskLevel(totalRisk);

  const patchHazard = (index: number, patch: Partial<WorkHeightHazard>) => setHazards((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const addHazard = () => setHazards((rows) => [...rows, { hazard_type: 'other', description: '', likelihood: 1, consequence: 1, control_measure: '' }]);

  const pickPhoto = () => Alert.alert('Фото нотолгоо', 'Зураг авах арга', [
    { text: 'Камера', onPress: async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return Alert.alert('Зөвшөөрөл', 'Камер ашиглах зөвшөөрөл шаардлагатай.');
      const result = await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false });
      if (!result.canceled && result.assets[0]?.uri) setPhotos((rows) => [...rows, result.assets[0].uri]);
    } },
    { text: 'Зургийн сан', onPress: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75, allowsMultipleSelection: true, selectionLimit: 6 });
      if (!result.canceled) setPhotos((rows) => [...rows, ...result.assets.map((asset) => asset.uri)].slice(0, 8));
    } },
    { text: 'Болих', style: 'cancel' },
  ]);

  const buildValue = (): WorkHeightAssessment | null => {
    const startIso = parseLocal(startsAt);
    const endIso = parseLocal(endsAt);
    if (!startIso || !endIso) {
      Alert.alert('Огноо буруу', 'Огноог YYYY-MM-DD HH:mm хэлбэрээр оруулна уу.');
      return null;
    }
    return {
      id: source?.id,
      offline_id: source?.offline_id,
      employee_id: source?.employee_id || currentUser?.id || '',
      employee_name: employeeName.trim(),
      employee_code: employeeCode.trim(),
      department_id: source?.department_id || authProfile?.department_id || null,
      location_id: locationId || null,
      location_name: locationName.trim(),
      latitude: locations.find((item) => item.id === locationId)?.latitude ?? source?.latitude ?? null,
      longitude: locations.find((item) => item.id === locationId)?.longitude ?? source?.longitude ?? null,
      height_m: Number(String(height).replace(',', '.')),
      work_type: workType.trim(), starts_at: startIso, ends_at: endIso, weather: weather.trim(),
      partner_ids: source?.partner_ids || [], partner_names: splitList(partners), equipment: splitList(equipment), notes: notes.trim(),
      status: source?.status || 'draft', hazards, ppe_checks: ppe,
      max_risk_score: totalRisk,
      ppe_complete: ppe.length > 0 && ppe.every((item: any) => !item.required || item.passed),
      evidence: photos.map((uri) => ({ evidence_type: 'ppe', local_uri: uri })),
    };
  };

  const persist = async (submit: boolean) => {
    const value = buildValue();
    if (!value || !currentUser?.id) return;
    const errors = validateAssessment(value);
    if (errors.length) return Alert.alert('Мэдээлэл дутуу', errors.join('\n'));
    setSaving(true);
    try {
      if (!isCloud) {
        await api.saveOfflineDraft(currentUser.id, value);
        Alert.alert('Офлайн ноорог', 'Төхөөрөмж дээр хадгаллаа. Сүлжээ ормогц синхрончилно.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }
      const id = await api.saveAssessment(value);
      const failed: string[] = [];
      for (const uri of photos.filter((photo) => !String(photo).startsWith('http'))) {
        try { await api.uploadEvidence(uri, { assessmentId: id, type: 'ppe', caption: 'Хамгаалах хэрэгслийн фото нотолгоо' }); }
        catch (error) { failed.push(api.mapWorkHeightError(error)); }
      }
      if (source?.offline_id) await api.removeOfflineDraft(currentUser.id, source.offline_id);
      if (submit) await api.transitionAssessment(id, 'submit');
      Alert.alert(submit ? 'Илгээгдлээ' : 'Хадгалагдлаа', `${submit ? 'Үнэлгээ зөвшөөрөлд илгээгдлээ.' : 'Ноорог хадгалагдлаа.'}${failed.length ? '\nЗарим зураг upload хийгдсэнгүй.' : ''}`, [
        { text: 'Харах', onPress: () => navigation.replace('WorkHeightRiskDetail', { assessmentId: id }) },
      ]);
    } catch (error) {
      if (!submit && /network|fetch/i.test(String((error as any)?.message || error))) {
        await api.saveOfflineDraft(currentUser.id, value);
        Alert.alert('Сүлжээгүй', 'Нооргийг төхөөрөмж дээр хадгаллаа.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else Alert.alert('Алдаа', api.mapWorkHeightError(error));
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Өндөрт ажиллах үнэлгээ" subtitle="Аюул · хамгаалалт · фото нотолгоо" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card>
          <SectionTitle>1. Ажил ба байршил</SectionTitle>
          <Field label="Ажилтны нэр" required value={employeeName} onChangeText={setEmployeeName} />
          <Field label="Ажилтны ID / код" value={employeeCode} onChangeText={setEmployeeCode} />
          {locations.length ? <><Text style={styles.label}>Бүртгэлтэй байршил</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{locations.map((item) => <Pressable key={item.id} onPress={() => { setLocationId(item.id); setLocationName(item.name); }} style={[styles.chip, { borderColor: locationId === item.id ? colors.primary : colors.border, backgroundColor: locationId === item.id ? colors.primarySoft : colors.surfaceAlt }]}><Text style={{ color: locationId === item.id ? colors.primary : colors.text }}>{item.name}</Text></Pressable>)}</ScrollView></> : null}
          <Field label="Байршлын нэр" required value={locationName} onChangeText={(value: string) => { setLocationName(value); if (value !== locations.find((item) => item.id === locationId)?.name) setLocationId(''); }} />
          <Field label="Ажиллах өндөр (метр)" required value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="Жишээ: 8.5" />
          <Field label="Ажлын төрөл" required value={workType} onChangeText={setWorkType} />
          <Field label="Эхлэх хугацаа" required value={startsAt} onChangeText={setStartsAt} hint="YYYY-MM-DD HH:mm" />
          <Field label="Дуусах хугацаа" required value={endsAt} onChangeText={setEndsAt} hint="YYYY-MM-DD HH:mm" />
          <Field label="Цаг агаар" required value={weather} onChangeText={setWeather} />
          <Field label="Хамтрагчид" value={partners} onChangeText={setPartners} placeholder="Нэрсийг таслалаар тусгаарлана" />
          <Field label="Тоног төхөөрөмж" value={equipment} onChangeText={setEquipment} placeholder="Шат, өргөгч, багаж..." />
          <Field label="Нэмэлт тайлбар" value={notes} onChangeText={setNotes} multiline inputStyle={{ minHeight: 80, textAlignVertical: 'top' }} />
        </Card>

        <Card>
          <View style={styles.titleRow}><SectionTitle>2. Аюулын үнэлгээ</SectionTitle><View style={[styles.totalRisk, { backgroundColor: `${level.color}18` }]}><Text style={{ color: level.color, fontWeight: '900' }}>Хамгийн их: {totalRisk}</Text></View></View>
          {hazards.map((hazard, index) => (
            <View key={`${hazard.hazard_type}-${index}`} style={[styles.hazard, { borderColor: colors.border }]}>
              <View style={styles.titleRow}><Text style={styles.hazardTitle}>Аюул {index + 1}</Text><RiskBadge likelihood={hazard.likelihood} consequence={hazard.consequence} /></View>
              <Field label="Аюулын тайлбар" value={hazard.description} onChangeText={(value: string) => patchHazard(index, { description: value })} />
              <View style={styles.scorePickers}><ScorePicker label="Магадлал (1–5)" value={hazard.likelihood} onChange={(value) => patchHazard(index, { likelihood: value })} /><ScorePicker label="Үр дагавар (1–5)" value={hazard.consequence} onChange={(value) => patchHazard(index, { consequence: value })} /></View>
              <Field label="Хяналтын арга хэмжээ" value={hazard.control_measure} onChangeText={(value: string) => patchHazard(index, { control_measure: value })} multiline inputStyle={{ minHeight: 64, textAlignVertical: 'top' }} />
              {hazards.length > 1 ? <Button title="Аюул хасах" variant="ghost" size="sm" onPress={() => setHazards((rows) => rows.filter((_, i) => i !== index))} /> : null}
            </View>
          ))}
          <Button title="＋ Аюул нэмэх" variant="ghost" onPress={addHazard} />
        </Card>

        <Card>
          <SectionTitle>3. Хамгаалах хэрэгслийн шалгалт</SectionTitle>
          <Text style={styles.hint}>* тэмдэгтэй бүх хэрэгсэл тэнцээгүй бол ажил зөвшөөрөгдөхгүй.</Text>
          <PpeChecklist items={ppe} onChange={setPpe} />
        </Card>

        <Card>
          <SectionTitle>4. Фото нотолгоо</SectionTitle>
          <Text style={styles.hint}>Каск, бүс, бэхэлгээ, шат болон ажлын орчныг тод харагдуулна.</Text>
          <View style={styles.photos}>{photos.map((uri, index) => <View key={`${uri}-${index}`}><Image source={{ uri }} style={styles.photo} /><Pressable onPress={() => setPhotos((rows) => rows.filter((_, i) => i !== index))} style={styles.removePhoto}><Ionicons name="close" size={18} color="#fff" /></Pressable></View>)}</View>
          <Button title="Фото нэмэх" variant="ghost" onPress={pickPhoto} />
        </Card>

        <View style={styles.bottomActions}>
          <Button title="Ноорог хадгалах" variant="ghost" loading={saving} onPress={() => persist(false)} style={{ flex: 1 }} />
          <Button title="Үнэлгээнд илгээх" loading={saving} onPress={() => persist(true)} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg }, body: { padding: spacing.lg, paddingBottom: 50 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  chips: { gap: 8, paddingBottom: spacing.md }, chip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 13, paddingVertical: 9 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  totalRisk: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full },
  hazard: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  hazardTitle: { color: colors.text, fontWeight: '900', fontSize: 15 },
  scorePickers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: spacing.md },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  photo: { width: 92, height: 92, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  removePhoto: { position: 'absolute', right: 4, top: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  bottomActions: { flexDirection: 'row', gap: spacing.sm },
});
