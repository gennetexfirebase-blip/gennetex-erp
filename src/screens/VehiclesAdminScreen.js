import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import QRCode from '../components/QRCode';
import BarcodeScanner from '../components/BarcodeScanner';
import { useApp } from '../context/AppContext';
import {
  Card,
  Button,
  Field,
  Badge,
  ScreenHeader,
  HeaderButton,
  EmptyState,
} from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as vehicleApi from '../services/vehicleService';
import FuelTankGauge from '../components/FuelTankGauge';
import { buildVehicleFuelStats, fuelLevelColor, vehicleTankLiters } from '../lib/vehicleFuelStats';
import { formatPlateInput, normalizePlateNumber } from '../lib/mongoliaPlate';
import MongoliaPlate from '../components/MongoliaPlate';

const EMPTY = { code: '', plate_number: '', liters_per_100km: '12', tank_capacity_liters: '60', driver_name: '', driver_id: '' };

export default function VehiclesAdminScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud, fetchEmployees } = useApp();
  const [list, setList] = useState([]);
  const [trips, setTrips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [qrItem, setQrItem] = useState(null);
  const [logsVisible, setLogsVisible] = useState(false);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      const [veh, tr, emps] = await Promise.all([
        vehicleApi.fetchVehicles(),
        vehicleApi.fetchTrips(300),
        fetchEmployees().catch(() => []),
      ]);
      setList(veh);
      setTrips(tr || []);
      setEmployees(emps);
    } catch (e) {
      setError(e.message);
    }
  }, [isCloud, fetchEmployees]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (item) => {
    setEditItem(item);
    setEditForm({
      code: item.code || '',
      plate_number: item.plate_number || '',
      liters_per_100km: String(item.liters_per_100km ?? 12),
      tank_capacity_liters: String(vehicleTankLiters(item)),
      driver_name: item.driver_name || '',
      driver_id: item.driver_id || '',
    });
    setError(null);
  };

  const closeEdit = () => {
    setEditItem(null);
  };

  const onQrScanned = async (code) => {
    setScanVisible(false);
    try {
      const veh = await vehicleApi.resolveVehicleScan(code);
      if (!veh) {
        Alert.alert('Олдсонгүй', `Машин олдсонгүй: ${code}`);
        return;
      }
      openEdit(veh);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    const plate = normalizePlateNumber(editForm.plate_number);
    if (!plate) {
      setError('Улсын дугаар оруулна уу.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await vehicleApi.updateVehicle(editItem.id, {
        plate_number: plate,
        liters_per_100km: editForm.liters_per_100km,
        tank_capacity_liters: editForm.tank_capacity_liters,
        driver_name: editForm.driver_name,
        driver_id: editForm.driver_id || null,
      });
      setList((prev) => prev.map((v) => (v.id === saved.id ? saved : v)));
      setEditItem(saved);
      Alert.alert('Амжилттай', 'Машины мэдээлэл хадгалагдлаа');
    } catch (e) {
      setError(mapError(e.message));
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setForm({ ...EMPTY, code: vehicleApi.generateVehicleCode() });
    setError(null);
    setModal(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openLogs = async () => {
    setLogsVisible(true);
    try {
      setLogs(await vehicleApi.fetchVehicleLogs());
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCreate = async () => {
    const plate = normalizePlateNumber(form.plate_number);
    if (!plate) {
      setError('Улсын дугаар оруулна уу.');
      return;
    }
    if (!form.code.trim()) {
      setError('Код хоосон байна.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await vehicleApi.insertVehicle({ ...form, plate_number: plate });
      setForm(EMPTY);
      setModal(false);
      setList((prev) => [saved, ...prev]);
      setQrItem(saved);
    } catch (e) {
      setError(mapError(e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Устгах', `${item.plate_number} машиныг устгах уу?`, [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          try {
            await vehicleApi.deleteVehicle(item.id);
            setList((prev) => prev.filter((v) => v.id !== item.id));
            if (editItem?.id === item.id) closeEdit();
          } catch (e) {
            Alert.alert('Алдаа', e.message);
          }
        },
      },
    ]);
  };

  const fuelByVehicle = React.useMemo(() => {
    const rows = buildVehicleFuelStats(list, trips, { days: 30 });
    const map = {};
    rows.forEach((r) => {
      const id = r.vehicle?.id;
      if (id) map[id] = r;
    });
    return map;
  }, [list, trips]);

  const refillFuel = (item) => {
    Alert.alert('Сав дүүргэх', `${item.plate_number} — бензин 100% болгох уу?`, [
      { text: 'Болих', style: 'cancel' },
      {
        text: '100%',
        onPress: async () => {
          try {
            await vehicleApi.refillVehicleFuel(item.id);
            await load();
          } catch (e) {
            Alert.alert('Алдаа', e.message);
          }
        },
      },
    ]);
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Машины мэдээлэл солих" />
        <EmptyState text="Энэ хэсэг зөвхөн админд нээлттэй." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Машины мэдээлэл солих"
        subtitle={`${list.length} машин · QR уншуулж засах`}
        right={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <HeaderButton title="QR" onPress={() => setScanVisible(true)} />
            <HeaderButton title="Логууд" onPress={openLogs} />
            <HeaderButton title="Нэмэх" onPress={openAdd} />
          </View>
        }
      />

      {!isCloud ? (
        <EmptyState text="Машин бүртгэхэд Supabase холбогдсон байх шаардлагатай." />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const fuel = fuelByVehicle[item.id];
            const lvl = fuel?.currentLevel ?? Number(item.fuel_level_percent ?? 100);
            const tank = vehicleTankLiters(item);
            const remain = fuel?.remainingLiters ?? Math.round(((lvl / 100) * tank) * 10) / 10;
            const km = fuel?.totalKm ?? 0;
            return (
              <Card style={styles.row}>
                <FuelTankGauge levelPercent={lvl} tankLiters={tank} remainingLiters={remain} height={96} showLabels={false} />
                <View style={{ flex: 1 }}>
                  <View style={styles.plateBoxInline}>
                    <MongoliaPlate plate={item.plate_number} size="sm" />
                    {fuel?.active ? <Badge text="Явж байна" color={colors.success} /> : null}
                  </View>
                  <Text style={styles.code}>{item.code}</Text>
                  <Text style={styles.sub}>
                    {item.liters_per_100km} л/100км · сав {tank}л · {item.driver_name || 'жолоочгүй'}
                  </Text>
                  <Text style={[styles.fuelMeta, { color: fuelLevelColor(lvl) }]}>
                    {lvl}% · {remain.toFixed(1)}л үлдсэн · {km.toFixed(1)} км
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${lvl}%`, backgroundColor: fuelLevelColor(lvl) }]} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                  <TouchableOpacity onPress={() => openEdit(item)}>
                    <Badge text="Засах" color={colors.warning} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setQrItem(item)}>
                    <Badge text="QR" color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => refillFuel(item)} hitSlop={8}>
                    <Text style={styles.refill}>Сав</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8}>
                    <Text style={styles.delete}>Устгах</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={<EmptyState text="Машин бүртгэгдээгүй байна." />}
        />
      )}

      <BarcodeScanner
        visible={scanVisible}
        onClose={() => setScanVisible(false)}
        onScanned={onQrScanned}
        title="Машины мэдээлэл солих"
        hint="Машины QR кодыг уншуулна уу"
        frameWidth={260}
        frameHeight={260}
      />

      {/* Засах modal */}
      <Modal visible={!!editItem} transparent animationType="slide" onRequestClose={closeEdit}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Машины мэдээлэл солих</Text>
              {editItem ? (
                <>
                  <View style={styles.platePreview}>
                    <MongoliaPlate plate={editForm.plate_number || editItem.plate_number} size="lg" />
                  </View>
                  <Text style={styles.licenseLabel}>Улсын дугаар (лиценз)</Text>
                  <Text style={styles.licenseVal}>{editForm.plate_number || editItem.plate_number}</Text>
                  <Text style={styles.pickHint}>QR код: {editItem.code}</Text>
                  <Field
                    label="Улсын дугаар"
                    placeholder="Ж: 1234 УБА"
                    autoCapitalize="characters"
                    value={editForm.plate_number}
                    onChangeText={(t) => setEditForm({ ...editForm, plate_number: formatPlateInput(t) })}
                  />
                  <Field
                    label="100км-т зарцуулах литр"
                    keyboardType="numeric"
                    value={editForm.liters_per_100km}
                    onChangeText={(t) => setEditForm({ ...editForm, liters_per_100km: t })}
                  />
                  <Field
                    label="Бензиний сав (л)"
                    keyboardType="numeric"
                    value={editForm.tank_capacity_liters}
                    onChangeText={(t) => setEditForm({ ...editForm, tank_capacity_liters: t })}
                  />
                  <Text style={styles.pickLabel}>Жолооч</Text>
                  {employees.length === 0 ? (
                    <Field
                      label="Жолоочийн нэр"
                      value={editForm.driver_name}
                      onChangeText={(t) => setEditForm({ ...editForm, driver_name: t, driver_id: '' })}
                    />
                  ) : (
                    <View style={styles.pickWrap}>
                      {employees.map((e) => (
                        <TouchableOpacity
                          key={e.id}
                          style={[styles.pickBtn, editForm.driver_id === e.id && styles.pickBtnActive]}
                          onPress={() => setEditForm({ ...editForm, driver_id: e.id, driver_name: e.name })}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.pickText, editForm.driver_id === e.id && styles.pickTextActive]}>{e.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <View style={styles.actions}>
                    <Button title="Хаах" variant="ghost" style={{ flex: 1 }} onPress={closeEdit} />
                    <Button
                      title={saving ? '...' : 'Хадгалах'}
                      style={{ flex: 1 }}
                      onPress={handleSaveEdit}
                      disabled={saving}
                    />
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Нэмэх modal */}
      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Шинэ машин нэмэх</Text>
              <Field
                label="Улсын дугаар"
                placeholder="Ж: 1234 УБА"
                autoCapitalize="characters"
                value={form.plate_number}
                onChangeText={(t) => setForm({ ...form, plate_number: formatPlateInput(t) })}
              />
              {form.plate_number ? (
                <View style={styles.platePreview}>
                  <MongoliaPlate plate={form.plate_number} size="md" />
                </View>
              ) : null}
              <Field
                label="100км-т зарцуулах литр"
                keyboardType="numeric"
                value={form.liters_per_100km}
                onChangeText={(t) => setForm({ ...form, liters_per_100km: t })}
              />
              <Field
                label="Бензиний сав (л)"
                keyboardType="numeric"
                value={form.tank_capacity_liters}
                onChangeText={(t) => setForm({ ...form, tank_capacity_liters: t })}
              />
              <Text style={styles.pickLabel}>Анхны жолооч (сонголтоор)</Text>
              {employees.length === 0 ? (
                <Text style={styles.pickHint}>Ажилтан олдсонгүй.</Text>
              ) : (
                <View style={styles.pickWrap}>
                  {employees.map((e) => (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.pickBtn, form.driver_id === e.id && styles.pickBtnActive]}
                      onPress={() => setForm({ ...form, driver_id: e.id, driver_name: e.name })}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.pickText, form.driver_id === e.id && styles.pickTextActive]}>{e.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Field
                label="QR код (автоматаар үүссэн)"
                autoCapitalize="characters"
                value={form.code}
                onChangeText={(t) => setForm({ ...form, code: t })}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Button title="Болих" variant="ghost" style={{ flex: 1 }} onPress={() => setModal(false)} />
                <Button
                  title={saving ? '...' : 'Үүсгэх + QR'}
                  style={{ flex: 1 }}
                  onPress={handleCreate}
                  disabled={saving}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={logsVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Машины логууд</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {logs.length === 0 ? (
                <EmptyState text="Лог алга байна." />
              ) : (
                logs.map((l) => (
                  <View key={l.id} style={styles.logRow}>
                    <Text style={styles.logIcon}>{eventMeta(l.event).icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logName}>
                        {l.user_name || 'Ажилтан'} · {l.plate_number || l.code || '—'}
                      </Text>
                      <Text style={styles.logSub}>
                        {eventMeta(l.event).label}
                        {l.event === 'trip_end' && l.distance_km != null
                          ? ` · ${Number(l.distance_km).toFixed(1)}км`
                          : ''}
                      </Text>
                    </View>
                    <Text style={styles.logTime}>
                      {new Date(l.created_at).toLocaleString('mn-MN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            <Button title="Хаах" variant="ghost" onPress={() => setLogsVisible(false)} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!qrItem} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <View style={styles.qrCard}>
            {qrItem && (
              <>
                <MongoliaPlate plate={qrItem.plate_number} size="lg" showCar={false} style={styles.qrPlateWrap} />
                <Text style={styles.qrCode}>{qrItem.code}</Text>
                <View style={styles.qrBox}>
                  <QRCode value={qrItem.code} size={340} />
                </View>
                <Text style={styles.qrInfo}>
                  {qrItem.liters_per_100km} л/100км
                  {qrItem.driver_name ? ` · ${qrItem.driver_name}` : ''}
                </Text>
                <Text style={styles.qrHint}>
                  Энэ QR-г хэвлээд машин дээр наана. Ажилтан уншиж аялал эхлүүлнэ.
                </Text>
                <Button title="Хаах" variant="ghost" onPress={() => setQrItem(null)} style={{ marginTop: spacing.md }} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function mapError(msg = '') {
  if (/duplicate|unique/i.test(msg)) return 'Энэ код давхардаж байна. Өөр код оруулна уу.';
  return msg;
}

function eventMeta(event) {
  switch (event) {
    case 'scan':
      return { icon: '', label: 'QR уншсан (жолооч боллоо)' };
    case 'trip_start':
      return { icon: '', label: 'Аялал эхлүүлсэн' };
    case 'trip_end':
      return { icon: '', label: 'Аялал дуусгасан' };
    default:
      return { icon: '', label: event || 'Үйлдэл' };
  }
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    plateBoxInline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
    platePreview: { alignItems: 'center', marginBottom: spacing.md, marginTop: -4 },
    licenseLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    licenseVal: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: spacing.sm },
    qrPlateWrap: { alignSelf: 'center', marginBottom: spacing.sm },
    fuelMeta: { fontSize: 13, fontWeight: '800', marginTop: 6 },
    barTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.bgAlt,
      overflow: 'hidden',
      marginTop: 8,
    },
    barFill: { height: '100%', borderRadius: 999 },
    refill: { color: colors.primary, fontSize: 12, fontWeight: '700' },
    code: { color: colors.text, fontSize: 15, fontWeight: '800' },
    sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    delete: { color: colors.danger, fontSize: 12, fontWeight: '700' },
    overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.xl,
      maxHeight: '92%',
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderHi, alignSelf: 'center', marginBottom: spacing.lg },
    title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.lg },
    pickLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
    pickHint: { color: colors.textFaint, fontSize: 12, fontStyle: 'italic', marginBottom: spacing.md },
    pickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    pickBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickBtnActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
    pickText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
    pickTextActive: { color: colors.primary },
    error: { color: colors.danger, marginBottom: spacing.md },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg },
    qrOverlay: { flex: 1, backgroundColor: '#000000cc', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    qrCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: 'center',
      width: '100%',
      maxWidth: 420,
    },
    qrCode: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: spacing.lg },
    qrBox: { backgroundColor: '#fff', padding: spacing.lg, borderRadius: radius.md },
    qrInfo: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: spacing.lg },
    qrHint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.sm, lineHeight: 18 },
    logRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    logIcon: { fontSize: 20 },
    logName: { color: colors.text, fontSize: 14, fontWeight: '700' },
    logSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    logTime: { color: colors.textFaint, fontSize: 11 },
  });
