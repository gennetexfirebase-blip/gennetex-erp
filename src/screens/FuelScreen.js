import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
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
import * as fuelApi from '../services/fuelPriceService';
import { friendlyError } from '../lib/erpMessages';
import FuelReceiptCard from '../components/FuelReceiptCard';
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
  // Сервер дээрх БОДИТ түлшний үнэ (fuel_prices). Тохиргооны
  // `pricePerLiter`-тэй хоёр тийш синк болно — эс бөгөөс аяллын
  // зардал ба цэнэглэлт хоёр өөр үнээр тооцогдоно.
  const [serverPrices, setServerPrices] = useState([]);

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

  const loadPrices = useCallback(async () => {
    if (!isCloud) return;
    try {
      const list = await fuelApi.fetchCurrentPrices();
      setServerPrices(list);
      // АИ-92-ийн бодит үнэ байвал талбарыг түүгээр дүүргэнэ —
      // админ хуучин тоог хараад андуурахаас сэргийлнэ.
      const ai92 = list.find((p) => p.fuel_type === 'ai92');
      if (ai92) setPricePerLiter(String(Math.round(Number(ai92.price_mnt))));
    } catch (e) {}
  }, [isCloud]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
      loadPrices();
    }, [loadTrips, loadPrices])
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
    const price = Number(pricePerLiter) || 0;
    await updateFuelSettings({
      litersPer100km: Number(litersPer100) || 0,
      pricePerLiter: price,
      idleLitersPerHour: fuelSettings.idleLitersPerHour ?? 0,
    });

    // ⚠️ Сервер дээр ч бичнэ. Цэнэглэлт (мөнгө → литр) нь `fuel_prices`
    //    хүснэгтээс уншдаг тул зөвхөн локал тохиргоонд хадгалбал хоёр
    //    өөр үнэ үүсч, аяллын зардал ба цэнэглэлт зөрнө.
    if (isCloud && price > 0) {
      try {
        await fuelApi.setPrice({ fuelType: 'ai92', price });
        await loadPrices();
        Alert.alert('Хадгаллаа', `АИ-92: ${price.toLocaleString('mn-MN')}₮ / литр`);
      } catch (e) {
        Alert.alert(
          'Тохиргоо хадгалагдлаа',
          'Гэхдээ серверийн түлшний үнэ шинэчлэгдсэнгүй: ' + friendlyError(e)
        );
      }
    }
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

      {/* Баримт илгээх — ажилтан ч, админ ч ашиглана. ШТС-ийн баримтаа
          зурагдаж илгээхэд бүх админд өөрийнх нь нэрээс чат очно. */}
      <FuelReceiptCard sender={currentUser} />

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
