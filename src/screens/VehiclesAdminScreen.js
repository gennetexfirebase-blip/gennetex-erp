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
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Chip, FilterChips, PillButton, RoundButton } from '../components/ds';
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
import FuelRefillModal from '../components/FuelRefillModal';
import FuelTankGauge from '../components/FuelTankGauge';
import { buildVehicleFuelStats, fuelLevelColor, vehicleTankLiters } from '../lib/vehicleFuelStats';
import { formatPlateInput, normalizePlateNumber } from '../lib/mongoliaPlate';
import MongoliaPlate from '../components/MongoliaPlate';
import VehicleCheckoutOverview from '../components/VehicleCheckoutOverview';
import { useFocusEffect } from '@react-navigation/native';

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
  const [vfilter, setVfilter] = useState('all');

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      const [veh, tr, emps] = await Promise.all([
        vehicleApi.fetchVehicles(),
        vehicleApi.fetchVehicleCheckouts(300),
        fetchEmployees().catch(() => []),
      ]);
      setList(veh);
      setTrips(tr || []);
      setEmployees(emps);
    } catch (e) {
      setError(e.message);
    }
  }, [isCloud, fetchEmployees]);

  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]));

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

  /**
   * Цэнэглэх — админ мөнгөн дүнгээ оруулна, литр нь тухайн үеийн
   * түлшний үнээр тооцогдоно.
   *
   * ⚠️ Өмнө нь "100% болгох" гэсэн ганц товч байсан тул хэдэн
   *    төгрөгийн түлш авсан нь хаана ч бүртгэгдэхгүй байв.
   */
  const [refillVehicle, setRefillVehicle] = useState(null);

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Машины мэдээлэл солих" />
        <EmptyState text="Энэ хэсэг зөвхөн админд нээлттэй." />
      </View>
    );
  }

  // Prototype «Машины хяналт»: замд яваа аялал → шүүлтүүр → машины карт.
  const activeTrips = trips.filter((t) => t.status === 'active' || (!t.ended_at && t.started_at));
  const onRoad = (v) => !!fuelByVehicle[v.id]?.active || activeTrips.some((t) => t.vehicle_id === v.id);
  const levelOf = (v) => fuelByVehicle[v.id]?.currentLevel ?? Number(v.fuel_level_percent ?? 0);
  const counts = {
    all: list.length,
    road: list.filter(onRoad).length,
    free: list.filter((v) => !onRoad(v)).length,
    low: list.filter((v) => levelOf(v) < 40).length,
  };
  const shownList = list.filter((v) =>
    vfilter === 'road' ? onRoad(v) : vfilter === 'free' ? !onRoad(v) : vfilter === 'low' ? levelOf(v) < 40 : true
  );
  const firstTrip = activeTrips[0];
  const hhmm = (ts) => (ts ? new Date(ts).toTimeString().slice(0, 5) : '');

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Машины хяналт"
        subtitle={`${list.length} машин · ${counts.road} замд`}
        right={
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <RoundButton icon="qr-code-outline" onPress={() => setScanVisible(true)} accessibilityLabel="QR унших" />
            <PillButton title="Нэмэх" icon="add" onPress={openAdd} />
          </View>
        }
      />

      {!isCloud ? (
        <EmptyState text="Машин бүртгэхэд Supabase холбогдсон байх шаардлагатай." />
      ) : (
        <FlatList
          ListHeaderComponent={
            <View>
              <View style={styles.tripCard}>
                <View style={styles.tripIcon}>
                  <Ionicons name="navigate-outline" size={22} color={colors.brand} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tripTitle}>Одоо замд яваа: {activeTrips.length} аялал</Text>
                  <Text style={styles.tripSub} numberOfLines={1}>
                    {firstTrip
                      ? [firstTrip.vehicle_code || firstTrip.plate_number, firstTrip.driver_name, `${hhmm(firstTrip.started_at)}-өөс`].filter(Boolean).join(' · ')
                      : 'Замд яваа машин алга'}
                  </Text>
                </View>
                <Pressable style={styles.tripBtn} onPress={openLogs}>
                  <Ionicons name="time-outline" size={16} color={colors.ink} />
                  <Text style={styles.tripBtnText}>Түүх</Text>
                </Pressable>
              </View>
              <FilterChips
                style={styles.chips}
                value={vfilter}
                onChange={setVfilter}
                items={[
                  { key: 'all', label: 'Бүгд', count: counts.all },
                  { key: 'free', label: 'Сул', count: counts.free },
                  { key: 'road', label: 'Замд', count: counts.road },
                  { key: 'low', label: 'Түлш бага', count: counts.low },
                ]}
              />
            </View>
          }
          data={shownList}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          renderItem={({ item }) => {
            const fuel = fuelByVehicle[item.id];
            const lvl = Math.max(0, Math.min(100, Math.round(levelOf(item))));
            const tank = vehicleTankLiters(item);
            const remain = fuel?.remainingLiters ?? Math.round(((lvl / 100) * tank) * 10) / 10;
            const road = onRoad(item);
            const barColor = lvl < 40 ? colors.bad : lvl < 70 ? colors.warn : colors.ok;
            return (
              <View style={styles.car}>
                <View style={styles.carTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.carCode}>{item.code || '—'}</Text>
                    <Text style={styles.carSub} numberOfLines={1}>
                      {[item.model, `${item.liters_per_100km} л/100км`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <MongoliaPlate plate={item.plate_number} size="sm" showCar={false} />
                </View>
                <View style={styles.drv}>
                  {item.driver_name ? (
                    <>
                      <Avatar name={item.driver_name} uri={employees.find((e) => e.id === item.driver_id || e.user_id === item.driver_id)?.avatar_url} size={24} />
                      <Text style={styles.drvName} numberOfLines={1}>{item.driver_name}</Text>
                    </>
                  ) : (
                    <Text style={styles.drvNone}>Жолооч оноогоогүй</Text>
                  )}
                  <Chip text={road ? 'Замд' : 'Сул'} tone={road ? 'blue' : 'ok'} style={{ marginLeft: 'auto' }} />
                </View>
                <View style={styles.fuelRow}>
                  <Text style={styles.fuelLabel}>Түлш · {tank}л сав</Text>
                  <Text style={styles.fuelVal}>{lvl}% · {Number(remain).toFixed(1)}л</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${lvl}%`, backgroundColor: barColor }]} />
                </View>
                <View style={styles.acts}>
                  <Pressable style={styles.act} onPress={() => openEdit(item)}>
                    <Ionicons name="pencil-outline" size={15} color={colors.ink} />
                    <Text style={styles.actText}>Засах</Text>
                  </Pressable>
                  <Pressable style={styles.act} onPress={() => setQrItem(item)}>
                    <Ionicons name="qr-code-outline" size={15} color={colors.ink} />
                    <Text style={styles.actText}>QR</Text>
                  </Pressable>
                  <Pressable style={styles.act} onPress={() => setRefillVehicle(item)}>
                    <Ionicons name="water-outline" size={15} color={colors.ink} />
                    <Text style={styles.actText}>Сав</Text>
                  </Pressable>
                  <Pressable style={[styles.act, styles.actDel]} onPress={() => handleDelete(item)} accessibilityLabel="Устгах">
                    <Ionicons name="trash-outline" size={15} color={colors.bad} />
                  </Pressable>
                </View>
              </View>
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
                  {/* Цонхноос хэтрэхгүй — картын дотор багтах хэмжээ. */}
                <QRCode value={qrItem.code} size={Math.min(230, Dimensions.get('window').width - 140)} />
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
      <FuelRefillModal
        visible={refillVehicle !== null}
        vehicle={refillVehicle}
        onClose={() => setRefillVehicle(null)}
        onDone={load}
      />

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

const makeStyles = ({ colors, shadow }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    // Prototype «Машины хяналт»
    tripCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: colors.card, marginBottom: 12, ...shadow.md },
    tripIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
    tripTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
    tripSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
    tripBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
    tripBtnText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
    chips: { marginHorizontal: -16, marginBottom: 14 },
    car: { padding: 16, borderRadius: 20, backgroundColor: colors.card, marginBottom: 12, ...shadow.md },
    carTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    carCode: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    carSub: { color: colors.muted, fontSize: 12.5, marginTop: 1 },
    drv: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    drvName: { color: colors.ink, fontSize: 13.5, fontWeight: '600', flexShrink: 1 },
    drvNone: { color: colors.muted, fontSize: 13 },
    fuelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
    fuelLabel: { color: colors.muted, fontSize: 12.5 },
    fuelVal: { color: colors.ink, fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
    acts: { flexDirection: 'row', gap: 6, marginTop: 14 },
    act: { flex: 1, height: 36, borderRadius: 10, backgroundColor: colors.field, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    actDel: { backgroundColor: colors.badSoft },
    actText: { color: colors.ink, fontSize: 12.5, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    plateBoxInline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
    platePreview: { alignItems: 'center', marginBottom: spacing.md, marginTop: -4 },
    licenseLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    licenseVal: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: spacing.sm },
    qrPlateWrap: { alignSelf: 'center', marginBottom: spacing.sm },
    fuelMeta: { fontSize: 13, fontWeight: '800', marginTop: 6 },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.field, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
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
    qrBox: { backgroundColor: '#fff', padding: 14, borderRadius: radius.md, alignSelf: 'center' },
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
