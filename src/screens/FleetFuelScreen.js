import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import FuelRefillModal from '../components/FuelRefillModal';
import FuelPriceCard from '../components/FuelPriceCard';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, ScreenHeader, SectionTitle, Badge, StatCard, EmptyState, formatMNT } from '../components/ui';
import FuelTankGauge from '../components/FuelTankGauge';
import MongoliaPlate from '../components/MongoliaPlate';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as vehicleApi from '../services/vehicleService';
import { buildVehicleFuelStats } from '../lib/vehicleFuelStats';

/** "08-28 14:30" — товч бөгөөд ойлгомжтой. */
function fmtRefillDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function FleetFuelScreen() {
  const navigation = useNavigation();
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

  /**
   * Цэнэглэх — админ ЗӨВХӨН МӨНГӨН ДҮНГЭЭ оруулна.
   *
   * ⚠️ Өмнө нь "100% болгох" гэсэн ганц товч байсан тул хэдэн төгрөгийн
   *    түлш авсан нь хаана ч бүртгэгдэхгүй, зарцуулалтын тайлан
   *    бодит бус байв. Одоо литр нь тухайн үеийн 1 литрийн үнээр
   *    СЕРВЕР дээр тооцогдож, мөнгө/литр/үнэ гурвуулаа бүртгэгдэнэ.
   */
  const [refillVehicle, setRefillVehicle] = useState(null);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Бензин зарцуулалт"
        subtitle="Машин · км · савны түвшин"
        right={
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => navigation.navigate('FuelSpendReport')}
            activeOpacity={0.8}
          >
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
            <Text style={styles.reportText}>Зардал</Text>
          </TouchableOpacity>
        }
      />
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

        {/* Түлшний үнэ — ШТС-д очиж шинэ үнэ хараад тэр дороо
            шинэчлэх боломжтой байхын тулд цэнэглэлтийн дэлгэц дээрээ. */}
        <FuelPriceCard isAdmin={isAdmin} onChanged={load} />

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

              {/* Сүүлийн цэнэглэлт ба тэрнээс хойшх зарцуулалт.
                  Түвшин яагаад ийм байгааг тайлбарлана — эс бөгөөс
                  хувь өөрөө өөрчлөгдсөн мэт харагдана. */}
              {row.vehicle?.fuel_refilled_at ? (
                <View style={styles.refillMark}>
                  <Text style={styles.refillMarkIcon}>⛽</Text>
                  <Text style={styles.refillMarkText}>
                    {fmtRefillDate(row.vehicle.fuel_refilled_at)}-нд цэнэглэсэн
                    {Number(row.usedSinceRefill) > 0
                      ? ` · тэрнээс хойш ${Number(row.usedSinceRefill).toFixed(1)} л зарцуулсан`
                      : ' · хараахан зарцуулаагүй'}
                  </Text>
                </View>
              ) : null}
              {isAdmin && row.vehicle?.id ? (
                <TouchableOpacity
                  style={styles.refillBtn}
                  onPress={() => setRefillVehicle(row.vehicle)}
                >
                  <Text style={styles.refillText}>Түлш цэнэглэх</Text>
                </TouchableOpacity>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>

      <FuelRefillModal
        visible={refillVehicle !== null}
        vehicle={refillVehicle}
        onClose={() => setRefillVehicle(null)}
        onDone={load}
      />
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

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
    refillMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceContainer,
  },
  refillMarkIcon: { fontSize: 13 },
  refillMarkText: { color: colors.textMuted, fontSize: 11.5, flex: 1, lineHeight: 16 },
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
