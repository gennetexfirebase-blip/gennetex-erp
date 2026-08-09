import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import {
  Card,
  Button,
  ScreenHeader,
  SectionTitle,
  Badge,
  StatCard,
  EmptyState,
  formatMNT,
} from '../components/ui';
import BarcodeScanner from '../components/BarcodeScanner';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { VEHICLES } from '../data/mockData';
import { distanceMeters } from '../lib/geo';
import { calculateFuel, isDrivingSpeed, formatIdle } from '../lib/fuelCalc';
import { vehicleTankLiters, fuelLevelColor } from '../lib/vehicleFuelStats';
import FuelTankGauge from '../components/FuelTankGauge';
import MongoliaPlate from '../components/MongoliaPlate';
import * as vehicleApi from '../services/vehicleService';

export default function VehicleScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const { isAdmin, isCloud, currentUser, authProfile, fuelSettings, addFuelLog } = useApp();
  const [scanMode, setScanMode] = useState(null); // vehicle | passenger
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passengers, setPassengers] = useState([]);

  // Аялалын төлөв
  const [tripActive, setTripActive] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [moving, setMoving] = useState(false);
  const tripRef = useRef(null);
  const watchRef = useRef(null);
  const lastCoord = useRef(null);
  const distRef = useRef(0);
  const idleRef = useRef(0);
  const lastTickRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      if (!route.params?.autoScan || vehicle || tripActive || loading) return;
      navigation.setParams({ autoScan: undefined });
      setScanMode('vehicle');
    }, [route.params?.autoScan, vehicle, tripActive, loading, navigation])
  );

  const litersPer100 = vehicle?.liters_per_100km || fuelSettings.litersPer100km;
  const tankLiters = vehicleTankLiters(vehicle);
  const fuel = calculateFuel({
    distanceKm,
    idleSeconds,
    litersPer100km: litersPer100,
    idleLitersPerHour: fuelSettings.idleLitersPerHour,
    pricePerLiter: fuelSettings.pricePerLiter,
  });
  const baseFuelLevel = Number(vehicle?.fuel_level_percent ?? 100);
  const tripDrainPct = tankLiters > 0 ? (fuel.liters / tankLiters) * 100 : 0;
  const currentFuelLevel = Math.max(0, Math.min(100, Math.round((baseFuelLevel - tripDrainPct) * 10) / 10));
  const remainingLiters = Math.max(0, Math.round(((currentFuelLevel / 100) * tankLiters) * 10) / 10);

  useEffect(() => {
    if (!tripActive || !isCloud || !tripRef.current) return;
    const syncTripProgress = async () => {
      const km = distRef.current / 1000;
      const idle = Math.round(idleRef.current);
      const { liters: lit, cost: c } = calculateFuel({
        distanceKm: km,
        idleSeconds: idle,
        litersPer100km: litersPer100,
        idleLitersPerHour: fuelSettings.idleLitersPerHour,
        pricePerLiter: fuelSettings.pricePerLiter,
      });
      try {
        await vehicleApi.updateTrip(tripRef.current, {
          distanceKm: Number(km.toFixed(2)),
          liters: lit,
          cost: c,
          idleSeconds: idle,
        });
      } catch (e) {}
    };
    syncTripProgress();
    const id = setInterval(syncTripProgress, 15000);
    return () => clearInterval(id);
  }, [tripActive, isCloud, litersPer100, fuelSettings.idleLitersPerHour, fuelSettings.pricePerLiter]);

  const findVehicle = async (code) => {
    setLoading(true);
    try {
      let v = null;
      if (isCloud) {
        try {
          v = await vehicleApi.resolveVehicleScan(code);
        } catch (e) {}
      }
      if (!v) {
        const q = String(code || '').trim().toLowerCase();
        v =
          VEHICLES.find((x) => x.code.toLowerCase() === q) ||
          VEHICLES.find((x) => (x.plate_number || '').toLowerCase() === q) ||
          null;
      }
      if (!v) {
        Alert.alert('Олдсонгүй', `"${code}"кодтой машин бүртгэлд алга.`);
        return;
      }

      // QR уншсан ажилтан → тухайн машины жолооч болно (cloud үед)
      if (isCloud && v.id && currentUser?.id) {
        try {
          await vehicleApi.endDriverActiveTrips(currentUser.id);
          await vehicleApi.endStaleActiveTripsBeforeToday();
        } catch (e) {}
        tripRef.current = null;
        setTripActive(false);
        // Байршлыг best-effort авах (логт)
        let coord = {};
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          }
        } catch (e) {}
        try {
          const updated = await vehicleApi.assignDriver(v.id, {
            driverId: currentUser.id,
            driverName: currentUser.name || authProfile?.name,
          });
          v = updated || { ...v, driver_id: currentUser.id, driver_name: currentUser.name };
        } catch (e) {}
        try {
          await vehicleApi.logVehicleEvent({
            vehicle: v,
            userId: currentUser.id,
            userName: currentUser.name || authProfile?.name,
            event: 'scan',
            ...coord,
          });
        } catch (e) {}
      }

      setVehicle(v);
      setPassengers([]);
      if (isCloud && v.id && currentUser?.id) {
        try {
          const t = await vehicleApi.beginDriverTrip({
            vehicle: v,
            driverId: currentUser.id,
            driverName: currentUser.name || authProfile?.name,
          });
          tripRef.current = t.id;
        } catch (e) {
          console.warn('beginDriverTrip', e?.message || e);
        }
      }
      setScanMode('passenger');
    } finally {
      setLoading(false);
    }
  };

  const syncPassengerList = async (list) => {
    if (!isCloud || !tripRef.current) return;
    try {
      await vehicleApi.syncTripPassengers(tripRef.current, list, {
        driverId: currentUser?.id,
        driverName: currentUser?.name || authProfile?.name,
      });
    } catch (e) {
      console.warn('syncPassengers', e?.message || e);
    }
  };

  const persistPassenger = async (tripId, emp) => {
    if (!isCloud || !tripId) return;
    try {
      await vehicleApi.addTripPassenger(
        tripId,
        { passengerId: emp.id, passengerName: emp.name },
        { driverId: currentUser?.id, driverName: currentUser?.name || authProfile?.name }
      );
    } catch (e) {
      console.warn('passenger persist', e?.message || e);
    }
  };

  const addPassenger = async (emp) => {
    if (!emp?.id) return;
    if (emp.id === currentUser?.id) {
      Alert.alert('Анхаар', 'Өөрийгөө хамт яваа хүн болгож болохгүй.');
      return;
    }
    if (passengers.some((p) => p.id === emp.id)) {
      Alert.alert('Давхардал', `${emp.name} аль хэдийн бүртгэгдсэн.`);
      return;
    }
    if (isCloud) {
      try {
        const otherTrip = await vehicleApi.findPassengerActiveTripToday(emp.id, tripRef.current);
        if (otherTrip) {
          Alert.alert(
            'Бусад багт байна',
            `${emp.name} өнөөдөр ${otherTrip.driver_name || 'жолооч'}той идэвхтэй багт байна. Нэг хүн зөвхөн нэг багт орно.`
          );
          return;
        }
      } catch (e) {}
    }
    const next = {
      id: emp.id,
      name: emp.name,
      position: emp.position,
      avatar_url: emp.avatar_url,
    };
    const updated = [...passengers, next];
    setPassengers(updated);
    if (tripRef.current) {
      await persistPassenger(tripRef.current, next);
      await syncPassengerList(updated);
    }
    Alert.alert('Нэмэгдлээ', `${emp.name} хамт яваа хүн боллоо.`);
  };

  const handlePassengerScan = async (data) => {
    setScanMode(null);
    let emp = null;
    let scanError = null;
    if (isCloud) {
      try {
        emp = await vehicleApi.resolveEmployeeScan(data);
      } catch (e) {
        scanError = e?.message || 'Хайлт амжилтгүй';
      }
    }
    if (!emp) {
      Alert.alert(
        'Олдсонгүй',
        scanError
          ? `Ажилтны QR олдсонгүй: ${scanError}`
          : 'Ажилтны QR код уншуулна уу (Профайл → Миний QR).'
      );
      return;
    }
    await addPassenger(emp);
  };

  const handleScanned = (data) => {
    if (scanMode === 'passenger') {
      setScanMode(null);
      handlePassengerScan(data);
      return;
    }
    findVehicle(data);
  };

  const startTrip = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Зөвшөөрөл', 'Байршлын зөвшөөрөл шаардлагатай.');
      return;
    }
    distRef.current = 0;
    idleRef.current = 0;
    lastCoord.current = null;
    lastTickRef.current = null;
    setDistanceKm(0);
    setIdleSeconds(0);
    setTripActive(true);

    if (isCloud) {
      try {
        if (!tripRef.current) {
          const t = await vehicleApi.beginDriverTrip({
            vehicle,
            driverId: currentUser?.id,
            driverName: currentUser?.name || vehicle.driver_name,
          });
          tripRef.current = t.id;
        }
        await syncPassengerList(passengers);
      } catch (e) {
        console.warn('startTrip sync', e?.message || e);
      }
      try {
        await vehicleApi.logVehicleEvent({
          vehicle,
          userId: currentUser?.id,
          userName: currentUser?.name || authProfile?.name,
          event: 'trip_start',
        });
      } catch (e) {}
    }

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
      (pos) => {
        const coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        const now = pos.timestamp || Date.now();
        const driving = isDrivingSpeed(pos.coords.speed);
        setMoving(driving);

        if (lastTickRef.current != null) {
          const elapsed = Math.max(0, (now - lastTickRef.current) / 1000);
          if (!driving) {
            idleRef.current += elapsed;
            setIdleSeconds(idleRef.current);
          }
        }
        lastTickRef.current = now;

        if (driving) {
          if (lastCoord.current) {
            const d = distanceMeters(lastCoord.current, coord);
            if (d >= 5 && d <= 300) {
              distRef.current += d;
              setDistanceKm(distRef.current / 1000);
            }
          }
          lastCoord.current = coord;
        }
      }
    );
  };

  const stopTrip = async () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setTripActive(false);
    setMoving(false);
    const km = distRef.current / 1000;
    const idle = Math.round(idleRef.current);
    const { liters: lit, cost: c } = calculateFuel({
      distanceKm: km,
      idleSeconds: idle,
      litersPer100km: litersPer100,
      idleLitersPerHour: fuelSettings.idleLitersPerHour,
      pricePerLiter: fuelSettings.pricePerLiter,
    });

    if (!isCloud && (km > 0 || idle > 0)) {
      addFuelLog({ km: Number(km.toFixed(2)), idleSeconds: idle, liters: lit, cost: c });
    }
    if (isCloud && tripRef.current) {
      try {
        await vehicleApi.endTrip(tripRef.current, {
          distanceKm: km,
          liters: lit,
          cost: c,
          idleSeconds: idle,
        });
      } catch (e) {}
    }
    if (isCloud) {
      try {
        await vehicleApi.logVehicleEvent({
          vehicle,
          userId: currentUser?.id,
          userName: currentUser?.name || authProfile?.name,
          event: 'trip_end',
          distanceKm: km,
          liters: lit,
          cost: c,
        });
      } catch (e) {}
    }
    tripRef.current = null;
    setPassengers([]);
    const idleNote = idle > 0 ? ` · тогтмол ${formatIdle(idle)}` : '';
    const costNote = isAdmin ? ` · ${formatMNT(c)}` : '';
    Alert.alert('Аялал дууслаа', `${km.toFixed(2)} км · ${lit.toFixed(2)} л${idleNote}${costNote}`);
  };

  const reset = () => {
    setVehicle(null);
    setPassengers([]);
    setDistanceKm(0);
    setIdleSeconds(0);
    distRef.current = 0;
    idleRef.current = 0;
    lastCoord.current = null;
    lastTickRef.current = null;
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Машины хяналт" subtitle="QR / бар код уншиж аялал эхлүүлэх"/>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        {!vehicle ? (
          <Card>
            <SectionTitle>Бар код / QR унших</SectionTitle>
            <Text style={styles.help}>
              Машин дээрх QR эсвэл зураасан кодыг уншуулна. Код, улсын дугаар, бар кодоор хайна.
            </Text>
            <Button
              title={loading ? 'Хайж байна...' : 'Бар код / QR унших'} onPress={() => setScanMode('vehicle')}
              disabled={loading}
            />
          </Card>
        ) : (
          <>
            <Card>
              <View style={styles.vehHead}>
                <MongoliaPlate plate={vehicle.plate_number} size="lg" />
                {tripActive && (
                  <Badge
                    text={moving ? 'Хөдөлж байна' : 'Зогсож байна'}
                    color={moving ? colors.success : colors.textMuted}
                  />
                )}
              </View>
              <View style={styles.infoRow}>
                <InfoCol label="Код" value={vehicle.code} />
                <InfoCol label="100км-т" value={`${litersPer100} л`} />
                <InfoCol label="Сав" value={`${tankLiters} л`} />
                <InfoCol label="Бензин" value={`${currentFuelLevel}%`} />
              </View>
              <View style={[styles.infoRow, { marginTop: spacing.sm }]}>
                <InfoCol label="Жолооч" value={vehicle.driver_name || '—'} />
                {tripActive ? <InfoCol label="Явсан" value={`${distanceKm.toFixed(1)} км`} /> : null}
              </View>
            </Card>

            {/* Хариуцсан жолоочийн мэдээлэл */}
            <Card>
              <SectionTitle>Хариуцсан жолооч</SectionTitle>
              <View style={styles.driverRow}>
                <View style={styles.driverAvatar}>
                  {authProfile?.avatar_url ? (
                    <Image source={{ uri: authProfile.avatar_url }} style={styles.driverAvatarImg} />
                  ) : (
                    <Text style={styles.passengerLetter}>?</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>
                    {authProfile?.name || currentUser?.name || vehicle.driver_name || 'Жолооч'}
                  </Text>
                  {authProfile?.position ? (
                    <Text style={styles.driverSub}>{authProfile.position}</Text>
                  ) : null}
                  {authProfile?.phone ? (
                    <Text style={styles.driverSub}>{authProfile.phone}</Text>
                  ) : null}
                  {authProfile?.email ? (
                    <Text style={styles.driverSub}>{authProfile.email}</Text>
                  ) : null}
                </View>
              </View>
            </Card>

            <Card>
              <SectionTitle>Хамт яваа хүн</SectionTitle>
              <Text style={styles.help}>
                Эхлээд машины QR, дараа нь ажилтны QR уншуулна. Зөвхөн уншсан хүмүүс энэ багт орно — өөр багтай холихгүй.
              </Text>
              {passengers.length === 0 ? (
                <Text style={styles.emptyPassengers}>Хамт яваа хүн бүртгэгдээгүй</Text>
              ) : (
                passengers.map((p) => (
                  <View key={p.id} style={styles.passengerRow}>
                    <View style={styles.passengerAvatar}>
                      {p.avatar_url ? (
                        <Image source={{ uri: p.avatar_url }} style={styles.driverAvatarImg} />
                      ) : (
                        <Text style={styles.passengerLetter}>{(p.name || ' ?').charAt(0)}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.passengerName}>{p.name}</Text>
                      {p.position ? <Text style={styles.driverSub}>{p.position}</Text> : null}
                    </View>
                  </View>
                ))
              )}
              <Button
                title="Хамт яваа хүн нэмэх" variant="success"
                size="sm"
                style={{ marginTop: spacing.md }}
                onPress={() => setScanMode('passenger')}
              />
            </Card>

            <View style={styles.statRow}>
              <StatCard label="Явсан зам" value={`${distanceKm.toFixed(2)} км`} color={colors.primary} />
              <StatCard label="Түлш" value={`${fuel.liters.toFixed(2)} л`} color={colors.accent} />
              {tripActive && idleSeconds > 0 ? (
                <StatCard label="Тогтмол" value={formatIdle(idleSeconds)} color={colors.textMuted} />
              ) : isAdmin ? (
                <StatCard label="Зардал" value={formatMNT(fuel.cost)} color={colors.warning} />
              ) : null}
            </View>

            <Card>
              <SectionTitle>Бензиний түвшин</SectionTitle>
              <View style={styles.fuelGaugeRow}>
                <FuelTankGauge
                  levelPercent={currentFuelLevel}
                  tankLiters={tankLiters}
                  remainingLiters={remainingLiters}
                  height={130}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fuelLevelText, { color: fuelLevelColor(currentFuelLevel) }]}>
                    {currentFuelLevel}%
                  </Text>
                  <Text style={styles.help}>
                    {remainingLiters.toFixed(1)} л үлдсэн · сав {tankLiters} л
                  </Text>
                  {tripActive ? (
                    <Text style={styles.help}>Энэ аялалд: {fuel.liters.toFixed(2)} л зарцуулсан</Text>
                  ) : null}
                </View>
              </View>
            </Card>

            <Card>
              {!tripActive ? (
                <>
                  <SectionTitle>Аялал</SectionTitle>
                  <Text style={styles.help}>
                    Эхлүүлбэл зөвхөн машин хөдөлж байхад (~5 км/ц+) км тоологдоно. Зогссон үед түлш тооцохгүй.
                  </Text>
                  <Button title="Аялал эхлүүлэх" variant="success" onPress={startTrip} />
                  <Button
                    title="Хамт яваа хүн нэмэх" variant="ghost"
                    style={{ marginTop: spacing.sm }}
                    onPress={() => setScanMode('passenger')}
                  />
                  <Button title="Дахин унших" variant="ghost" style={{ marginTop: spacing.sm }} onPress={() => setScanMode('vehicle')} />
                  <Button title="Өөр машин" variant="ghost" style={{ marginTop: spacing.xs }} onPress={reset} />
                </>
              ) : (
                <>
                  <SectionTitle>Аялал явж байна</SectionTitle>
                  <Text style={styles.help}>
                    {moving
                      ? 'Машин хөдөлж байна — км тоологдож байна.'
                      : `Зогсож байна${idleSeconds > 0 ? ` (${formatIdle(idleSeconds)})` : ''}. Түлш зөвхөн хөдөлсөн үед тооцогдоно.`}
                  </Text>
                  <Button title="Аялал дуусгах" variant="danger" onPress={stopTrip} />
                  <Button
                    title="Ажлын байр" variant="ghost"
                    style={{ marginTop: spacing.sm }}
                    onPress={() => navigation.navigate('SiteWork')}
                  />
                  <Button
                    title="Хамт яваа хүн нэмэх" variant="ghost"
                    style={{ marginTop: spacing.sm }}
                    onPress={() => setScanMode('passenger')}
                  />
                </>
              )}
            </Card>
          </>
        )}
      </ScrollView>

      <BarcodeScanner
        visible={scanMode !== null}
        onClose={() => setScanMode(null)}
        onScanned={handleScanned}
        title={scanMode === 'passenger' ? 'Ажилтны QR' : 'Машины QR'}
        hint={
          scanMode === 'passenger'
            ? 'Хамт яваа ажилтны профайлын QR уншуулна уу'
            : 'Машины QR кодыг том хүрээнд төвлүүрнэ үү'
        }
        frameWidth={320}
        frameHeight={320}
      />
    </View>
  );
}

function InfoCol({ label, value }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.infoCol}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  help: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 },
  vehHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  infoRow: { flexDirection: 'row', marginTop: spacing.md },
  infoCol: { flex: 1 },
  infoLabel: { color: colors.textMuted, fontSize: 12 },
  infoValue: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 3 },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.lg },
  fuelGaugeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  fuelLevelText: { fontSize: 32, fontWeight: '900' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  driverAvatarImg: { width: '100%', height: '100%'},
  driverName: { color: colors.text, fontSize: 17, fontWeight: '800'},
  driverSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  emptyPassengers: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic'},
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  passengerLetter: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  passengerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
