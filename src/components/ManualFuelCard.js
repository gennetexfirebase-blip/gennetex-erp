import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import { Button, Card, Field, FilterChip, formatMNT } from './ui';
import { useTheme } from '../context/ThemeContext';
import { fuelToday, validateFuelEntry } from '../lib/fuelEntry';
import { fetchVehicles } from '../services/vehicleService';
import { fetchMyFuelEntries, saveFuelEntry } from '../services/manualFuelService';

const emptyForm = () => ({ consumed_on: fuelToday(), vehicle_id: '', liters: '', cost: '', distance_km: '', note: '' });
const errorText = (error) => ['42P01', 'PGRST205'].includes(error?.code)
  ? 'Шинэ бүртгэл сервер дээр хараахан идэвхжээгүй байна. Админд хандана уу.'
  : error?.message || 'Мэдээлэл авч чадсангүй. Дахин оролдоно уу.';

export default function ManualFuelCard({ isCloud }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [vehicles, setVehicles] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const entryId = useRef(null);
  const load = useCallback(async () => {
    if (!isCloud) return;
    setLoading(true);
    try {
      const [rows, cars] = await Promise.all([fetchMyFuelEntries(), fetchVehicles()]);
      setEntries(rows); setVehicles(cars); setError('');
    } catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, [isCloud]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (pending.current) return;
    try { validateFuelEntry(form); } catch (e) { setError(e.message); return; }
    pending.current = true; setSaving(true); setError('');
    try {
      if (!entryId.current) entryId.current = randomUUID();
      await saveFuelEntry(form, entryId.current);
      entryId.current = null; setForm(emptyForm()); setOpen(false);
      Alert.alert('Бүртгэгдлээ', 'Таны бензин зарцуулалтын бүртгэл хадгалагдлаа.');
      await load();
    } catch (e) { setError(errorText(e)); }
    finally { pending.current = false; setSaving(false); }
  };
  return (
    <Card>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Миний бензин зарцуулалт</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>Өнөөдрийн болон өмнөх өдрийн зарцуулалтаа өөрөө бүртгээрэй. GPS аяллаас тооцсон дүнг энд дахин оруулахгүй.</Text>
      {!isCloud ? <Text style={{ color: colors.textMuted }}>Бүртгэл хадгалахын тулд байгууллагын эрхээр нэвтэрнэ үү.</Text> : <>
        {!open && <Button title="Зарцуулалт бүртгэх" onPress={() => { setOpen(true); if (!vehicles.length) load(); }} />}
        {open && <View style={styles.form}>
          <Field label="Зарцуулсан огноо" hint="YYYY-MM-DD · Өмнөх огноогоор нөхөж болно" value={form.consumed_on} onChangeText={(value) => change('consumed_on', value)} editable={!saving} autoCapitalize="none" maxLength={10} />
          <Text style={[styles.label, { color: colors.textMuted }]}>Машин сонгох</Text>
          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <View style={styles.vehicles}>{vehicles.map((vehicle) => <FilterChip key={vehicle.id} label={vehicle.plate_number || vehicle.id} active={form.vehicle_id === vehicle.id} onPress={() => { if (!saving) change('vehicle_id', vehicle.id); }} />)}</View>
          </ScrollView>
          {!vehicles.length && <Text style={{ color: colors.textMuted }}>{loading ? 'Машины мэдээлэл ачаалж байна…' : 'Машин олдсонгүй. Доорх шинэчлэх товчийг дарна уу.'}</Text>}
          <Field label="Зарцуулсан түлш (литр)" required keyboardType="decimal-pad" value={form.liters} onChangeText={(value) => change('liters', value)} editable={!saving} placeholder="12.50" />
          <Field label="Нийт зардал (₮)" required keyboardType="decimal-pad" value={form.cost} onChangeText={(value) => change('cost', value)} editable={!saving} placeholder="35000" />
          <Field label="Явсан зам (км, заавал биш)" keyboardType="decimal-pad" value={form.distance_km} onChangeText={(value) => change('distance_km', value)} editable={!saving} placeholder="100" />
          <Field label="Тайлбар" multiline maxLength={500} value={form.note} onChangeText={(value) => change('note', value)} editable={!saving} placeholder="Чиглэл, хийсэн ажил…" />
          <View style={styles.actions}><Button title="Болих" variant="ghost" disabled={saving} onPress={() => setOpen(false)} style={{ flex: 1 }} /><Button title="Хадгалах" loading={saving} onPress={submit} style={{ flex: 1 }} /></View>
        </View>}
        {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.description, { color: colors.danger }]}>{error}</Text>}
        <View style={styles.historyHeader}><Text style={[styles.label, { color: colors.textMuted }]}>Сүүлийн 100 бүртгэл · {entries.length}</Text><Button title="Шинэчлэх" variant="ghost" size="sm" loading={loading} disabled={saving} onPress={load} /></View>
        {!loading && !error && !entries.length && <Text style={{ color: colors.textMuted }}>Одоогоор гараар оруулсан бүртгэл алга.</Text>}
        {entries.map((entry) => <View key={entry.id} style={[styles.entry, { borderColor: colors.border }]}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '600' }}>{entry.vehicles?.plate_number || 'Машин'} · {Number(entry.liters).toFixed(2)} л</Text><Text style={[styles.entryMeta, { color: colors.textMuted }]}>{entry.consumed_on} · {Number(entry.distance_km).toFixed(1)} км</Text>{!!entry.note && <Text style={[styles.entryMeta, { color: colors.textMuted }]}>{entry.note}</Text>}</View><Text style={{ color: colors.primary, fontWeight: '700' }}>{formatMNT(entry.cost)}</Text></View>)}
      </>}
    </Card>
  );
}
const styles = StyleSheet.create({ title: { fontSize: 19, fontWeight: '700' }, description: { fontSize: 13, lineHeight: 20, marginVertical: 12 }, form: { marginTop: 16 }, label: { fontSize: 13, fontWeight: '600', marginBottom: 8 }, vehicles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, actions: { flexDirection: 'row', gap: 10 }, historyHeader: { marginTop: 24, gap: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }, entry: { paddingVertical: 14, borderTopWidth: 1, flexDirection: 'row', gap: 12, marginTop: 10 }, entryMeta: { fontSize: 12, lineHeight: 18, marginTop: 4 } });
