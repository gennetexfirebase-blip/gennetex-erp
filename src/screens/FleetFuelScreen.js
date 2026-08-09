import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, ScreenHeader, SectionTitle, Badge, StatCard, EmptyState, formatMNT } from '../components/ui';
import FuelTankGauge from '../components/FuelTankGauge';
import MongoliaPlate from '../components/MongoliaPlate';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as vehicleApi from '../services/vehicleService';
import { buildVehicleFuelStats } from '../lib/vehicleFuelStats';

export default function FleetFuelScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isAdmin, isCloud } = useApp();
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    if (!isCloud) return;
    try {
      const [v, t] = await Promise.all([vehicleApi.fetchVehicles(), vehicleApi.fetchTrips(300)]);
      setVehicles(v || []);
      setTrips(t || []);
    } catch (e) {}
  }, [isCloud]);

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, 12000);
      return () => clearInterval(id);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const rows = useMemo(() => buildVehicleFuelStats(vehicles, trips, { days }), [vehicles, trips, days]);
  const activeCount = rows.filter((r) => r.active).length;
  const totalKm = rows.reduce((s, r) => s + r.totalKm, 0);

  const refill = (vehicle) => {
    if (!isAdmin || !vehicle?.id) return;
    Alert.alert('Сав дүүргэх', `${vehicle.plate_number} — бензиний түвшинг 100% болгох уу?`, [
      { text: 'Болих', style: 'cancel' },
      {
        text: '100% болгох',
        onPress: async () => {
          try {
            await vehicleApi.refillVehicleFuel(vehicle.id);
            await load();
          } catch (e) {
            Alert.alert('Алдаа', e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Бензин зарцуулалт" subtitle="Машин · км · савны түвшин" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statRow}>
          <StatCard label="Машин" value={String(rows.length)} color={colors.primary} />
          <StatCard label="Явж байна" value={String(activeCount)} color={colors.success} />
          <StatCard label="Нийт км" value={`${totalKm.toFixed(0)}`} color={colors.accent} />
        </View>

        <View style={styles.filterRow}>
          {[7, 30, 90].map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.filterChip, days === d && styles.filterChipOn]}
              onPress={() => setDays(d)}
            >
              <Text style={[styles.filterText, days === d && styles.filterTextOn]}>{d} хоног</Text>
            </TouchableOpacity>
          ))}
        </View>

        {rows.length === 0 ? (
          <EmptyState text="Машин эсвэл аяллын бүртгэл алга." />
        ) : (
          rows.map((row) => (
            <Card key={row.vehicle?.id || row.plate} style={styles.vehicleCard}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <MongoliaPlate plate={row.plate} size="sm" />
                    {row.active ? <Badge text="Явж байна" color={colors.success} /> : null}
                  </View>
                  <Text style={styles.meta}>Жолооч: {row.driver}</Text>
                  <Text style={styles.meta}>
                    {row.totalKm.toFixed(1)} км · {row.periodLiters.toFixed(1)} л
                    {row.trips > 0 ? ` · ${row.trips} аялал` : ''}
                  </Text>
                  {isAdmin && row.cost > 0 ? (
                    <Text style={styles.cost}>{formatMNT(row.cost)}</Text>
                  ) : null}
                </View>
                <FuelTankGauge
                  levelPercent={row.currentLevel}
                  tankLiters={row.tank}
                  remainingLiters={row.remainingLiters}
                />
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${row.currentLevel}%`, backgroundColor: row.levelColor },
                  ]}
                />
              </View>
              <Text style={styles.barHint}>
                Бензиний түвшин: <Text style={{ color: row.levelColor, fontWeight: '800' }}>{row.currentLevel}%</Text>
                {' · '}
                {row.remainingLiters.toFixed(1)} / {row.tank} л үлдсэн
              </Text>
              {isAdmin && row.vehicle?.id ? (
                <TouchableOpacity style={styles.refillBtn} onPress={() => refill(row.vehicle)}>
                  <Text style={styles.refillText}>Сав дүүргэх (100%)</Text>
                </TouchableOpacity>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    filterTextOn: { color: colors.primary },
    vehicleCard: { marginBottom: spacing.md },
    cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    plate: { fontSize: 18, fontWeight: '900', color: colors.text },
    meta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
    cost: { color: colors.warning, fontSize: 14, fontWeight: '800', marginTop: 4 },
    barTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.bgAlt,
      overflow: 'hidden',
      marginTop: spacing.md,
    },
    barFill: { height: '100%', borderRadius: 999 },
    barHint: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 },
    refillBtn: {
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    refillText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  });
