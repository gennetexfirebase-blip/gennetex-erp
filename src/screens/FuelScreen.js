import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  Card,
  Button,
  Field,
  StatCard,
  SectionTitle,
  ScreenHeader,
  EmptyState,
  formatMNT,
} from '../components/ui';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as vehicleApi from '../services/vehicleService';
import { formatIdle } from '../lib/fuelCalc';

export default function FuelScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const {
    isAdmin,
    isCloud,
    currentUser,
    fuelSettings,
    updateFuelSettings,
    fuelLogs,
    removeFuelLog,
  } = useApp();

  const [litersPer100, setLitersPer100] = useState(String(fuelSettings.litersPer100km));
  const [pricePerLiter, setPricePerLiter] = useState(String(fuelSettings.pricePerLiter));
  const [myTrips, setMyTrips] = useState([]);

  React.useEffect(() => {
    setLitersPer100(String(fuelSettings.litersPer100km));
    setPricePerLiter(String(fuelSettings.pricePerLiter));
  }, [fuelSettings]);

  const loadTrips = useCallback(async () => {
    if (!isCloud || !currentUser?.id) return;
    try {
      setMyTrips(await vehicleApi.fetchMyTrips(currentUser.id));
    } catch (e) {}
  }, [isCloud, currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const tripRows = isCloud ? myTrips.filter((t) => t.status === 'done') : fuelLogs;
  const totalKm = useMemo(
    () => tripRows.reduce((s, t) => s + Number(t.distance_km ?? t.km ?? 0), 0),
    [tripRows]
  );
  const totalLiters = useMemo(
    () => tripRows.reduce((s, t) => s + Number(t.liters ?? 0), 0),
    [tripRows]
  );
  const totalCost = useMemo(
    () => tripRows.reduce((s, t) => s + Number(t.cost ?? 0), 0),
    [tripRows]
  );

  const handleSaveSettings = async () => {
    await updateFuelSettings({
      litersPer100km: Number(litersPer100) || 0,
      pricePerLiter: Number(pricePerLiter) || 0,
      idleLitersPerHour: fuelSettings.idleLitersPerHour ?? 0,
    });
  };

  const header = (
    <View>
      <View style={styles.statRow}>
        <StatCard label="Нийт явсан" value={`${totalKm.toFixed(1)} км`} color={colors.primary} />
        <StatCard label="Нийт түлш" value={`${totalLiters.toFixed(1)} л`} color={colors.accent} />
        {isAdmin ? (
          <StatCard label="Зардал" value={formatMNT(totalCost)} color={colors.warning} />
        ) : null}
      </View>

      {!isAdmin ? (
        <Card>
          <Text style={styles.note}>
            Машин хөдөлж байхад л км тоологдоно. Зогссон үед түлш тооцохгүй.
          </Text>
          <Text style={styles.note}>Бензиний тохиргоог зөвхөн админ засна.</Text>
        </Card>
      ) : (
        <Card>
          <SectionTitle>Бензиний тохиргоо (админ)</SectionTitle>
          <Field
            label="100км-т зарцуулах литр"
            keyboardType="numeric"
            value={litersPer100}
            onChangeText={setLitersPer100}
          />
          <Field
            label="1 литрийн үнэ (₮)"
            keyboardType="numeric"
            value={pricePerLiter}
            onChangeText={setPricePerLiter}
          />
          <Text style={styles.note}>
            Аялалын үед зөвхөн машин хөдөлж байхад км нэмэгдэнэ. Зогссон үед түлш тооцохгүй.
          </Text>
          <Button title="Тохиргоо хадгалах" onPress={handleSaveSettings} style={{ marginTop: spacing.sm }} />
        </Card>
      )}

      <SectionTitle style={{ marginTop: spacing.sm }}> Аяллын түүх</SectionTitle>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Бензиний зарлага"
        subtitle={isAdmin ? 'Тохиргоо + тайлан' : 'Явсан км · нийт түлш'}
      />
      <FlatList
        data={tripRows}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const km = Number(item.distance_km ?? item.km ?? 0);
          const liters = Number(item.liters ?? 0);
          const idle = Number(item.idle_seconds ?? item.idleSeconds ?? 0);
          const date = item.ended_at || item.started_at || item.date;
          return (
            <Card style={styles.logCard}>
              <View style={styles.logIcon}>
                <Text style={{ fontSize: 20 }}></Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.logKm}>
                  {km.toFixed(2)} км · {liters.toFixed(2)} л
                </Text>
                {idle > 0 ? (
                  <Text style={styles.logSub}>Тогтмол: {formatIdle(idle)}</Text>
                ) : null}
                {item.plate_number ? (
                  <Text style={styles.logSub}>{item.plate_number}</Text>
                ) : null}
                <Text style={styles.logDate}>
                  {date ? new Date(date).toLocaleString('mn-MN') : '—'}
                </Text>
              </View>
              {isAdmin ? (
                <View style={{ alignItems: 'flex-end'}}>
                  <Text style={styles.logCost}>{formatMNT(item.cost ?? 0)}</Text>
                  {!isCloud && item.id ? (
                    <TouchableOpacity onPress={() => removeFuelLog(item.id)} hitSlop={8}>
                      <Text style={styles.delete}>Устгах</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={<EmptyState text="Аяллын бүртгэл алга. Машины QR-аар аялал эхлүүлнэ." />}
      />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.xs },
  logCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logKm: { color: colors.text, fontSize: 15, fontWeight: '800'},
  logSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  logDate: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  logCost: { color: colors.warning, fontSize: 16, fontWeight: '800'},
  delete: { color: colors.danger, marginTop: 6, fontWeight: '700', fontSize: 12 },
});
