import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, ScreenHeader, SectionTitle, Badge, StatCard, EmptyState, formatMNT } from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { VEHICLES } from '../data/mockData';
import { calculateFuel } from '../lib/fuelCalc';
import { vehicleTankLiters, fuelLevelColor } from '../lib/vehicleFuelStats';
import FuelTankGauge from '../components/FuelTankGauge';
import MongoliaPlate from '../components/MongoliaPlate';
import * as vehicleApi from '../services/vehicleService';
import { supabase } from '../lib/supabase';

/**
 * Өдрийн машин сонгох.
 *
 * QR уншихын оронд: ирц бүртгүүлсний дараа машинаа жагсаалтаас сонгоно.
 * Нэг машиныг өдөрт ХАМГИЙН ИХДЭЭ 2 хүн сонгоно — эхнийх нь жолооч, хоёр
 * дахь нь хамт яваа; хоёулаа нэг баг болно. Явсан км нь тэр 2-ын ажлын
 * үеийн байршлаас серверт тооцогдож, явснаа бүртгүүлэхэд хадгалагдана
 * (`supabase/migrations/20261006120000_vehicle_daily_crew.sql`).
 */
export default function VehicleScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const { isAdmin, isCloud, currentUser, shiftStatus, fuelSettings } = useApp();
  const MAX = vehicleApi.VEHICLE_CREW_MAX;

  const [vehicles, setVehicles] = useState([]);
  const [crews, setCrews] = useState({});
  const [distanceKm, setDistanceKm] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState(null);

  const myId = currentUser?.id;
  const myVehicleId = useMemo(
    () => Object.keys(crews).find((vid) => crews[vid].members.some((m) => m.id === myId)) || null,
    [crews, myId]
  );
  const myVehicle = vehicles.find((v) => v.id === myVehicleId) || null;
  const myCrew = myVehicleId ? crews[myVehicleId] : null;
  // Demo данс (Play шинжээч) өнөөдрийн ирцгүй тул шууд сонгох жагсаалт харна.
  const checkedIn = !isCloud || !!supabase?.__demo || (shiftStatus?.checkedIn && !shiftStatus?.checkedOut);

  const load = useCallback(async () => {
    setError(null);
    if (!isCloud) {
      setVehicles(VEHICLES);
      setLoading(false);
      return;
    }
    try {
      const [list, today] = await Promise.all([vehicleApi.fetchVehicles(), vehicleApi.fetchVehicleCrewsToday()]);
      setVehicles(list.slice().sort((a, b) => String(a.plate_number || '').localeCompare(String(b.plate_number || ''))));
      setCrews(today);
      const mine = Object.values(today).find((c) => c.members.some((m) => m.id === myId));
      if (mine?.tripId) {
        try {
          setDistanceKm(await vehicleApi.fetchTripDistanceKm(mine.tripId));
        } catch (e) {}
      } else {
        setDistanceKm(0);
      }
    } catch (e) {
      setError(e?.message || 'Ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  }, [isCloud, myId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const join = async (v) => {
    const crew = crews[v.id];
    const count = crew?.members.length || 0;
    const role = count === 0 ? 'жолооч' : 'хамт яваа';
    const withWhom = crew?.members[0]?.name ? ` ${crew.members[0].name}-тэй нэг баг болно.` : '';
    Alert.alert(
      v.plate_number || 'Машин',
      `Энэ машиныг өнөөдөр сонгох уу? Та ${role} болно.${withWhom}\n\nӨдөрт нэг машинд л явна — дараа солих боломжгүй.`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Сонгох',
          onPress: async () => {
            if (!isCloud) {
              setCrews((old) => ({
                ...old,
                [v.id]: {
                  tripId: null,
                  members: [...(old[v.id]?.members || []), { id: myId, name: currentUser?.name, role: count ? 'passenger' : 'driver' }],
                },
              }));
              return;
            }
            setJoiningId(v.id);
            try {
              const r = await vehicleApi.joinVehicleToday(v.id);
              await load();
              if (!r?.already) {
                Alert.alert(
                  'Сонгогдлоо',
                  r?.role === 'driver'
                    ? `${v.plate_number} — та жолооч. Хамт явах хүн ирц бүртгүүлээд энэ машиныг сонгоход нэг баг болно.`
                    : `${v.plate_number} — та хамт яваа. Багийн явсан км таны 2-ын байршлаас тооцогдоно.`
                );
              }
            } catch (e) {
              Alert.alert('Сонгож болсонгүй', vehicleApi.vehicleJoinErrorText(e));
              load();
            } finally {
              setJoiningId(null);
            }
          },
        },
      ]
    );
  };

  const refresh = (
    <RefreshControl
      refreshing={loading && !!vehicles.length}
      onRefresh={() => {
        setLoading(true);
        load();
      }}
    />
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Машин" subtitle="Ирц бүртгүүлсний дараа өнөөдрийн машинаа сонгоно" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} refreshControl={refresh}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {myVehicle ? (
          <MyVehicle
            vehicle={myVehicle}
            crew={myCrew}
            myId={myId}
            distanceKm={distanceKm}
            fuelSettings={fuelSettings}
            isAdmin={isAdmin}
            onSiteWork={() => navigation.navigate('SiteWork')}
          />
        ) : !checkedIn ? (
          <Card>
            <SectionTitle>Эхлээд ирцээ бүртгүүлнэ</SectionTitle>
            <Text style={styles.help}>
              {shiftStatus?.checkedOut
                ? 'Та өнөөдөр явснаа бүртгүүлсэн тул машин сонгох боломжгүй.'
                : 'Ирснээ бүртгүүлсний дараа өнөөдөр явах машинаа энд сонгоно.'}
            </Text>
            {!shiftStatus?.checkedOut ? (
              <Button title="Ирц бүртгүүлэх" onPress={() => navigation.navigate('Attendance')} />
            ) : null}
          </Card>
        ) : (
          <>
            <Text style={styles.help}>
              Өнөөдөр явах машинаа сонгоно уу. Нэг машиныг {MAX} хүн сонгоно — эхэлж сонгосон нь жолооч, дараагийнх
              нь хамт яваа болж нэг баг болно.
            </Text>
            {!loading && !vehicles.length ? <EmptyState text="Бүртгэлтэй машин алга" /> : null}
            {vehicles.map((v) => {
              const members = crews[v.id]?.members || [];
              const full = members.length >= MAX;
              const busy = joiningId === v.id;
              return (
                <Pressable
                  key={v.id}
                  disabled={full || !!joiningId}
                  onPress={() => join(v)}
                  style={({ pressed }) => [styles.vehRow, full && styles.vehRowFull, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${v.plate_number}, ${members.length}/${MAX}`}
                >
                  <MongoliaPlate plate={v.plate_number} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehMembers} numberOfLines={2}>
                      {members.length ? members.map((m) => m.name).join(' + ') : 'Сул'}
                    </Text>
                  </View>
                  <Badge
                    text={busy ? '...' : full ? 'Дүүрсэн' : `${members.length}/${MAX}`}
                    color={full ? colors.textMuted : members.length ? colors.warning : colors.success}
                  />
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MyVehicle({ vehicle, crew, myId, distanceKm, fuelSettings, isAdmin, onSiteWork }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const litersPer100 = vehicle.liters_per_100km || fuelSettings.litersPer100km;
  const tankLiters = vehicleTankLiters(vehicle);
  const fuel = calculateFuel({
    distanceKm,
    idleSeconds: 0,
    litersPer100km: litersPer100,
    idleLitersPerHour: fuelSettings.idleLitersPerHour,
    pricePerLiter: fuelSettings.pricePerLiter,
  });
  const base = Number(vehicle.fuel_level_percent ?? 0);
  const drain = tankLiters > 0 ? (fuel.liters / tankLiters) * 100 : 0;
  const level = Math.max(0, Math.min(100, Math.round((base - drain) * 10) / 10));
  const remaining = Math.max(0, Math.round((level / 100) * tankLiters * 10) / 10);
  const members = crew?.members || [];

  return (
    <>
      <Card>
        <View style={styles.vehHead}>
          <MongoliaPlate plate={vehicle.plate_number} size="lg" />
          <Badge text="Өнөөдрийн машин" color={colors.success} />
        </View>
        <SectionTitle style={{ marginTop: spacing.md }}>Баг</SectionTitle>
        {members.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberLetter}>{(m.name || '?').charAt(0)}</Text>
            </View>
            <Text style={styles.memberName}>
              {m.name}
              {m.id === myId ? ' (та)' : ''}
            </Text>
            <Text style={styles.memberRole}>{m.role === 'driver' ? 'Жолооч' : 'Хамт яваа'}</Text>
          </View>
        ))}
        {members.length < vehicleApi.VEHICLE_CREW_MAX ? (
          <Text style={styles.help}>
            Хамт явах хүн ирцээ бүртгүүлээд энэ машиныг сонгоход нэг баг болно.
          </Text>
        ) : null}
      </Card>

      <View style={styles.statRow}>
        <StatCard label="Явсан зам" value={`${distanceKm.toFixed(1)} км`} color={colors.primary} />
        <StatCard label="Түлш" value={`${fuel.liters.toFixed(1)} л`} color={colors.accent} />
        {isAdmin ? <StatCard label="Зардал" value={formatMNT(fuel.cost)} color={colors.warning} /> : null}
      </View>
      <Text style={styles.help}>
        Км нь багийн гишүүдийн ажлын үеийн байршлаас автоматаар тооцогдоно. Бүгд явснаа бүртгүүлэхэд аялал дуусч, түлш
        хасагдана.
      </Text>

      <Card>
        <SectionTitle>Бензиний түвшин</SectionTitle>
        <View style={styles.fuelGaugeRow}>
          <FuelTankGauge levelPercent={level} tankLiters={tankLiters} remainingLiters={remaining} height={130} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.fuelLevelText, { color: fuelLevelColor(level) }]}>{level}%</Text>
            <Text style={styles.help}>
              {remaining.toFixed(1)} л үлдсэн · сав {tankLiters} л · 100км-т {litersPer100} л
            </Text>
          </View>
        </View>
      </Card>

      <Button title="Ажлын байр" variant="ghost" style={{ marginTop: spacing.sm }} onPress={onSiteWork} />
    </>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    help: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 },
    error: { color: colors.danger, fontSize: 13, marginBottom: spacing.md },
    vehHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    vehRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    vehRowFull: { opacity: 0.5 },
    vehMembers: { color: colors.text, fontSize: 14, fontWeight: '600' },
    statRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.lg },
    fuelGaugeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    fuelLevelText: { fontSize: 32, fontWeight: '900' },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    memberAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberLetter: { color: colors.primary, fontWeight: '800', fontSize: 15 },
    memberName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
    memberRole: { color: colors.textMuted, fontSize: 12 },
  });
